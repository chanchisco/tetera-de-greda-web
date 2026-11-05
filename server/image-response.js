import { createHash } from 'node:crypto';
import { checkPath,imageFields,imageAt } from './content-model.js';
import { isQuotaError } from '../quota-errors.js';
export function createImageHandler({getDb,legacy=false,now=Date.now,maxBytes=20*1024*1024}){
 const cache=new Map(),pending=new Map();let bytes=0,blockedUntil=0;
 return async function(req,res){
  if(!['GET','HEAD'].includes(req.method))return res.status(405).end();
  const params=new URL(req.url,'https://local.invalid').searchParams;
  let key,path,field,version,id;
  try{if(legacy){path=checkPath(params.get('path'));field=params.get('field');version=params.get('v');if(!imageFields(path).includes(field)||!/^[a-f0-9]{64}$/.test(version||''))throw Error();key=`${path}#${field}#${version}`;}else{id=params.get('id');if(!/^[a-f0-9]{64}$/.test(id||''))throw Error();key=id;}}catch{return res.status(400).end();}
  try{
   let value=cache.get(key);
   if(value){cache.delete(key);cache.set(key,value);}
   else{
    if(now()<blockedUntil)throw Object.assign(new Error('Cuota temporal.'),{code:8});
    if(!pending.has(key)){
     const task=(async()=>{const data=(await getDb().doc(legacy?path:`imagenesPublicas/${id}`).get()).data();const source=legacy?imageAt(path,data,field):data?.data;if(legacy&&(!data||data.disponible===false||createHash('sha256').update(String(source)).digest('hex')!==version))return null;const match=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(source||'');if(!match)return null;const value={mime:`image/${match[1]}`,buffer:Buffer.from(match[2],'base64')};while(cache.size&&bytes+value.buffer.length>maxBytes){const first=cache.keys().next().value;bytes-=cache.get(first).buffer.length;cache.delete(first);}if(value.buffer.length<=maxBytes){cache.set(key,value);bytes+=value.buffer.length;}return value;})();
     pending.set(key,task);
    }
    try{value=await pending.get(key);}finally{pending.delete(key);}
   }
   if(!value){res.setHeader('Cache-Control','no-store');return res.status(404).end();}
   res.setHeader('Content-Type',value.mime);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','public, max-age=31536000, immutable');res.setHeader('CDN-Cache-Control','public, s-maxage=31536000, immutable');res.setHeader('Vercel-CDN-Cache-Control','public, s-maxage=31536000, immutable');
   return res.status(200).end(req.method==='HEAD'?undefined:value.buffer);
  }catch(error){if(isQuotaError(error))blockedUntil=now()+120000;res.setHeader('Cache-Control','no-store');res.setHeader('Retry-After','120');return res.status(503).end();}
 };
}
