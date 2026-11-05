import { cert,getApps,initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createRestFirestore } from './firestore-rest.js';
import { createHash } from 'node:crypto';
const instances=new Map();
export function cloudflareServices(env){
 const {FIREBASE_PROJECT_ID:projectId,FIREBASE_CLIENT_EMAIL:clientEmail,FIREBASE_PRIVATE_KEY:raw}=env;
 if(!projectId||!clientEmail||!raw)throw Object.assign(new Error('Faltan los secretos de Firebase en Cloudflare.'),{status:503});
 const privateKey=raw.replace(/\\n/g,'\n'),name='tetera-cf-'+createHash('sha256').update(`${projectId}:${clientEmail}:${privateKey}`).digest('hex').slice(0,16);
 if(!instances.has(name)){const credential=cert({projectId,clientEmail,privateKey}),app=getApps().find(app=>app.name===name)||initializeApp({credential,projectId},name);let current,pending;
  async function getAccessToken(){if(current?.until>Date.now())return current.token;if(!pending)pending=credential.getAccessToken().then(value=>(current={token:value.access_token,until:Date.now()+Math.max(60,value.expires_in-60)*1000})).finally(()=>{pending=null;});return (await pending).token;}
  instances.set(name,{auth:getAuth(app),db:createRestFirestore({projectId,getAccessToken})});}
 return instances.get(name);
}
