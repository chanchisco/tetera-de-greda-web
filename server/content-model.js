import { createHash } from 'node:crypto';
import { ApiError } from './policy.js';
export const GALLERY_LIMIT = 15;
export const TRASH_DAYS = 5;
export const HISTORY_LIMIT = 5;
export const contentCollections = ['platos','bebidas','galeria','configuracion'];
export function contentLabel(path,data={}) {return data.nombre || (path.startsWith('galeria/') ? data.descripcion||'Foto de galería' : ({portadas:'Portadas',menuDia:'Menú del día',imagenesSeccion:'Extras de Inicio',historia:'Historia de Nosotros',galeriaOpciones:'Ajustes de galería',destacados:'Recomendados de la casa'}[path.split('/')[1]]||'Contenido'));}
export function imageFields(path){if(path.startsWith('platos/'))return ['imagenBase64'];if(path.startsWith('galeria/'))return ['url'];return ({portadas:['inicio','carta','nosotros'],menuDia:['img1','img2'],imagenesSeccion:['quienesSomosImg','nuestraCartaImg'],historia:['b1.img','b2.img','b3.img']}[path.split('/')[1]]||[]);}
export function imageAt(path,data,field){if(!data)return null;if(path.startsWith('platos/')&&field==='imagenBase64')return data.imagenBase64||data.imagenURL||null;return field.split('.').reduce((record,key)=>record?.[key],data)||null;}
export function putImage(path,data,field,value){const next=structuredClone(data),keys=field.split('.');let current=next;for(const key of keys.slice(0,-1)){current[key]||={};current=current[key];}current[keys.at(-1)]=value;if(path.startsWith('platos/')&&field==='imagenBase64')next.imagenURL=null;return next;}
const configIds = new Set(['portadas','menuDia','imagenesSeccion','historia','galeriaOpciones','destacados']);
export const digest = value => createHash('sha256').update(value).digest('hex');
export const imageKey = (published,source,settings) => digest(JSON.stringify({published,source,settings:Object.fromEntries(Object.entries(settings).sort(([a],[b])=>a.localeCompare(b)))}));
export function checkPath(path) {
 if (typeof path !== 'string' || !/^[a-zA-Z]+\/[a-zA-Z0-9_-]{1,128}$/.test(path)) throw new ApiError(400,'Contenido no válido.');
 const [collection,id] = path.split('/');
 if (!contentCollections.includes(collection) || (collection === 'configuracion' && !configIds.has(id))) throw new ApiError(403,'Ese apartado no se puede editar.');
 return path;
}
export function checkValue(value, depth=0) {
 if(depth>8) throw new ApiError(400,'Datos demasiado anidados.');
 if(value===null || typeof value==='boolean') return;
 if(typeof value==='number' && Number.isFinite(value)) return;
 if(typeof value==='string' && value.length<=850000) return;
 if(Array.isArray(value) && value.length<=100) { value.forEach(v=>checkValue(v,depth+1)); return; }
 if(value && Object.getPrototypeOf(value)===Object.prototype && Object.keys(value).length<=80) {
  for(const [key,item] of Object.entries(value)) {
   if(!/^[a-zA-Z][a-zA-Z0-9_]{0,64}$/.test(key) || ['constructor','prototype','__proto__'].includes(key)) throw new ApiError(400,'Campo no válido.');
   checkValue(item,depth+1);
  } return;
 } throw new ApiError(400,'Datos de contenido no válidos.');
}
export function checkDocument(path,data) {
 checkValue(data);
 if(!data || Array.isArray(data) || typeof data!=='object') throw new ApiError(400,'Faltan datos.');
 if(path.startsWith('platos/') || path.startsWith('bebidas/')) {
  if(typeof data.nombre!=='string' || !data.nombre.trim() || data.nombre.length>100) throw new ApiError(400,'Escribe un nombre de hasta 100 caracteres.');
  if(typeof data.precio!=='string' || !/^\$?[\d.,\s]+$/.test(data.precio) || data.precio.length>30) throw new ApiError(400,'Escribe un precio válido.');
  if(data.descripcion!==undefined && (typeof data.descripcion!=='string' || data.descripcion.length>1000)) throw new ApiError(400,'Revisa la descripción.');
  if(data.etiquetas!==undefined && (!Array.isArray(data.etiquetas)||data.etiquetas.length>10||data.etiquetas.some(v=>typeof v!=='string'||v.length>60)))throw new ApiError(400,'Revisa las etiquetas del plato.');
  if(data.oferta===true && (typeof data.ofertaPrecio!=='string'||!/^\$?[\d.,\s]+$/.test(data.ofertaPrecio)||data.ofertaPrecio.length>30))throw new ApiError(400,'Escribe un precio válido para la oferta.');
 }
 for(const field of ['oferta','disponible','habilitado'])if(data[field]!==undefined&&typeof data[field]!=='boolean')throw new ApiError(400,'Revisa las opciones de visibilidad.');
 if(path==='configuracion/destacados' && (!Array.isArray(data.platos) || data.platos.length>3 || new Set(data.platos).size!==data.platos.length || data.platos.some(id=>typeof id!=='string'||!/^[\w-]{1,128}$/.test(id)))) throw new ApiError(400,'Selecciona hasta tres platos distintos.');
 function imageFields(record) {for(const [key,value]of Object.entries(record)){if(value&&typeof value==='object'&&!Array.isArray(value))imageFields(value);const imageKey=['imagenBase64','imagenURL','img','img1','img2','quienesSomosImg','nuestraCartaImg'].includes(key)||(path==='configuracion/portadas'&&['inicio','carta','nosotros'].includes(key))||(path.startsWith('galeria/')&&key==='url');if(imageKey&&value!==null&&value!==''&&(typeof value!=='string'||!(/^(https:\/\/[^\s'"<>\\]+|\/api\/imagen\?id=[a-f0-9]{64})$/.test(value))))throw new ApiError(400,'La dirección de la imagen no es válida.');}}
 imageFields(data);
 if(Buffer.byteLength(JSON.stringify(data))>850000) throw new ApiError(413,'El contenido supera el tamaño permitido. Reduce la imagen.');
}
// Las imágenes publicadas son inmutables: la URL identifica exactamente sus bytes.
export function separateImages(value, sources=[], assets=new Map()) {
 if(typeof value==='string' && value.startsWith('data:image/')) {
  if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) || value.length>1000000) throw new ApiError(413,'La imagen es demasiado pesada o tiene un formato no admitido.');
  const edit=sources.find(s=>s.published===value);
  const original=edit?.source || value;
  if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(original) || original.length>1000000) throw new ApiError(413,'La imagen de trabajo es demasiado pesada.');
  const settings=edit?.settings || {legacy:true};
  checkValue(settings);
  if(!settings || typeof settings!=='object' || Array.isArray(settings) || Buffer.byteLength(JSON.stringify(settings))>2048 || Object.keys(settings).some(k=>!['zoom','x','y','brightness','ratio','legacy'].includes(k)))throw new ApiError(400,'Ajustes de imagen no válidos.');
  for(const [key,[min,max]] of Object.entries({zoom:[1,4],x:[0,1],y:[0,1],brightness:[.5,1.5],ratio:[.1,10]}))if(settings[key]!==undefined && (typeof settings[key]!=='number'||settings[key]<min||settings[key]>max))throw new ApiError(400,'Revisa los ajustes de imagen.');
  const id=imageKey(value,original,settings);
  if(!assets.has(id)) assets.set(id,{data:value,source:original,settings});
  return `/api/imagen?id=${id}`;
 }
 if(Array.isArray(value)) return value.map(v=>separateImages(v,sources,assets));
 if(value && typeof value==='object') return Object.fromEntries(Object.entries(value).filter(([k])=>!k.startsWith('_')).map(([k,v])=>[k,separateImages(v,sources,assets)]));
 return value;
}
export function mergeContent(previous,patch) {
 const result={...previous};
 for(const [key,value] of Object.entries(patch)) result[key]=value && typeof value==='object' && !Array.isArray(value) && previous?.[key] && typeof previous[key]==='object' && !Array.isArray(previous[key]) ? mergeContent(previous[key],value) : value;
 return result;
}
