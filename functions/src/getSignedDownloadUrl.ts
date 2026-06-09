import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getStorage } from 'firebase-admin/storage';

export const getSignedDownloadUrl = onCall({
  serviceAccount: 'firebase-adminsdk-fbsvc@bildgenerierung-495412.iam.gserviceaccount.com',
  region: 'europe-west3',
  memory: '256MiB',
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login erforderlich');
  }

  const { storagePath } = request.data as { storagePath: string };

  if (!storagePath) {
    throw new HttpsError('invalid-argument', 'storagePath fehlt');
  }

  const [buffer] = await getStorage().bucket().file(storagePath).download();
  return { data: buffer.toString('base64') };
});
