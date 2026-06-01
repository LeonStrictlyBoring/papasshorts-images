import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

const DAILY_LIMIT = 500;
const MINUTE_LIMIT = 10;

export async function checkRateLimit(userId: string): Promise<void> {
  const db = getFirestore();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);         // YYYY-MM-DD
  const currentMinute = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM

  const ref = db.collection('rateLimits').doc(userId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as {
      dailyCount: number;
      dailyDate: string;
      minuteCount: number;
      minuteWindow: string;
    } | undefined;

    const dailyCount = data?.dailyDate === today ? data.dailyCount : 0;
    const minuteCount = data?.minuteWindow === currentMinute ? data.minuteCount : 0;

    if (minuteCount >= MINUTE_LIMIT) {
      throw new HttpsError(
        'resource-exhausted',
        `Zu viele Anfragen. Maximal ${MINUTE_LIMIT} Generierungen pro Minute erlaubt.`
      );
    }
    if (dailyCount >= DAILY_LIMIT) {
      throw new HttpsError(
        'resource-exhausted',
        `Tageslimit erreicht. Maximal ${DAILY_LIMIT} Generierungen pro Tag erlaubt.`
      );
    }

    tx.set(ref, {
      dailyCount: dailyCount + 1,
      dailyDate: today,
      minuteCount: minuteCount + 1,
      minuteWindow: currentMinute,
    });
  });
}
