import { cloudflareServices } from './firebase.js';
import { createCloudflareApp } from './app.js';
async function sendRecovery(email,env){
 if(!env.FIREBASE_WEB_API_KEY)throw new Error('Correo sin configurar');
 const response=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`,{method:'POST',headers:{'Content-Type':'application/json','X-Firebase-Locale':'es'},body:JSON.stringify({requestType:'PASSWORD_RESET',email,continueUrl:`${env.APP_ORIGIN}/admin.html`}),signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error('No se pudo enviar el correo');
}
export default createCloudflareApp({services:cloudflareServices,sendRecovery});
