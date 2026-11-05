import { sanitizeCatalog } from './public-data-model.js';
import { validCatalog as valid,createPublicLoader } from './public-data-cache.js';
export const db=Object.freeze({public:true});
export const doc=(_db,...parts)=>({path:parts.join('/')});
export const collection=doc;
export const query=(ref,...clauses)=>({...ref,orderField:clauses.find(clause=>clause?.field)?.field});
export const orderBy=field=>({field});
const KEY='greda_catalog_v2';
let pending,memory;
const preview=new URLSearchParams(location.search).get('image-preview')==='1'&&parent!==window;
function saved(){try{const value=JSON.parse(localStorage.getItem(KEY)||'null');return valid(value)?value:null;}catch{return null;}}
function fromParent(){return new Promise((resolve,reject)=>{const requestId=crypto.randomUUID();const timer=setTimeout(()=>{window.removeEventListener('message',listener);reject(new Error('No se recibieron los datos de la vista previa.'));},10000);function listener(event){if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='tetera-preview-data'||event.data.requestId!==requestId||!valid(event.data.catalog))return;clearTimeout(timer);window.removeEventListener('message',listener);resolve(event.data.catalog);}window.addEventListener('message',listener);parent.postMessage({type:'tetera-preview-data-request',requestId},location.origin);});}
const loader=createPublicLoader({readSaved:saved,writeSaved:value=>localStorage.setItem(KEY,JSON.stringify(value)),transform:value=>({...value,data:sanitizeCatalog(value.data)}),fetchData:async()=>{const response=await fetch('/api/publico',{credentials:'omit',signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('Carta no disponible.');return response.json();},onStale:old=>{const note=document.createElement('p');note.setAttribute('role','status');note.textContent='Mostrando una copia guardada de la carta. No se pudieron comprobar los últimos cambios; confirma precios y disponibilidad con el local.';document.body.prepend(note);document.dispatchEvent(new CustomEvent('public-content-stale',{detail:{generatedAt:old.generatedAt}}));}});
async function catalog(){if(!preview)return loader.get();if(memory)return memory;if(!pending)pending=fromParent().then(value=>(memory=value)).finally(()=>{pending=null;});return pending;}
function snapshot(path,value){return {id:path.split('/').at(-1),ref:{path},exists:()=>value!==undefined,data:()=>value===undefined?undefined:structuredClone(value)};}
export async function getDoc(ref){const value=(await catalog()).data;const [name,id]=ref.path.split('/');return snapshot(ref.path,name==='configuracion'?value.configuracion[id]:value[name]?.find(item=>item.id===id)?.data);}
export async function getDocs(ref){const value=(await catalog()).data;const docs=(value[ref.path]||[]).filter(item=>!ref.orderField||item.data[ref.orderField]!==undefined).map(item=>snapshot(`${ref.path}/${item.id}`,item.data));return {docs,size:docs.length,empty:!docs.length,forEach:fn=>docs.forEach(fn)};}
