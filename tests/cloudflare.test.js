import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeValue,decodeValue,createRestFirestore } from '../cloudflare/firestore-rest.js';
import { adaptHandler } from '../cloudflare/adapter.js';
import { createCloudflareApp } from '../cloudflare/app.js';
test('REST conserva los tipos usados por contenido, auditoría y permisos',()=>{for(const value of [null,true,3,1.5,'texto',[1,'x'],{activo:true,rol:'contenido',nested:{precio:'$1.000'}},new Date('2026-11-05T00:00:00Z')])assert.deepEqual(decodeValue(encodeValue(value)),value);assert.throws(()=>encodeValue(undefined));});
test('REST conserva transacción, orden de lectura/escritura y reintenta únicamente ABORTED',async()=>{
 const calls=[];let attempt=0;const db=createRestFirestore({projectId:'demo-cf',getAccessToken:async()=> 'test',fetcher:async(url,options)=>{const path=decodeURIComponent(url),body=JSON.parse(options.body);calls.push({path,body});if(path.endsWith(':beginTransaction'))return Response.json({transaction:'t'+(++attempt)});if(path.endsWith(':batchGet'))return Response.json([{found:{name:body.documents[0],fields:{revision:{integerValue:'1'}}}}]);if(path.endsWith(':commit')&&attempt===1)return Response.json({error:{status:'ABORTED',message:'Conflicto'}},{status:409});return Response.json({});}});
 await db.runTransaction(async tx=>{const ref=db.doc('sistema/gestion'),old=(await tx.get(ref)).data();tx.set(ref,{revision:old.revision+1});});assert.equal(attempt,2);assert.equal(calls.filter(call=>call.path.endsWith(':commit')).at(-1).body.transaction,'t2');
 await assert.rejects(db.runTransaction(async tx=>{tx.set(db.doc('sistema/gestion'),{revision:3});await tx.get(db.doc('sistema/gestion'));}),/lecturas/);assert.ok(calls.some(call=>call.path.endsWith(':rollback')));
});
test('REST pagina por nombre y conserva filtros, límite y proyección sin cargar campos de imagen',async()=>{
 let sent;const db=createRestFirestore({projectId:'demo-cf',getAccessToken:async()=> 'test',fetcher:async(url,options)=>{sent=JSON.parse(options.body);return Response.json([{readTime:'2026-11-05'}]);}});await db.collection('galeria').where('disponible','==',true).orderBy('__name__').startAfter('a').select('_revision').limit(15).get();assert.equal(sent.structuredQuery.limit,15);assert.equal(sent.structuredQuery.startAt.before,false);assert.deepEqual(sent.structuredQuery.select.fields,[{fieldPath:'_revision'}]);assert.equal(sent.structuredQuery.where.fieldFilter.op,'EQUAL');
});
test('adaptador limita tamaño, preserva JSON/status/cabeceras y devuelve HEAD sin cuerpo',async()=>{
 const handler=(req,res)=>res.status(201).json({method:req.method,body:req.body});const response=await adaptHandler(handler,new Request('https://cf.test/api/contenido',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"ok":true}'}));assert.equal(response.status,201);assert.equal((await response.json()).body,'{"ok":true}');const huge=await adaptHandler(handler,new Request('https://cf.test/api/contenido',{method:'POST',headers:{'Content-Length':'3800001'},body:'x'}));assert.equal(huge.status,413);const head=await adaptHandler((req,res)=>res.status(200).end('body'),new Request('https://cf.test/api/publico',{method:'HEAD'}));assert.equal(await head.text(),'');
});
test('Worker cachea solo respuestas públicas correctas, conserva permisos y no reemplaza API por HTML',async()=>{
 const stored=new Map(),tasks=[];let reads=0;const cache={match:async key=>stored.get(key.url)?.clone(),put:async(key,response)=>stored.set(key.url,response)};const env={APP_ORIGIN:'https://cf.test',ASSETS:{fetch:async()=>new Response('asset')}};
 const app=createCloudflareApp({cache:()=>cache,services:()=>({db:{collection:()=>({get:async()=>{reads++;return {docs:[]};}}),doc:path=>({get:async()=>{reads++;return {id:path.split('/').at(-1),exists:false};}})}}),sendRecovery:async()=>{}}),ctx={waitUntil:promise=>tasks.push(promise)};
 let res=await app.fetch(new Request('https://cf.test/api/publico'),env,ctx);assert.equal(res.status,200);await Promise.all(tasks);res=await app.fetch(new Request('https://cf.test/api/publico'),env,ctx);assert.equal(res.headers.get('X-Tetera-Cache'),'HIT');assert.equal(reads,9);res=await app.fetch(new Request('https://cf.test/api/contenido'),env,ctx);assert.equal(res.status,401);assert.equal(stored.size,1);res=await app.fetch(new Request('https://cf.test/api/no-existe'),env,ctx);assert.equal(res.status,404);assert.match(res.headers.get('Content-Type'),/json/);
});

test('REST mantiene los separadores RPC literales que exige Google y codifica los nombres de documentos',async()=>{
 const calls=[];const db=createRestFirestore({projectId:'demo-cf',getAccessToken:async()=> 'test',fetcher:async(url,options)=>{
  calls.push(url);assert.doesNotMatch(url,/%3A(?:runQuery|batchGet|beginTransaction|commit|rollback)$/i);
  if(url.endsWith(':runQuery'))return Response.json([]);if(url.endsWith(':batchGet'))return Response.json([]);if(url.endsWith(':beginTransaction'))return Response.json({transaction:'t'});return Response.json({});
 }});
 await db.collection('platos').limit(1).get();await db.doc('platos/foto:1 con espacio').get();await db.doc('platos/a').set({nombre:'A'});await db.runTransaction(async tx=>tx.set(db.doc('platos/b'),{nombre:'B'}));await assert.rejects(db.runTransaction(()=>{throw Error('cancelado');}));
 for(const action of ['runQuery','batchGet','beginTransaction','commit','rollback'])assert.ok(calls.some(url=>url.endsWith(':'+action)));
 // Los IDs del cuerpo batchGet quedan intactos; en una subcolección sí se codifica su ruta.
 await db.doc('platos/foto:1 con espacio').collection('versiones').get();assert.ok(calls.at(-1).includes('foto%3A1%20con%20espacio'));
});
test('Cloudflare normaliza la barra de origen sin autorizar rutas, credenciales u otros sitios',async()=>{
 const {configuredOrigin}=await import('../cloudflare/app.js');assert.equal(configuredOrigin(' https://cf.test/ '),'https://cf.test');assert.equal(configuredOrigin('https://cf.test'),'https://cf.test');for(const value of ['http://cf.test','https://cf.test/admin.html','https://cf.test/?x=1','https://u:p@cf.test',undefined])assert.equal(configuredOrigin(value),undefined);
});
