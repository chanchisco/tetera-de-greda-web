import { services } from '../server/firebase.js';
import { createManagementHandler } from '../server/management.js';
async function sendRecovery(email) {
  if (!process.env.FIREBASE_WEB_API_KEY) throw new Error('Correo sin configurar');
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(process.env.FIREBASE_WEB_API_KEY)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Firebase-Locale': 'es' },
    body: JSON.stringify({ requestType: 'PASSWORD_RESET', email, continueUrl: `${process.env.APP_ORIGIN}/admin.html` }), signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error('No se pudo enviar el correo');
}
export default createManagementHandler({ getServices: services, sendRecovery, origin: process.env.APP_ORIGIN });
