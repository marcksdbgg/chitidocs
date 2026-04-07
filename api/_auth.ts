import { getApps, initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

type UserRole =
  | 'superadmin'
  | 'director'
  | 'subdirector'
  | 'mesa_partes'
  | 'secretaria'
  | 'jefe_area'
  | 'docente'
  | 'auditor';

interface AuthContext {
  uid: string;
  email?: string;
  role: UserRole | null;
}

function getPrivateKeyFromEnv() {
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
}

function initAdmin() {
  if (getApps().length > 0) {
    return;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKeyFromEnv();

  if (projectId && clientEmail && privateKey) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    return;
  }

  initializeApp({
    credential: applicationDefault(),
  });
}

export function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function requireAuth(req: Request): Promise<AuthContext> {
  initAdmin();

  const authorization = req.headers.get('authorization') || req.headers.get('Authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;

  if (!token) {
    throw Object.assign(new Error('Missing auth token'), { status: 401 });
  }

  const decoded = await getAuth().verifyIdToken(token);
  const userDoc = await getFirestore().collection('users').doc(decoded.uid).get();
  const role = userDoc.exists ? ((userDoc.data()?.role as UserRole | undefined) ?? null) : null;

  return {
    uid: decoded.uid,
    email: decoded.email,
    role,
  };
}

export function hasAnyRole(role: UserRole | null, allowed: UserRole[]) {
  return !!role && allowed.includes(role);
}
