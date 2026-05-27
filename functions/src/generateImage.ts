import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { GoogleGenAI } from '@google/genai';
import { getStorage } from 'firebase-admin/storage';
import * as crypto from 'crypto';

const ai = new GoogleGenAI({});

export const generateImage = onCall({
  serviceAccount: 'firebase-adminsdk-fbsvc@bildgenerierung-495412.iam.gserviceaccount.com',
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login erforderlich');
  }

  const { prompt, aspectRatio = '1:1' } = request.data;

  if (!prompt) {
    throw new HttpsError('invalid-argument', 'Prompt fehlt');
  }

  const response = await ai.models.generateImages({
    model: 'imagen-3.0-generate-002',
    prompt: prompt,
    config: {
      numberOfImages: 1,
      outputMimeType: 'image/jpeg',
      aspectRatio: aspectRatio,
    },
  });

  const imageBytes = response.generatedImages![0].image!.imageBytes!;
  const buffer = Buffer.from(imageBytes as string, 'base64');

  const filename = `generated/${crypto.randomUUID()}.jpg`;
  const bucket = getStorage().bucket();
  const file = bucket.file(filename);

  await file.save(buffer, {
    metadata: { contentType: 'image/jpeg' },
  });

  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000,
  });

  return { success: true, imageUrl: url, storagePath: filename };
});
