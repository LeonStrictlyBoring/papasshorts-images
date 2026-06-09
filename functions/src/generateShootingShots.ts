import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { GoogleGenAI } from '@google/genai';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { logger } from 'firebase-functions';
import { checkRateLimit } from './rateLimit';

interface ModelInput {
  name: string;
  storagePath: string;
}

interface ArtikelBildInput {
  storagePath: string;
  ansicht: string;
}

interface ArtikelInput {
  produktname: string;
  artikelId: string;
  bilder: ArtikelBildInput[];
}

interface ModelArtikelInput {
  modelName: string;
  artikel: ArtikelInput[];
}

interface RegieInput {
  beschreibung: string;
  posingTyp?: string;
  armHaltung?: string;
  koerperSpannung?: string;
  bildausschnitt?: string;
  kamerawinkel?: string;
  objektivCharakteristik?: string;
  blickkontakt?: string;
  gesichtsausdruck?: string;
  stoffDynamik?: string;
  fokusBereich?: string;
  fotografieStil?: string;
  bildschaerfe?: string;
  photorealistic?: boolean;
  candidLook?: boolean;
  filmGrain?: boolean;
}

interface GenerateShootingShotsRequest {
  models: ModelInput[];
  modelArtikel: ModelArtikelInput[];
  setting: { name: string; storagePath: string };
  regie: RegieInput;
  refinement?: { storagePath: string; text: string };
}

const NUMBER_OF_SHOTS = 3;
const na = 'Keine Angabe';

function buildPrompt(
  systemPrompt: string,
  regie: RegieInput,
  assignmentText: string,
): string {
  const realismusFlags = [
    regie.photorealistic ? 'Photorealistic' : '',
    regie.candidLook ? 'Candid look' : '',
    regie.filmGrain ? 'Shot on 35mm film grain' : '',
  ].filter(Boolean).join(', ') || na;

  const vars: Record<string, string> = {
    '{{model_artikel_setting}}': assignmentText,
    '{{regie_beschreibung}}':    regie.beschreibung || na,
    '{{posing_typ}}':            regie.posingTyp || na,
    '{{arm_haltung}}':           regie.armHaltung || na,
    '{{koerper_spannung}}':      regie.koerperSpannung || na,
    '{{bildausschnitt}}':        regie.bildausschnitt || na,
    '{{kamerawinkel}}':          regie.kamerawinkel || na,
    '{{objektiv}}':              regie.objektivCharakteristik || na,
    '{{blickkontakt}}':          regie.blickkontakt || na,
    '{{gesichtsausdruck}}':      regie.gesichtsausdruck || na,
    '{{stoff_dynamik}}':         regie.stoffDynamik || na,
    '{{fokus_bereich}}':         regie.fokusBereich || na,
    '{{fotografie_stil}}':       regie.fotografieStil || na,
    '{{bildschaerfe}}':          regie.bildschaerfe || na,
    '{{realismus}}':             realismusFlags,
  };

  let result = systemPrompt;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(key, value);
  }
  return result;
}

function buildAssignmentText(
  modelArtikel: ModelArtikelInput[],
  settingName: string,
  indexMap: Record<string, number>,
): string {
  const lines: string[] = [];
  for (const ma of modelArtikel) {
    const modelIdx = indexMap[`model:${ma.modelName}`];
    const artikelList = ma.artikel
      .map(a => {
        const bildRefs = a.bilder
          .map((b, i) => `${b.ansicht || 'Ansicht'} (Referenzbild ${indexMap[`artikel:${a.artikelId}:${i}`]})`)
          .join(', ');
        return `'${a.produktname}' (ID: ${a.artikelId}, ${bildRefs})`;
      })
      .join(', ');
    lines.push(`Model '${ma.modelName}' (Referenzbild ${modelIdx}) trägt: ${artikelList}.`);
  }
  lines.push(`Setting '${settingName}' (Referenzbild ${indexMap['setting']}).`);
  return lines.join('\n');
}

async function loadImage(storagePath: string): Promise<{ data: string; mimeType: string }> {
  const file = getStorage().bucket().file(storagePath);
  const [[buf], [meta]] = await Promise.all([file.download(), file.getMetadata()]);
  return {
    data: buf.toString('base64'),
    mimeType: (meta.contentType as string) || 'image/jpeg',
  };
}

export const generateShootingShots = onCall({
  serviceAccount: 'firebase-adminsdk-fbsvc@bildgenerierung-495412.iam.gserviceaccount.com',
  secrets: ['GEMINI_API_KEY'],
  timeoutSeconds: 540,
  memory: '1GiB',
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login erforderlich');

  await checkRateLimit(request.auth.uid);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const data = request.data as GenerateShootingShotsRequest;

  if (!data.models?.length) throw new HttpsError('invalid-argument', 'Pflichtfeld fehlt: models');
  if (!data.modelArtikel?.length) throw new HttpsError('invalid-argument', 'Pflichtfeld fehlt: modelArtikel');
  if (!data.setting?.storagePath) throw new HttpsError('invalid-argument', 'Pflichtfeld fehlt: setting');
  if (!data.regie?.beschreibung?.trim()) throw new HttpsError('invalid-argument', 'Pflichtfeld fehlt: regie.beschreibung');

  // Load system prompt
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let promptDoc: any;
  try {
    promptDoc = await getFirestore().collection('prompts').doc('shooting-creation').get();
  } catch (err) {
    logger.error('Firestore-Fehler beim Lesen des System-Prompts', { flow: 'shooting', userId: request.auth.uid, errorType: err instanceof Error ? err.constructor.name : typeof err, errString: String(err) });
    throw new HttpsError('internal', 'Datenbankfehler beim Laden des System-Prompts', { httpStatus: 500, source: 'Firestore' });
  }
  if (!promptDoc.exists) throw new HttpsError('not-found', 'System-Prompt "shooting-creation" nicht in Firestore gefunden', { httpStatus: 404, source: 'Firestore' });
  const systemPrompt = (promptDoc.data() as { systemPrompt: string }).systemPrompt;
  if (!systemPrompt) throw new HttpsError('not-found', 'System-Prompt "shooting-creation" ist leer', { httpStatus: 404, source: 'Firestore' });

  // Load all reference images in parallel
  try {
    const modelPaths = data.models.map(m => m.storagePath);
    const artikelPaths = data.modelArtikel.flatMap(ma =>
      ma.artikel.flatMap(a => a.bilder.map(b => b.storagePath))
    );
    const allPaths = [...modelPaths, ...artikelPaths, data.setting.storagePath];

    const loadedImages = await Promise.all(allPaths.map(loadImage));

    // Build image index map and parts array
    const indexMap: Record<string, number> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [];
    let idx = 1;

    for (const m of data.models) {
      const img = loadedImages[modelPaths.indexOf(m.storagePath)];
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
      indexMap[`model:${m.name}`] = idx++;
    }

    for (const ma of data.modelArtikel) {
      for (const a of ma.artikel) {
        for (let bi = 0; bi < a.bilder.length; bi++) {
          const pathIdx = modelPaths.length + artikelPaths.indexOf(a.bilder[bi].storagePath);
          const img = loadedImages[pathIdx];
          parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
          indexMap[`artikel:${a.artikelId}:${bi}`] = idx++;
        }
      }
    }

    // Setting (last reference image before optional refinement)
    const settingImg = loadedImages[allPaths.length - 1];
    parts.push({ inlineData: { mimeType: settingImg.mimeType, data: settingImg.data } });
    indexMap['setting'] = idx++;

    // Optional: refinement reference shot
    if (data.refinement) {
      const refImg = await loadImage(data.refinement.storagePath);
      parts.push({ inlineData: { mimeType: refImg.mimeType, data: refImg.data } });
      const refIdx = idx;

      const assignmentText = buildAssignmentText(data.modelArtikel, data.setting.name, indexMap);
      let finalPrompt = buildPrompt(systemPrompt, data.regie, assignmentText);
      finalPrompt += `\n\nBitte erstelle neue Shot-Varianten basierend auf dem vorherigen Shot (Referenzbild ${refIdx}). Anpassungen: ${data.refinement.text}`;
      parts.push({ text: finalPrompt });
    } else {
      const assignmentText = buildAssignmentText(data.modelArtikel, data.setting.name, indexMap);
      const finalPrompt = buildPrompt(systemPrompt, data.regie, assignmentText);
      parts.push({ text: finalPrompt });
    }

    const contents = { role: 'user', parts };

    // Generate shots sequentially
    const bucket = getStorage().bucket();
    const userId = request.auth.uid;
    const timestamp = Date.now();
    const generationId = crypto.randomUUID();
    const images: { url: string; storagePath: string }[] = [];

    const MAX_RETRIES = 2;

    for (let i = 0; i < NUMBER_OF_SHOTS; i++) {
      let imagePart: { inlineData?: { data?: string; mimeType?: string } } | undefined;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        let response: Awaited<ReturnType<typeof ai.models.generateContent>>;
        try {
          response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents,
            config: { responseModalities: ['IMAGE'] },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error('Gemini API Fehler', { flow: 'shooting', userId: request.auth.uid, shot: i, attempt, errorType: err instanceof Error ? err.constructor.name : typeof err, message, errString: String(err) });
          if (message.includes('quota') || message.includes('RESOURCE_EXHAUSTED')) {
            throw new HttpsError('resource-exhausted', 'Gemini API Quota überschritten', { httpStatus: 429, source: 'Gemini' });
          }
          if (message.includes('UNAVAILABLE') || message.includes('high demand')) {
            throw new HttpsError('unavailable', 'Gemini API vorübergehend nicht erreichbar', { httpStatus: 503, source: 'Gemini' });
          }
          if (attempt === MAX_RETRIES) throw new HttpsError('internal', 'Shot-Generierung fehlgeschlagen', { httpStatus: 500, source: 'Gemini' });
          continue;
        }

        const parts = response.candidates?.[0]?.content?.parts ?? [];
        imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
        if (imagePart?.inlineData?.data) break;

        const finishReason = response.candidates?.[0]?.finishReason;
        const textContent = parts.filter(p => p.text).map(p => p.text).join(' ').slice(0, 200);
        logger.warn(`Shot ${i} Versuch ${attempt}: kein Bild`, { flow: 'shooting', userId: request.auth.uid, shot: i, attempt, finishReason, textContent });
      }

      if (!imagePart?.inlineData?.data) {
        logger.error(`Shot ${i}: kein Bild nach allen Versuchen (stiller Fehler)`, { flow: 'shooting', userId: request.auth.uid, shot: i, maxRetries: MAX_RETRIES });
        continue;
      }

      const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
      const storagePath = `generated/shootings/${userId}/${timestamp}/${i}.jpg`;
      const file = bucket.file(storagePath);
      await file.save(buffer, { metadata: { contentType: 'image/jpeg' } });

      const token = crypto.randomUUID();
      await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
      const encodedPath = storagePath.split('/').map(encodeURIComponent).join('%2F');
      const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;

      images.push({ url, storagePath });
    }

    return { images, generationId };

  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('Unerwarteter Fehler in generateShootingShots', { flow: 'shooting', userId: request.auth.uid, errorType: err instanceof Error ? err.constructor.name : typeof err, errString: String(err) });
    throw new HttpsError('internal', 'Unerwarteter Fehler bei der Shot-Generierung', { httpStatus: 500, source: 'Unbekannt' });
  }
});
