// Simulación local exclusivamente para revisar el UI sin credenciales ni Firebase.
// Este archivo y sus rutas NO forman parte de dist/ ni del despliegue.
import { readFile } from 'node:fs/promises';
const users = [
  { uid: 'qa-owner', email: 'dueno@example.test', rol: 'completo', activo: true, invitacionEnviada: true },
  { uid: 'qa-editor', email: 'contenido@example.test', rol: 'contenido', activo: true, invitacionEnviada: true }
];
const firebase = `export const auth={currentUser:{uid:'qa-owner',email:'dueno@example.test',emailVerified:true,getIdToken:async()=> 'qa-token',getIdTokenResult:async()=>({claims:{}})}}; export const db={};`;
const firestore = `
let serial=0;
const records={ 'platos/qa-plato':{nombre:'Plato de prueba',precio:'$9.000',descripcion:'Datos ficticios',orden:1,categoria:'fondos',imagenBase64:'/logo-tetera.webp'},'galeria/qa-foto':{url:'/logo-tetera.webp',ts:1},'configuracion/portadas':{inicio:'/logo-tetera.webp'},'configuracion/imagenesSeccion':{quienesSomosImg:'/logo-tetera.webp',quienesSomosTexto:'Vista de prueba'},'configuracion/historia':{b1:{img:'/logo-tetera.webp',tit:'Nuestra historia',txt:'Solo prueba'}}};
export const doc=(db,...parts)=>({path:parts.length?parts.join('/'):db.path+'/qa-new-'+(++serial)});
export const collection=doc;export const query=ref=>ref;export const orderBy=()=>null;
const snapshot=path=>({ref:{path},id:path.split('/').at(-1),exists:()=>!!records[path],data:()=>records[path]});
export const getDoc=async ref=>snapshot(ref.path);
export const getDocs=async ref=>{const docs=Object.keys(records).filter(path=>path.startsWith(ref.path+'/')).map(snapshot);return{docs,size:docs.length,empty:!docs.length,forEach:fn=>docs.forEach(fn)}};
export const onSnapshot=(ref,next)=>{queueMicrotask(()=>next({data:()=>({activo:true,rol:'completo'})}));return()=>{}};
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
  if (path === '/__qa/api/contenido') {
    res.setHeader('Content-Type','application/json');
    if(req.method==='POST'){let body='';for await(const chunk of req)body+=chunk;const data=JSON.parse(body);res.end(JSON.stringify({revision:(data.revision||0)+1,data:data.data,message:'Simulación local: no se modificó Firebase.'}));}
    else res.end(JSON.stringify({items:[],galleryLimit:15,trashDays:5}));return true;
  }
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
  if (!['admin.html','admin.js','admin-management.js','admin-management.css','site-config.js','logo tetera.png','content-client.js','content-tools.js','image-editor.js','image-page-preview.js','content-tools.css','qr-code.js','logo-tetera.webp','favicon-tetera.png'].includes(decodeURIComponent(name))) { res.writeHead(404).end(); return true; }
  const file = await readFile(`dist/${decodeURIComponent(name)}`);
  if (name.endsWith('.png')||name.endsWith('.webp')) { res.end(file); return true; }
  let content = file.toString();
  if (name.endsWith('.js')) {
    content = content.replace(/(['"])https:\/\/www\.gstatic\.com\/firebasejs\/[^'"]+\/firebase-firestore\.js\1/g, "'/__qa/firestore.js'")
      .replace(/(['"])https:\/\/www\.gstatic\.com\/firebasejs\/[^'"]+\/firebase-auth\.js\1/g, "'/__qa/auth.js'")
      .replace("fetch('/api/gestion'", "fetch('/__qa/api/gestion'").replace("fetch('/api/contenido'", "fetch('/__qa/api/contenido'");
  }
  if (name === 'admin.html') content = content.replace('Administración Tetera de Greda', 'SIMULACIÓN LOCAL · datos ficticios');
  res.end(content); return true;
}
