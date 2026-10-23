// Inventario y respaldo por defecto. Nunca exporta credenciales ni Auth.
import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { initializeApp,cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { separateImages,contentCollections,digest } from '../server/content-model.js';
import { retentionPlan,scrubExpiredImages } from '../server/content-retention.js';
const args=process.argv.slice(2),keyPath=args[args.indexOf('--key')+1];
if(!args.includes('--key')||!keyPath)throw new Error('Indica --key con la ruta privada de la cuenta de servicio.');
const key=JSON.parse(await readFile(keyPath,'utf8'));if(key.project_id!=='latetera')throw new Error('La cuenta no corresponde a latetera.');
initializeApp({credential:cert(key)});const db=getFirestore();
const lockRef=db.doc('sistema/contenidoEdicion');let expectedLock=(await lockRef.get()).data()?.revision||0;
const collections={};
for(const name of [...contentCollections,'imagenesPublicas','imagenesTrabajo','papeleraContenido','historialContenido']){
 const snapshot=await db.collection(name).get();collections[name]=snapshot.docs.map(d=>({id:d.id,data:d.data()}));
}
const versions={};for(const item of collections.historialContenido){const snaps=await db.collection(`historialContenido/${item.id}/versiones`).get();versions[item.id]=snaps.docs.map(d=>({id:d.id,data:d.data()}));}
await mkdir('.firebase-private/backups',{recursive:true});
const backup=`.firebase-private/backups/contenido-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
await writeFile(backup,JSON.stringify({format:'tetera-private-backup-v1',at:Date.now(),collections,versions}));
console.log(`Respaldo privado guardado. ${contentCollections.map(n=>`${n}: ${collections[n].length}`).join(', ')}.`);
if(!args.includes('--apply')){console.log('Solo inventario y respaldo. Sin escrituras ni borrados remotos.');await db.terminate();process.exit(0);}
if(args.includes('--migrate')){
 let count=0;
 for(const collection of contentCollections)for(const item of collections[collection]){
  const assets=new Map(),data=separateImages(item.data,[],assets);if(!assets.size)continue;
  const ref=db.doc(`${collection}/${item.id}`);
  await db.runTransaction(async tx=>{
   const lock=(await tx.get(lockRef)).data();
   const current=(await tx.get(ref)).data();
   if(JSON.stringify(current)!==JSON.stringify(item.data))throw new Error('Hubo una edición concurrente. Repite el inventario.');
   for(const [id,asset] of assets){tx.set(db.doc(`imagenesPublicas/${id}`),{data:asset.data,bytes:asset.data.length,created:Date.now()});tx.set(db.doc(`imagenesTrabajo/${id}`),{source:asset.source,settings:asset.settings,created:Date.now()});}
   tx.set(ref,{...data,_revision:item.data._revision||0});
   tx.set(lockRef,{revision:(lock?.revision||0)+1});
  });count++;
 }
 console.log(`Migrados ${count} documentos. Las imágenes anteriores están en el respaldo privado.`);
}else if(args.includes('--cleanup')){
 const now=Date.now(),{expired,unused}=retentionPlan(collections,versions,now);let deleted=0;
 for(const item of expired){
  const ref=db.doc('papeleraContenido/'+item.id);
  await db.runTransaction(async tx=>{
   const lock=(await tx.get(lockRef)).data();
   if((lock?.revision||0)!==expectedLock)throw new Error('El contenido cambió durante la revisión. Detén ediciones y repite el inventario.');
   const current=(await tx.get(ref)).data();
   if(!current||current.until>now||current.revision!==item.data.revision)throw new Error('La papelera cambió. Repite la revisión.');
   const hist=db.doc('historialContenido/'+digest(current.path)),entries=await tx.get(hist.collection('versiones'));
   const related=current.kind==='image'?await tx.get(db.collection('papeleraContenido').where('path','==',current.path)):null;
   for(const entry of entries.docs){
    if(current.kind==='image'){const value=entry.data(),data=scrubExpiredImages(current.path,value.data,[item]);if(data!==value.data)tx.set(entry.ref,{...value,data});}
    else tx.delete(entry.ref);
   }
   if(related)for(const entry of related.docs){const value=entry.data();if(value.kind!=='image'&&value.data){const data=scrubExpiredImages(current.path,value.data,[item]);if(data!==value.data)tx.set(entry.ref,{...value,data});}}
   tx.delete(ref);if(current.kind!=='image')tx.delete(hist);
   tx.set(lockRef,{revision:expectedLock+1});
  });expectedLock++;deleted++;
 }
 let images=0;for(let index=0;index<unused.length;index+=100){const batch=unused.slice(index,index+100);await db.runTransaction(async tx=>{const lock=(await tx.get(lockRef)).data();if((lock?.revision||0)!==expectedLock)throw new Error('El contenido cambió. Repite la revisión antes de borrar imágenes.');for(const item of batch){tx.delete(db.doc(`imagenesPublicas/${item.id}`));tx.delete(db.doc(`imagenesTrabajo/${item.id}`));}tx.set(lockRef,{revision:expectedLock+1});});expectedLock++;images+=batch.length;}
 console.log(`Papelera vencida depurada: ${deleted}. Imágenes sin referencias depuradas: ${images}. El respaldo previo conserva los datos.`);
}else throw new Error('Usa --migrate o --cleanup junto con --apply.');
await db.terminate();
