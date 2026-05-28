import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { GoogleGenAI } from '@google/genai';
import { getStorage } from 'firebase-admin/storage';
import * as crypto from 'crypto';

export const generateImage = onCall({
  serviceAccount: 'firebase-adminsdk-fbsvc@bildgenerierung-495412.iam.gserviceaccount.com',
  secrets: ['GEMINI_API_KEY'],
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login erforderlich');
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const { prompt } = request.data;

  if (!prompt) {
    throw new HttpsError('invalid-argument', 'Prompt fehlt');
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: prompt,
    config: { responseModalities: ['IMAGE'] },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
  if (!imagePart?.inlineData?.data) {
    throw new HttpsError('internal', 'Bildgenerierung fehlgeschlagen: kein Bild in der Antwort');
  }
  const buffer = Buffer.from(imagePart.inlineData.data, 'base64');

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
