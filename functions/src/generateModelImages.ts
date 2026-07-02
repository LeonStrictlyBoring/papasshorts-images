import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { GoogleGenAI } from '@google/genai';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { logger } from 'firebase-functions';
import { writeErrorLog } from './logToFirestore';
import { checkRateLimit } from './rateLimit';

interface BodyMeasurements {
  height?: string;
  clothingSize?: string;
  chest?: string;
  waist?: string;
  hips?: string;
  shoeSize?: string;
}

interface Appearance {
  build?: string;
  phenotype?: string;
  skinTone?: string;
  skinUndertone?: string;
  hairColor?: string;
  hairLength?: string;
  hairTexture?: string;
  beard?: string;
  eyeColor?: string;
  specialFeatures?: string;
}

interface GenerateModelImagesRequest {
  persona: string;
  bodyMeasurements: BodyMeasurements;
  appearance: Appearance;
  archetypes: string[];
  customArchetype?: string;
  refinement?: {
    storagePath: string;
    text: string;
  };
}

const NUMBER_OF_IMAGES = 3;

function buildPrompt(systemPrompt: string, data: GenerateModelImagesRequest): string {
  const { persona, bodyMeasurements, appearance, archetypes, customArchetype } = data;
  const allArchetypes = customArchetype ? [...archetypes, customArchetype] : [...archetypes];
  const na = 'Keine Angabe';

  const vars: Record<string, string> = {
    '{{persona}}':            persona,
    '{{körpergröße}}':        bodyMeasurements.height       || na,
    '{{konfektionsgröße}}':   bodyMeasurements.clothingSize || na,
    '{{schuhgröße}}':         bodyMeasurements.shoeSize     || na,
    '{{brustumfang}}':        bodyMeasurements.chest        || na,
    '{{taillenumfang}}':      bodyMeasurements.waist        || na,
    '{{hüftumfang}}':         bodyMeasurements.hips         || na,
    '{{statur}}':             appearance.build              || na,
    '{{phänotyp}}':           appearance.phenotype          || na,
    '{{augenfarbe}}':         appearance.eyeColor           || na,
    '{{hautton}}':            appearance.skinTone           || na,
    '{{haut_unterton}}':      appearance.skinUndertone      || na,
    '{{haarfarbe}}':          appearance.hairColor          || na,
    '{{haarstruktur}}':       appearance.hairTexture        || na,
    '{{haarlänge}}':          appearance.hairLength         || na,
    '{{bart}}':               appearance.beard              || na,
    '{{besondere_merkmale}}': appearance.specialFeatures    || na,
    '{{archetypen}}':         allArchetypes.join(', ')      || na,
  };

  let result = systemPrompt;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(key, value);
  }
  return result;
}

export const generateModelImages = onCall({
  serviceAccount: 'firebase-adminsdk-fbsvc@bildgenerierung-495412.iam.gserviceaccount.com',
  secrets: ['GEMINI_API_KEY'],
  timeoutSeconds: 540,
  memory: '512MiB',
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login erforderlich');
  }

  await checkRateLimit(request.auth.uid);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const data = request.data as GenerateModelImagesRequest;

  if (!data.persona) {
    throw new HttpsError('invalid-argument', 'Pflichtfeld fehlt: persona');
  }
  if (!data.bodyMeasurements) {
    throw new HttpsError('invalid-argument', 'Pflichtfeld fehlt: bodyMeasurements');
  }
  if (!data.appearance) {
    throw new HttpsError('invalid-argument', 'Pflichtfeld fehlt: appearance');
  }
  if (!Array.isArray(data.archetypes) || data.archetypes.length === 0) {
    throw new HttpsError('invalid-argument', 'Pflichtfeld fehlt: archetypes');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let promptDoc: any;
  try {
    promptDoc = await getFirestore().collection('prompts').doc('model-creation').get();
  } catch (err) {
    logger.error('Firestore-Fehler beim Lesen des System-Prompts', { flow: 'model', userId: request.auth.uid, errorType: err instanceof Error ? err.constructor.name : typeof err, errString: String(err) });
    await writeErrorLog({ flow: 'model', userId: request.auth.uid, errorType: err instanceof Error ? err.constructor.name : typeof err, message: 'Firestore-Fehler beim Lesen des System-Prompts', errString: String(err), severity: 'error', code: 'internal' });
    throw new HttpsError('internal', 'Datenbankfehler beim Laden des System-Prompts', { httpStatus: 500, source: 'Firestore' });
  }
  if (!promptDoc.exists) {
    throw new HttpsError('not-found', 'System-Prompt "model-creation" nicht in Firestore gefunden', { httpStatus: 404, source: 'Firestore' });
  }

  const systemPrompt = (promptDoc.data() as { systemPrompt: string }).systemPrompt;
  if (!systemPrompt) {
    throw new HttpsError('not-found', 'System-Prompt "model-creation" ist leer', { httpStatus: 404, source: 'Firestore' });
  }

  const finalPrompt = buildPrompt(systemPrompt, data);
  const generationId = crypto.randomUUID();
  const userId = request.auth.uid;
  const timestamp = Date.now();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let contents: any = finalPrompt;
  if (data.refinement) {
    try {
      const [imgBuf] = await getStorage().bucket().file(data.refinement.storagePath).download();
      contents = {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: imgBuf.toString('base64') } },
          { text: `${finalPrompt}\n\nAnpassungen: ${data.refinement.text}` },
        ],
      };
    } catch (err) {
      logger.error('Storage-Fehler beim Laden des Referenzbildes', { flow: 'model', userId: request.auth.uid, errorType: err instanceof Error ? err.constructor.name : typeof err, errString: String(err) });
      await writeErrorLog({ flow: 'model', userId: request.auth.uid, errorType: err instanceof Error ? err.constructor.name : typeof err, message: 'Storage-Fehler beim Laden des Referenzbildes', errString: String(err), severity: 'error', code: 'internal' });
      throw new HttpsError('internal', 'Referenzbild konnte nicht geladen werden', { httpStatus: 500, source: 'Storage' });
    }
  }

  let responses: Awaited<ReturnType<typeof ai.models.generateContent>>[];
  try {
    responses = await Promise.all(
      Array.from({ length: NUMBER_OF_IMAGES }, () =>
        ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents,
          config: { responseModalities: ['IMAGE'] },
        })
      )
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = message.includes('quota') || message.includes('RESOURCE_EXHAUSTED') ? 'resource-exhausted'
      : message.includes('UNAVAILABLE') || message.includes('high demand') ? 'unavailable'
      : 'internal';
    logger.error('Gemini API Fehler', { flow: 'model', userId: request.auth.uid, errorType: err instanceof Error ? err.constructor.name : typeof err, message, errString: String(err) });
    await writeErrorLog({ flow: 'model', userId: request.auth.uid, errorType: err instanceof Error ? err.constructor.name : typeof err, message: `Gemini API Fehler: ${message}`, errString: String(err), severity: 'error', code });
    if (code === 'resource-exhausted') throw new HttpsError('resource-exhausted', 'Gemini API Quota überschritten', { httpStatus: 429, source: 'Gemini' });
    if (code === 'unavailable') throw new HttpsError('unavailable', 'Gemini API vorübergehend nicht erreichbar', { httpStatus: 503, source: 'Gemini' });
    throw new HttpsError('internal', 'Bildgenerierung fehlgeschlagen', { httpStatus: 500, source: 'Gemini' });
  }

  const bucket = getStorage().bucket();
  const images: { url: string; storagePath: string }[] = [];

  for (let i = 0; i < responses.length; i++) {
    const parts = responses[i].candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
    if (!imagePart?.inlineData?.data) continue;

    const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
    const storagePath = `generated/models/${userId}/${timestamp}/${i}.jpg`;
    const file = bucket.file(storagePath);

    await file.save(buffer, { metadata: { contentType: 'image/jpeg' } });

    const token = crypto.randomUUID();
    await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
    const encodedPath = storagePath.split('/').map(encodeURIComponent).join('%2F');
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;

    images.push({ url, storagePath });
  }

  return { images, promptUsed: finalPrompt, generationId };
});
