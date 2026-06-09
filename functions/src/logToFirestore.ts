import { getFirestore, Timestamp } from 'firebase-admin/firestore';

interface ErrorLogEntry {
  flow: string;
  userId: string;
  errorType: string;
  message: string;
  errString: string;
  severity: 'error' | 'warn';
}

export async function writeErrorLog(entry: ErrorLogEntry): Promise<void> {
  try {
    await getFirestore().collection('errorLogs').add({
      ...entry,
      timestamp: Timestamp.now(),
    });
  } catch {
    // intentionally silent
  }
}
