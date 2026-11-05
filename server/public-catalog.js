import { createHash } from 'node:crypto';
import { publicConfigIds,sanitizeCatalog } from '../public-data-model.js';
import { isQuotaError } from '../quota-errors.js';
export const PUBLIC_CACHE_SECONDS=600;
export function legacyImageUrl(value,path,field){if(path.startsWith('platos/')&&field==='imagenURL')field='imagenBase64';const v=createHash('sha256').update(value).digest('hex');return `/api/foto?path=${encodeURIComponent(path)}&field=${encodeURIComponent(field)}&v=${v}`;}
export function createPublicCatalogHandler({getDb,now=Date.now}){
 let cached,pending,blockedUntil=0;
 async function load(){const db=getDb();const [platos,bebidas,galeria,...configs]=await Promise.all(['platos','bebidas','galeria'].map(name=>db.collection(name).get()).concat(publicConfigIds.map(id=>db.doc(`configuracion/${id}`).get())));const input={platos:platos.docs.map(d=>({id:d.id,data:d.data()})),bebidas:bebidas.docs.map(d=>({id:d.id,data:d.data()})),galeria:galeria.docs.map(d=>({id:d.id,data:d.data()})),configuracion:Object.fromEntries(configs.filter(d=>d.exists).map(d=>[d.id,d.data()]))};const value={version:1,generatedAt:now(),data:sanitizeCatalog(input,legacyImageUrl)};cached={value,until:now()+PUBLIC_CACHE_SECONDS*1000};return value;}
 return async function(req,res){
  res.setHeader('X-Content-Type-Options','nosniff');
  // Una única URL canónica evita multiplicar entradas de caché con parámetros.
  if(new URL(req.url,'https://local.invalid').search){res.setHeader('Cache-Control','no-store');return res.status(400).json({message:'Usa /api/publico sin parámetros.'});}
  if(!['GET','HEAD'].includes(req.method))return res.status(405).end();
  try{
   let value=cached?.until>now()?cached.value:null;
   if(!value){if(now()<blockedUntil)throw Object.assign(new Error('Cuota temporal.'),{code:8});if(!pending)pending=load().finally(()=>{pending=null;});value=await pending;}
   const remaining=Math.max(1,Math.floor((cached.until-now())/1000));
   res.setHeader('Cache-Control','public, max-age=60');
   res.setHeader('CDN-Cache-Control',`public, s-maxage=${remaining}`);
   res.setHeader('Vercel-CDN-Cache-Control',`public, s-maxage=${remaining}`);
   return req.method==='HEAD'?res.status(200).end():res.status(200).json(value);
  }catch(error){if(isQuotaError(error))blockedUntil=now()+120000;res.setHeader('Cache-Control','no-store');return res.status(503).json({code:isQuotaError(error)?'resource-exhausted':'unavailable',message:'No se pudo actualizar la carta. Se conservará la última copia disponible.'});}
 };
}
