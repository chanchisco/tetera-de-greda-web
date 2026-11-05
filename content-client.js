import { auth,db } from './firebase-config.js';
import { getDoc as readDoc,getDocs as readDocs,doc,collection } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { createContentStore } from './content-store.js';
import { isQuotaError,QUOTA_MESSAGE } from './quota-errors.js';
const revisions=new Map();
let blockedUntil=0;
async function protectRead(fn){if(Date.now()<blockedUntil)throw Object.assign(new Error(QUOTA_MESSAGE),{code:'resource-exhausted'});try{return await fn();}catch(error){if(isQuotaError(error)){blockedUntil=Date.now()+120000;throw Object.assign(new Error(QUOTA_MESSAGE),{code:'resource-exhausted'});}throw error;}}
const collectionRef=path=>collection(db,path);
const store=createContentStore({loadCollection:path=>protectRead(()=>readDocs(collectionRef(path))),loadDocument:path=>protectRead(()=>readDoc(doc(db,path))),makeRef:path=>doc(db,path)});
let sessionUid;
onAuthStateChanged(auth,user=>{if(sessionUid!==user?.uid){sessionUid=user?.uid;store.clear();revisions.clear();pinnedRevisions.clear();imageDrafts.clear();sourceCache.clear();blockedUntil=0;}});
export const contentDiagnostics=store.stats;
export const previewContent=()=>store.exportData();
const pinnedRevisions=new Map();
export function pinRevision(path,revision=revisions.get(path)||0){if(!pinnedRevisions.has(path))pinnedRevisions.set(path,revision);}
export function unpinRevision(path){pinnedRevisions.delete(path);}
export const imageDrafts=new Map();
const sourceCache=new Map();
async function request(body,query='') {
 if(Date.now()<blockedUntil)throw Object.assign(new Error(QUOTA_MESSAGE),{code:'resource-exhausted'});
 const user=auth.currentUser;if(!user) throw new Error('Inicia sesión para continuar.');
 let token;try{token=await user.getIdToken();}catch{throw new Error('Tu sesión terminó. Vuelve a ingresar para continuar.');}
 let response;try{response=await fetch('/api/contenido'+query,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});}catch{throw new Error(body?'No se pudo confirmar el guardado. Tus cambios siguen en pantalla; revisa el historial antes de repetir.':'No se pudo conectar. Revisa la conexión e intenta nuevamente.');}
 let data;try{data=await response.json();}catch{throw new Error('No se pudo conectar con el servidor. Conserva tus cambios e intenta nuevamente.');}
 if(!response.ok){if(data.code==='resource-exhausted')blockedUntil=Date.now()+120000;const error=Object.assign(new Error(data.message||'No se pudo completar la operación.'),{code:data.code,status:response.status});if(body&&response.status===409)store.invalidate(body.path);throw error;}return data;
}
export async function contentRequest(body,query='') {const key=!body&&/^\?mode=source&id=[a-f0-9]{64}$/.test(query)?auth.currentUser?.uid+query:null;if(!key)return request(body,query);if(!sourceCache.has(key)){const task=request(body,query);sourceCache.set(key,task);task.catch(()=>sourceCache.delete(key));if(sourceCache.size>20)sourceCache.delete(sourceCache.keys().next().value);}return sourceCache.get(key);}
function remember(snapshot) {if(snapshot.ref?.path) revisions.set(snapshot.ref.path,snapshot.data()?._revision||0);return snapshot;}
export async function getDoc(ref,options) {return remember(await store.getDocument(ref.path,options));}
export async function getDocs(ref,options) {const snapshot=await store.getCollection(ref.path,options);snapshot.forEach(remember);return snapshot;}
async function write(ref,data,options={}) {
 if(!revisions.has(ref.path)) await getDoc(ref);
 const serialized=JSON.stringify(data||{});
 const sources=[...imageDrafts.values()].filter(item=>serialized.includes(item.published));
 const result=await contentRequest({action:options.remove?'delete':'save',path:ref.path,revision:pinnedRevisions.get(ref.path)??revisions.get(ref.path)??0,data,sources,merge:!!options.merge,mustExist:!!options.mustExist});
 store.set(ref.path,result.data?{...result.data,_revision:result.revision}:undefined);
 revisions.set(ref.path,result.revision);
 if(pinnedRevisions.has(ref.path))pinnedRevisions.set(ref.path,result.revision);
 document.dispatchEvent(new CustomEvent('content-saved',{detail:{path:ref.path,inputData:data,action:options.remove?'delete':'save',...result}}));
 return result;
}
export const setDoc=(ref,data,options)=>write(ref,data,options);
export const updateDoc=(ref,data)=>write(ref,data,{merge:true,mustExist:true});
export const deleteDoc=ref=>write(ref,null,{remove:true});
export async function addDoc(collection,data) {const ref=doc(collection);revisions.set(ref.path,0);await write(ref,data);return ref;}
export function revisionOf(path){return revisions.get(path)||0;}
export function forgetRevisions(){revisions.clear();store.clear();}
