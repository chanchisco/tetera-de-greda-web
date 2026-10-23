// Simulación local exclusivamente para revisar el UI sin credenciales ni Firebase.
// Este archivo y sus rutas NO forman parte de dist/ ni del despliegue.
import { readFile } from 'node:fs/promises';
const users = [
  { uid: 'qa-owner', email: 'dueno@example.test', rol: 'completo', activo: true, invitacionEnviada: true },
  { uid: 'qa-editor', email: 'contenido@example.test', rol: 'contenido', activo: true, invitacionEnviada: true }
];
const firebase = `export const auth={currentUser:{uid:'qa-owner',email:'dueno@example.test',emailVerified:true,getIdToken:async()=> 'qa-token',getIdTokenResult:async()=>({claims:{}})}}; export const db={};`;
const firestore = `
export const doc=(db,...parts)=>({path:parts.join('/')});
export const collection=doc; export const query=(ref)=>ref; export const orderBy=()=>null;
export const getDoc=async ref=>({exists:()=>false,data:()=>undefined});
export const getDocs=async()=>({size:0,empty:true,forEach:()=>{}});
export const onSnapshot=(ref,next)=>{queueMicrotask(()=>next({data:()=>({activo:true,rol:'completo'})})); return ()=>{};};
export const addDoc=async()=>{},setDoc=async()=>{},deleteDoc=async()=>{},updateDoc=async()=>{};
`;
const auth = `import {auth} from '/__qa/firebase-config.js';
export const onAuthStateChanged=(a,next)=>queueMicrotask(()=>next(a.currentUser));
export const multiFactor=()=>({enrolledFactors:[]}); export const TotpMultiFactorGenerator={FACTOR_ID:'totp'};
export const signOut=async()=>{location.href='/admin.html';};
export const signInWithEmailAndPassword=async()=>{},sendPasswordResetEmail=async()=>{},getMultiFactorResolver=()=>{},reauthenticateWithCredential=async()=>{},sendEmailVerification=async()=>{},reload=async()=>{};
export const EmailAuthProvider={credential:()=>({})};`;

export async function qaResponse(req, res) {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (!path.startsWith('/__qa/')) return false;
  if (path === '/__qa/api/gestion') {
    res.setHeader('Content-Type','application/json');
    if (req.method === 'POST') { res.end(JSON.stringify({ message: 'Simulación local: no se envió correo ni se modificó Firebase.' })); }
    else res.end(JSON.stringify({ users }));
    return true;
  }
  res.setHeader('Content-Type', path.endsWith('.html') ? 'text/html; charset=utf-8' : path.endsWith('.css') ? 'text/css' : path.endsWith('.png') ? 'image/png' : 'text/javascript');
  const fixtures = { '/__qa/firebase-config.js':firebase, '/__qa/firestore.js':firestore, '/__qa/auth.js':auth };
  if (fixtures[path]) { res.end(fixtures[path]); return true; }
  const name = path.slice('/__qa/'.length);
  if (!['admin.html','admin.js','admin-management.js','admin-management.css','site-config.js','logo tetera.png'].includes(decodeURIComponent(name))) { res.writeHead(404).end(); return true; }
  const file = await readFile(`dist/${decodeURIComponent(name)}`);
  if (name.endsWith('.png')) { res.end(file); return true; }
  let content = file.toString();
  if (name.endsWith('.js')) {
    content = content.replace(/(['"])https:\/\/www\.gstatic\.com\/firebasejs\/[^'"]+\/firebase-firestore\.js\1/g, "'/__qa/firestore.js'")
      .replace(/(['"])https:\/\/www\.gstatic\.com\/firebasejs\/[^'"]+\/firebase-auth\.js\1/g, "'/__qa/auth.js'")
      .replace("fetch('/api/gestion'", "fetch('/__qa/api/gestion'");
  }
  if (name === 'admin.html') content = content.replace('Administración Tetera de Greda', 'SIMULACIÓN LOCAL · datos ficticios');
  res.end(content); return true;
}
