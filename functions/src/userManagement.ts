import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps } from 'firebase-admin/app';

if (!getApps().length) initializeApp();

const db = getFirestore();
const authAdmin = getAuth();

async function requireAdminCaller(uid: string): Promise<void> {
  const snap = await db.collection('users').doc(uid).get();
  const role = snap.data()?.role;
  if (role !== 'admin' && role !== 'developer') {
    throw new HttpsError('permission-denied', 'Unzureichende Berechtigung.');
  }
}

export const createUser = onCall({ region: 'europe-west3' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Nicht authentifiziert.');
  await requireAdminCaller(request.auth.uid);

  const { name, email, role } = request.data as { name: string; email: string; role: string };
  if (!name?.trim() || !email?.trim() || !role) {
    throw new HttpsError('invalid-argument', 'Fehlende Pflichtfelder.');
  }
  if (!['user', 'admin', 'developer'].includes(role)) {
    throw new HttpsError('invalid-argument', 'Ungültige Rolle.');
  }

  const tempPassword = Array.from({ length: 24 }, () =>
    Math.random().toString(36)[2] ?? 'x'
  ).join('');

  const userRecord = await authAdmin.createUser({ email, displayName: name, password: tempPassword });

  await db.collection('users').doc(userRecord.uid).set({
    name,
    email,
    role,
    status: 'active',
    createdAt: FieldValue.serverTimestamp(),
  });

  const resetLink = await authAdmin.generatePasswordResetLink(email);
  return { uid: userRecord.uid, resetLink };
});

export const deleteUser = onCall({ region: 'europe-west3' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Nicht authentifiziert.');
  await requireAdminCaller(request.auth.uid);

  const { uid } = request.data as { uid: string };
  if (!uid) throw new HttpsError('invalid-argument', 'Fehlende uid.');
  if (uid === request.auth.uid) {
    throw new HttpsError('failed-precondition', 'Eigenen Account kann nicht gelöscht werden.');
  }

  const targetSnap = await db.collection('users').doc(uid).get();
  if (!targetSnap.exists) throw new HttpsError('not-found', 'Nutzer nicht gefunden.');

  const targetRole = targetSnap.data()?.role;
  if (targetRole === 'admin') {
    const adminsSnap = await db.collection('users')
      .where('role', '==', 'admin')
      .where('status', '==', 'active')
      .get();
    if (adminsSnap.size <= 1) {
      throw new HttpsError(
        'failed-precondition',
        'Es muss immer mindestens ein Admin vorhanden sein.'
      );
    }
  }

  await authAdmin.deleteUser(uid);
  await db.collection('users').doc(uid).delete();
  return { success: true };
});
