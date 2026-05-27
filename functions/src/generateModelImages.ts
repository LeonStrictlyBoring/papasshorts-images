import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { GoogleGenAI } from '@google/genai';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { logger } from 'firebase-functions';

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
}

const ai = new GoogleGenAI({});
const NUMBER_OF_IMAGES = 4;

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
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login erforderlich');
  }

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

  const promptDoc = await getFirestore().collection('prompts').doc('model-creation').get();
  if (!promptDoc.exists) {
    throw new HttpsError('not-found', 'System-Prompt "model-creation" nicht in Firestore gefunden');
  }

  const systemPrompt = (promptDoc.data() as { systemPrompt: string }).systemPrompt;
  if (!systemPrompt) {
    throw new HttpsError('not-found', 'System-Prompt "model-creation" ist leer');
  }

  const finalPrompt = buildPrompt(systemPrompt, data);
  const generationId = crypto.randomUUID();
  const userId = request.auth.uid;
  const timestamp = Date.now();

  let response;
  try {
    response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: finalPrompt,
      config: {
        numberOfImages: NUMBER_OF_IMAGES,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('quota') || message.includes('RESOURCE_EXHAUSTED')) {
      throw new HttpsError('resource-exhausted', 'Imagen API Quota überschritten');
    }
    logger.error('Imagen API Fehler', err);
    throw new HttpsError('internal', 'Bildgenerierung fehlgeschlagen');
  }

  const bucket = getStorage().bucket();
  const images: { url: string; storagePath: string }[] = [];

  for (let i = 0; i < (response.generatedImages?.length ?? 0); i++) {
    const imageBytes = response.generatedImages![i].image!.imageBytes!;
    const buffer = Buffer.from(imageBytes as string, 'base64');
    const storagePath = `generated/models/${userId}/${timestamp}/${i}.jpg`;
    const file = bucket.file(storagePath);

    await file.save(buffer, { metadata: { contentType: 'image/jpeg' } });

    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000,
    });

    images.push({ url, storagePath });
  }

  return { images, promptUsed: finalPrompt, generationId };
});
