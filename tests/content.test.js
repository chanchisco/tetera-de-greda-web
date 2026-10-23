import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentHandler } from '../server/content.js';
import { checkPath,checkDocument,separateImages,digest,imageKey,GALLERY_LIMIT,TRASH_DAYS } from '../server/content-model.js';
import { retentionPlan } from '../server/content-retention.js';
const full={activo:true,rol:'completo'},editor={activo:true,rol:'contenido'};
function fixture(initial={}){
 let state=new Map(Object.entries({'administradores/owner':full,'administradores/editor':editor,...initial})),queue=Promise.resolve(),time=1000000;
 function snap(path){const value=state.get(path);return{exists:!!value,id:path.split('/').at(-1),ref:db.doc(path),data:()=>value&&structuredClone(value)};}
 const db={doc(path){return{path,get:async()=>snap(path),collection(name){return db.collection(`${path}/${name}`);}};},collection(path){
  const filters=[];let max=Infinity,sort;
  const query={select(){return query;},where(k,op,v){filters.push([k,v]);return query;},orderBy(key,direction){sort=[key,direction];return query;},limit(n){max=n;return query;},doc(id){return db.doc(`${path}/${id}`);},async get(){let docs=[...state.keys()].filter(k=>k.startsWith(path+'/')&&k.split('/').length===path.split('/').length+1).map(snap).filter(d=>filters.every(([k,v])=>d.data()[k]===v));if(sort)docs.sort((a,b)=>(a.data()[sort[0]]-b.data()[sort[0]])*(sort[1]==='desc'?-1:1));docs=docs.slice(0,max);return{docs,size:docs.length};}};return query;
 },runTransaction(fn){const run=queue.then(async()=>{const writes=[];let started=false;const result=await fn({async get(ref){assert.equal(started,false,'Firestore no permite lecturas después de escrituras');return ref.get();},set(ref,value){started=true;writes.push(()=>state.set(ref.path,structuredClone(value)));},delete(ref){started=true;writes.push(()=>state.delete(ref.path));}});writes.forEach(f=>f());return result;});queue=run.catch(()=>{});return run;}};
 const auth={async verifyIdToken(token){if(token==='invalid')throw Error();return{uid:token};}};
 const handler=createContentHandler({getServices:()=>({db,auth}),origin:'https://test.example',now:()=>time});
 async function request(body,uid='owner',extra={}){const res={setHeader(){},status(code){this.code=code;return this;},json(data){this.body=data;return this;}};await handler({method:body?'POST':'GET',url:extra.url||'/api/contenido',body,headers:{origin:'https://test.example',authorization:uid?`Bearer ${uid}`:'','content-type':'application/json',...extra.headers}},res);return res;}
 return{request,state,advance(days){time+=days*86400000;}};
}
const dish={nombre:'Pastel de choclo',precio:'$9.000',orden:1};
test('quitar y restaurar una imagen conserva los textos posteriores y rechaza el plazo vencido',async()=>{
 const path='configuracion/imagenesSeccion',photo='https://test.example/foto.jpg',f=fixture({[path]:{quienesSomosImg:photo,texto:'Antes'}});
 assert.equal((await f.request({action:'save',path,revision:0,merge:true,data:{quienesSomosImg:null}})).code,200);
 const trashKey=digest(`${path}#quienesSomosImg#1`);
 assert.equal(f.state.get(`papeleraContenido/${trashKey}`).kind,'image');
 await f.request({action:'save',path,revision:1,merge:true,data:{texto:'Texto nuevo'}});
 assert.equal((await f.request({action:'restore-image',path,revision:1,trashKey,trashRevision:1})).code,200);
 assert.equal(f.state.get(path).texto,'Texto nuevo');assert.equal(f.state.get(path).quienesSomosImg,photo);
 assert.equal(f.state.has(`papeleraContenido/${trashKey}`),false);
 await f.request({action:'save',path,revision:3,merge:true,data:{quienesSomosImg:null}});f.advance(5);
 assert.equal((await f.request({action:'restore-image',path,revision:4,trashKey:digest(`${path}#quienesSomosImg#4`),trashRevision:4})).code,410);
 assert.equal((await f.request({action:'version',path,revision:4,version:3})).code,410);
});
test('restaurar una foto no reemplaza otra y recupera imágenes antiguas del plato',async()=>{
 const path='platos/a',photo='https://test.example/antigua.jpg',f=fixture({[path]:{...dish,imagenURL:photo}});
 await f.request({action:'save',path,revision:0,merge:true,data:{imagenURL:null,imagenBase64:null}});
 const trashKey=digest(`${path}#imagenBase64#1`);
 await f.request({action:'save',path,revision:1,merge:true,data:{imagenBase64:'https://test.example/nueva.jpg'}});
 assert.equal((await f.request({action:'restore-image',path,revision:1,trashKey,trashRevision:1})).code,409);
});
test('limpieza de foto vencida conserva textos históricos y protege imágenes compartidas',()=>{
 const path='configuracion/imagenesSeccion',id='a'.repeat(64),url=`/api/imagen?id=${id}`,now=10*86400000;
 const collections={platos:[],bebidas:[],galeria:[],configuracion:[],imagenesPublicas:[{id,data:{created:0}}],historialContenido:[{id:digest(path),data:{path}}],papeleraContenido:[{id:'trash',data:{kind:'image',path,field:'quienesSomosImg',data:url,until:1}}]};
 const versions={[digest(path)]:[{id:'0',data:{revision:0,data:{quienesSomosImg:url,texto:'Conservar'}}}]};
 assert.equal(retentionPlan(collections,versions,now).unused.length,1);
 collections.platos.push({id:'a',data:{imagenBase64:url}});
 assert.equal(retentionPlan(collections,versions,now).unused.length,0);
 assert.equal(versions[digest(path)][0].data.data.texto,'Conservar');
});
test('colecciones administrativas, rutas anidadas y datos inválidos no pueden escribirse',()=>{
 for(const path of ['administradores/owner','sistema/seguridad','platos/x/extra/y','../platos','configuracion/secreto'])assert.throws(()=>checkPath(path));
 assert.throws(()=>checkDocument('platos/a',{nombre:'A',precio:'gratis'}));
 assert.throws(()=>checkDocument('configuracion/destacados',{platos:['a','a']}));
 assert.equal(GALLERY_LIMIT,15);assert.equal(TRASH_DAYS,5);
});
test('sin sesión, token inválido o cuenta desconocida no se edita contenido',async()=>{
 const f=fixture();for(const uid of [null,'invalid','unknown'])assert.ok((await f.request({action:'save',path:'platos/a',revision:0,data:dish},uid)).code>=400);assert.equal(f.state.has('platos/a'),false);
 assert.equal((await f.request({action:'save',path:'platos/a',revision:0,data:dish},'owner',{headers:{origin:'https://evil.example'}})).code,403);
});
test('contenido puede editar y cada cambio deja una versión; conflicto evita sobrescritura',async()=>{
 const f=fixture({'platos/a':dish});assert.equal((await f.request({action:'save',path:'platos/a',revision:0,data:{precio:'$10.000'},merge:true},'editor')).code,200);
 assert.equal(f.state.get('platos/a').precio,'$10.000');assert.equal(f.state.get(`historialContenido/${digest('platos/a')}/versiones/0`).data.precio,'$9.000');
 assert.equal((await f.request({action:'save',path:'platos/a',revision:0,data:dish})).code,409);
});
test('se conservan exactamente cinco versiones previas y se puede restaurar una',async()=>{
 const f=fixture({'platos/a':dish});for(let revision=0;revision<8;revision++)assert.equal((await f.request({action:'save',path:'platos/a',revision,data:{...dish,nombre:`Plato ${revision}`}})).code,200);
 const key=`historialContenido/${digest('platos/a')}/versiones/`;assert.equal([...f.state.keys()].filter(k=>k.startsWith(key)).length,5);
 assert.equal((await f.request({action:'version',path:'platos/a',revision:8,version:5})).code,200);assert.equal(f.state.get('platos/a').nombre,'Plato 4');
});
test('papelera recuperable antes de cinco días, sin acceso alternativo después',async()=>{
 const f=fixture({'platos/a':dish});assert.equal((await f.request({action:'delete',path:'platos/a',revision:0})).code,200);assert.equal(f.state.has('platos/a'),false);
 f.advance(4);assert.equal((await f.request({action:'restore',path:'platos/a',revision:1})).code,200);
 assert.equal((await f.request({action:'delete',path:'platos/a',revision:2})).code,200);f.advance(5);
 assert.equal((await f.request({action:'restore',path:'platos/a',revision:3})).code,410);assert.equal((await f.request({action:'version',path:'platos/a',revision:3,version:0})).code,410);
});
test('dos subidas simultáneas no exceden quince fotos; restaurar también respeta el límite',async()=>{
 const initial=Object.fromEntries(Array.from({length:14},(_,i)=>[`galeria/f${i}`,{url:'https://test.example/foto.jpg'}]));const f=fixture(initial);
 const results=await Promise.all(['uno','dos'].map(id=>f.request({action:'save',path:`galeria/${id}`,revision:0,data:{url:'https://test.example/foto.jpg'}})));
 assert.deepEqual(results.map(r=>r.code).sort(),[200,409]);
 assert.equal((await f.request({action:'delete',path:'galeria/f0',revision:0})).code,200);
 await f.request({action:'save',path:'galeria/tres',revision:0,data:{url:'https://test.example/foto.jpg'}});
 assert.equal((await f.request({action:'restore',path:'galeria/f0',revision:1})).code,409);
});
test('base64 queda separado del plato y se guardan fuente y brillo; el historial usa referencias',async()=>{
 const picture='data:image/jpeg;base64,/9j/2Q==',f=fixture({'platos/a':dish});
 const result=await f.request({action:'save',path:'platos/a',revision:0,data:{...dish,imagenBase64:picture},sources:[{published:picture,source:picture,settings:{brightness:1.2,zoom:1}}]});
 const id=imageKey(picture,picture,{brightness:1.2,zoom:1});assert.equal(result.code,200);assert.equal(f.state.get('platos/a').imagenBase64,`/api/imagen?id=${id}`);assert.equal(f.state.get(`imagenesTrabajo/${id}`).settings.brightness,1.2);
 assert.throws(()=>separateImages('data:image/svg+xml;base64,AAAA'));
});
test('preparación masiva exige permiso completo y rechaza direcciones de imágenes inseguras',async()=>{
 const f=fixture({'platos/a':dish});
 assert.equal((await f.request({action:'migrate',path:'platos/a',revision:0,data:dish},'editor')).code,403);
 assert.equal((await f.request({action:'migrate',path:'platos/a',revision:0,data:dish},'owner')).code,200);
 assert.throws(()=>checkDocument('platos/a',{...dish,imagenBase64:'javascript:alert(1)'}));
});
test('las recetas de edición forman parte de la identidad inmutable de cada imagen',()=>{
 const data='data:image/jpeg;base64,/9j/2Q==';
 assert.equal(imageKey(data,data,{zoom:1,brightness:1}),imageKey(data,data,{brightness:1,zoom:1}));
 assert.notEqual(imageKey(data,data,{brightness:1,zoom:1}),imageKey(data,data,{brightness:1.2,zoom:1}));
 assert.throws(()=>separateImages(data,[{published:data,source:data,settings:{brightness:9}}]));
});
