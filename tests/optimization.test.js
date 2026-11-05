import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createContentStore,planOrderUpdates } from '../content-store.js';
import { sanitizeCatalog } from '../public-data-model.js';
import { createPublicCatalogHandler,legacyImageUrl } from '../server/public-catalog.js';
import { createImageHandler } from '../server/image-response.js';
import { createPublicLoader } from '../public-data-cache.js';
import { createContentHandler } from '../server/content.js';
import { createManagementHandler } from '../server/management.js';
const photo='data:image/jpeg;base64,/9j/2Q==';
test('cliente público: copia fresca no consulta API; copia reciente sobrevive fallo con aviso, sin bucle',async()=>{
 const data={version:1,generatedAt:1000000,data:{platos:[],bebidas:[],galeria:[],configuracion:{}}};let requests=0,notices=0;
 const loader=createPublicLoader({now:()=>1000001,readSaved:()=>data,writeSaved(){},fetchData:async()=>{requests++;throw Error('Sin red');}});await loader.get();assert.equal(requests,0);
 const stale=createPublicLoader({now:()=>2000000,readSaved:()=>data,writeSaved(){},fetchData:async()=>{requests++;throw Error('Cuota agotada');},onStale:()=>notices++});await Promise.all([stale.get(),stale.get()]);await stale.get();assert.equal(requests,1);assert.equal(notices,1);
});
test('cliente público no reutiliza copias de más de 24 horas ni martilla la API después de un fallo',async()=>{
 let requests=0;const old={version:1,generatedAt:0,data:{platos:[],bebidas:[],galeria:[],configuracion:{}}};const loader=createPublicLoader({now:()=>2*86400000,readSaved:()=>old,writeSaved(){},fetchData:async()=>{requests++;throw Error('Sin red');}});await assert.rejects(loader.get());await assert.rejects(loader.get());assert.equal(requests,1);
});
test('reordenar dos platos entre cincuenta escribe solo los dos afectados',()=>{const items=Array.from({length:50},(_,i)=>({id:String(i),orden:i})),ids=items.map(item=>item.id);assert.deepEqual(planOrderUpdates(items,ids),[]);[ids[0],ids[1]]=[ids[1],ids[0]];assert.deepEqual(planOrderUpdates(items,ids),[{id:'1',orden:0},{id:'0',orden:1}]);});
const snap=(id,data)=>({id,exists:data!==undefined,data:()=>data});
test('cuota agotada devuelve un aviso específico en contenido y Gestión sin ejecutar escrituras',async()=>{
 const getServices=()=>({auth:{verifyIdToken:async()=>({uid:'owner',auth_time:Date.now()/1000})},db:{doc:()=>({get:async()=>{throw {code:8};}})}});
 for(const handler of [createContentHandler({getServices,origin:'https://test.example'}),createManagementHandler({getServices,origin:'https://test.example'})]){const res=response();await handler({method:'GET',url:'/api/contenido',headers:{authorization:'Bearer owner'}},res);assert.equal(res.code,503);assert.equal(res.body.code,'resource-exhausted');assert.equal(res.headers['Retry-After'],'120');assert.match(res.body.message,/cuota/);}
});
function storeFixture(){let reads=0,time=0;const records={platos:Array.from({length:50},(_,i)=>({id:String(i),data:{nombre:`Plato ${i}`,orden:i,_revision:0}})),bebidas:Array.from({length:27},(_,i)=>({id:String(i),data:{nombre:`Bebida ${i}`}})),galeria:Array.from({length:5},(_,i)=>({id:String(i),data:{url:'foto'}}))};const store=createContentStore({now:()=>time,makeRef:path=>({path}),loadCollection:async name=>{reads+=records[name].length;await Promise.resolve();return {docs:records[name].map(item=>snap(item.id,item.data))};},loadDocument:async path=>{reads++;return snap(path.split('/')[1],{_revision:0});}});return {store,reads:()=>reads,advance:()=>time+=120001};}
test('50 platos, 27 bebidas y 5 fotos: inicio se deduplica y 25 guardados no releen listas',async()=>{
 const f=storeFixture(),load=()=>Promise.all(['platos','bebidas','galeria'].map(name=>f.store.getCollection(name,{preferCache:true})));
 await Promise.all([load(),f.store.getCollection('platos'),f.store.getCollection('bebidas'),f.store.getCollection('galeria')]);assert.equal(f.reads(),82);assert.equal(f.store.stats.collectionLoads,3);
 for(let i=0;i<25;i++){f.store.set('platos/0',{nombre:`Editado ${i}`,_revision:i+1});await f.store.getCollection('platos',{preferCache:true});await load();}
 assert.equal(f.reads(),82);assert.equal((await f.store.getDocument('platos/0')).data().nombre,'Editado 24');
 f.advance();await f.store.getCollection('platos');assert.equal(f.reads(),132);
});
test('caché incorpora altas/bajas y se borra por sesión; no pisa una escritura con lectura tardía',async()=>{
 let release;const store=createContentStore({makeRef:path=>({path}),loadCollection:()=>new Promise(resolve=>release=resolve),loadDocument:async()=>snap('a',{})});
 const read=store.getCollection('platos');store.set('platos/a',{nombre:'Nuevo',_revision:1});release({docs:[snap('a',{nombre:'Viejo'})]});assert.equal((await read).docs[0].data().nombre,'Nuevo');store.set('platos/a',undefined);assert.equal((await store.getCollection('platos')).size,0);store.clear();assert.equal(store.exportData().platos.length,0);
});
test('lecturas fallidas no quedan cacheadas y Restaurar puede exigir datos frescos',async()=>{
 let calls=0;const store=createContentStore({makeRef:path=>({path}),loadCollection:async()=>{if(++calls===1)throw Error('Sin red');return {docs:[]};},loadDocument:async()=>snap('x',{calls:++calls})});
 await assert.rejects(store.getCollection('platos'));await store.getCollection('platos');assert.equal(calls,2);await store.getDocument('configuracion/portadas');await store.getDocument('configuracion/portadas');assert.equal(calls,3);await store.getDocument('configuracion/portadas',{fresh:true});assert.equal(calls,4);
});
function response(){return {headers:{},setHeader(name,value){this.headers[name]=value;},status(code){this.code=code;return this;},json(body){this.body=body;return this;},end(body){this.body=body;return this;}};}
function dbFixture(){let reads=0,time=0,fail=false;const data={platos:[snap('a',{nombre:'A',precio:'$1.000',imagenBase64:photo,_revision:4,secreto:'NO_PUBLICAR'}),snap('oculto',{nombre:'Oculto',disponible:false})],bebidas:[],galeria:[]};const db={collection(name){return {async get(){reads++;if(fail)throw {code:8};return {docs:data[name]};}};},doc(path){return {async get(){reads++;if(fail)throw {code:8};const id=path.split('/')[1];return snap(id,id==='portadas'?{inicio:photo,secreto:'NO_PUBLICAR'}:undefined);}};}};return {db,reads:()=>reads,now:()=>time,advance:()=>time+=600001,fail:()=>fail=true};}
test('API pública: 1.000 peticiones concurrentes/calentadas comparten una carga y vencen a 10 minutos',async()=>{
 const f=dbFixture(),handler=createPublicCatalogHandler({getDb:()=>f.db,now:f.now});const request=async()=>{const res=response();await handler({method:'GET',url:'/api/publico'},res);return res;};
 const first=await Promise.all(Array.from({length:1000},request));assert.equal(f.reads(),9);assert.equal(first[0].code,200);assert.match(first[0].headers['Vercel-CDN-Cache-Control'],/600/);assert.equal(first[0].body.data.platos.length,1);const serialized=JSON.stringify(first[0].body);assert.equal(serialized.includes('NO_PUBLICAR'),false);assert.equal(serialized.includes('data:image/'),false);assert.match(first[0].body.data.platos[0].data.imagenBase64,/^\/api\/foto\?/);
 f.advance();await request();assert.equal(f.reads(),18);
});
test('API pública: errores no se cachean en CDN; se pausan reintentos de cuota y se rechaza cache-busting',async()=>{
 const f=dbFixture();f.fail();const handler=createPublicCatalogHandler({getDb:()=>f.db,now:f.now});let res=response();await handler({method:'GET',url:'/api/publico?otro=1'},res);assert.equal(res.code,400);assert.equal(f.reads(),0);
 for(let i=0;i<5;i++){res=response();await handler({method:'GET',url:'/api/publico'},res);assert.equal(res.code,503);assert.equal(res.headers['Cache-Control'],'no-store');}assert.equal(f.reads(),9);
});
test('el contrato público permite solo contenido comercial y fotos visibles',()=>{
 const data=sanitizeCatalog({platos:[],bebidas:[],galeria:[{id:'x',data:{url:'foto',disponible:false}}],configuracion:{historia:{b1:{txt:'Texto',secreto:'Privado'}},secreto:{clave:'Privada'}},administradores:[{email:'privado'}]});assert.equal(data.galeria.length,0);assert.deepEqual(data.configuracion,{historia:{b1:{txt:'Texto'}}});assert.equal('administradores' in data,false);
});
test('imágenes: peticiones concurrentes y HEAD comparten una lectura; rutas privadas no acceden a Firestore',async()=>{
 let reads=0;const db={doc(){return {get:async()=>{reads++;await Promise.resolve();return {data:()=>({data:photo})};}};}};const handler=createImageHandler({getDb:()=>db}),id='a'.repeat(64);
 const results=await Promise.all(Array.from({length:20},async()=>{const res=response();await handler({method:'GET',url:`/api/imagen?id=${id}`},res);return res;}));assert.equal(reads,1);assert.equal(results[0].headers['Content-Type'],'image/jpeg');let res=response();await handler({method:'HEAD',url:`/api/imagen?id=${id}`},res);assert.equal(reads,1);assert.equal(res.body,undefined);
 const legacy=createImageHandler({getDb:()=>db,legacy:true});res=response();await legacy({method:'GET',url:`/api/foto?path=administradores/owner&field=clave&v=${id}`},res);assert.equal(res.code,400);assert.equal(reads,1);
});
test('fotos base64 antiguas se sirven sin migración y su URL identifica sus bytes',async()=>{
 let reads=0;const handler=createImageHandler({legacy:true,getDb:()=>({doc(){return {get:async()=>{reads++;return {data:()=>({imagenBase64:photo})};}};}})});const res=response();await handler({method:'GET',url:legacyImageUrl(photo,'platos/a','imagenBase64')},res);assert.equal(res.code,200);assert.deepEqual(res.body,Buffer.from('/9j/2Q==','base64'));assert.equal(reads,1);assert.ok(legacyImageUrl(photo,'platos/a','imagenBase64').includes(createHash('sha256').update(photo).digest('hex')));
});
