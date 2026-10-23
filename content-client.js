import { auth,db } from './firebase-config.js';
import { getDoc as readDoc,getDocs as readDocs,doc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
const revisions=new Map();
const pinnedRevisions=new Map();
export function pinRevision(path,revision=revisions.get(path)||0){if(!pinnedRevisions.has(path))pinnedRevisions.set(path,revision);}
export function unpinRevision(path){pinnedRevisions.delete(path);}
export const imageDrafts=new Map();
export async function contentRequest(body,query='') {
 const user=auth.currentUser;if(!user) throw new Error('Inicia sesión para continuar.');
 let token;try{token=await user.getIdToken();}catch{throw new Error('Tu sesión terminó. Vuelve a ingresar para continuar.');}
 let response;try{response=await fetch('/api/contenido'+query,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});}catch{throw new Error(body?'No se pudo confirmar el guardado. Tus cambios siguen en pantalla; revisa el historial antes de repetir.':'No se pudo conectar. Revisa la conexión e intenta nuevamente.');}
 let data;try{data=await response.json();}catch{throw new Error('No se pudo conectar con el servidor. Conserva tus cambios e intenta nuevamente.');}
 if(!response.ok) throw new Error(data.message||'No se pudo completar la operación.');return data;
}
function remember(snapshot) {if(snapshot.ref?.path) revisions.set(snapshot.ref.path,snapshot.data()?._revision||0);return snapshot;}
export async function getDoc(ref) {return remember(await readDoc(ref));}
export async function getDocs(query) {const snapshot=await readDocs(query);snapshot.forEach(remember);return snapshot;}
async function write(ref,data,options={}) {
 if(!revisions.has(ref.path)) await getDoc(ref);
 const serialized=JSON.stringify(data||{});
 const sources=[...imageDrafts.values()].filter(item=>serialized.includes(item.published));
 const result=await contentRequest({action:options.remove?'delete':'save',path:ref.path,revision:pinnedRevisions.get(ref.path)??revisions.get(ref.path)??0,data,sources,merge:!!options.merge,mustExist:!!options.mustExist});
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
export function forgetRevisions(){revisions.clear();}
