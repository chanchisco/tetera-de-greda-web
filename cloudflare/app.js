import { createContentHandler } from '../server/content.js';
import { createManagementHandler } from '../server/management.js';
import { createPublicCatalogHandler } from '../server/public-catalog.js';
import { createImageHandler } from '../server/image-response.js';
import { adaptHandler } from './adapter.js';
const security={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Strict-Transport-Security':'max-age=31536000'};
export function configuredOrigin(value){try{const url=new URL(value?.trim());return url.protocol==='https:'&&url.pathname==='/'&&!url.search&&!url.hash&&!url.username&&!url.password?url.origin:undefined;}catch{return undefined;}}
export function createCloudflareApp({services,sendRecovery,cache=()=>globalThis.caches?.default}){
 const handlers=new WeakMap();
 function routes(env){if(!handlers.has(env)){const getServices=()=>services(env),origin=configuredOrigin(env.APP_ORIGIN);handlers.set(env,{'/api/contenido':createContentHandler({getServices,origin}),'/api/gestion':createManagementHandler({getServices,origin,sendRecovery:email=>sendRecovery(email,{...env,APP_ORIGIN:origin})}),'/api/publico':createPublicCatalogHandler({getDb:()=>getServices().db}),'/api/imagen':createImageHandler({getDb:()=>getServices().db}),'/api/foto':createImageHandler({getDb:()=>getServices().db,legacy:true})});}return handlers.get(env);}
 return {async fetch(request,env,ctx){
  const url=new URL(request.url),handler=routes(env)[url.pathname];
  if(!handler){if(url.pathname.startsWith('/api/'))return Response.json({message:'Ruta no encontrada.'},{status:404,headers:{...security,'Cache-Control':'no-store'}});return env.ASSETS.fetch(request);}
  const publicRoute=['/api/publico','/api/imagen','/api/foto'].includes(url.pathname),cacheable=publicRoute&&['GET','HEAD'].includes(request.method);
  const key=new Request(url.href,{method:'GET'}),store=cacheable?cache():null;
  if(store){const hit=await store.match(key);if(hit){const result=new Response(request.method==='HEAD'?null:hit.body,hit);for(const [name,value]of Object.entries(security))result.headers.set(name,value);result.headers.set('X-Tetera-Cache','HIT');return result;}}
  let result;try{result=await adaptHandler(handler,request);}catch{result=Response.json({message:'No se pudo completar la operación. Conserva tus cambios y reintenta.'},{status:503,headers:{'Cache-Control':'no-store'}});}
  for(const [name,value]of Object.entries(security))result.headers.set(name,value);
  if(store&&request.method==='GET'&&result.status===200){const shared=result.headers.get('Vercel-CDN-Cache-Control')||result.headers.get('CDN-Cache-Control')||'';const ttl=/\b(?:s-maxage|max-age)=(\d+)/.exec(shared)?.[1];if(ttl){const copy=result.clone();copy.headers.delete('Vercel-CDN-Cache-Control');copy.headers.set('Cache-Control',`public, max-age=${ttl}`);ctx.waitUntil(store.put(key,copy).catch(()=>{}));}result.headers.set('X-Tetera-Cache','MISS');}
  result.headers.delete('Vercel-CDN-Cache-Control');return result;
 }};
}
