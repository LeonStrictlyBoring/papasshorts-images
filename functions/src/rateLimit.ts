import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

const DAILY_LIMIT = 20;

export async function checkRateLimit(userId: string): Promise<void> {
  const db = getFirestore();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const ref = db.collection('rateLimits').doc(userId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as { count: number; date: string } | undefined;

    if (!data || data.date !== today) {
      tx.set(ref, { count: 1, date: today });
      return;
    }

    if (data.count >= DAILY_LIMIT) {
      throw new HttpsError(
        'resource-exhausted',
        `Tageslimit erreicht. Maximal ${DAILY_LIMIT} Generierungen pro Tag erlaubt.`
      );
    }

    tx.update(ref, { count: FieldValue.increment(1) });
  });
}
