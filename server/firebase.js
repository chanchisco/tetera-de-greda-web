import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
export function services() {
  const { FIREBASE_PROJECT_ID: projectId, FIREBASE_CLIENT_EMAIL: clientEmail, FIREBASE_PRIVATE_KEY: key } = process.env;
  if (!projectId || !clientEmail || !key) throw Object.assign(new Error('Falta configurar la API de administración en Vercel.'), { status: 503 });
  const app = getApps()[0] || initializeApp({ credential: cert({ projectId, clientEmail, privateKey: key.replace(/\\n/g, '\n') }) });
  return { auth: getAuth(app), db: getFirestore(app) };
}
