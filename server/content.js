import { ApiError,requireAdmin } from './policy.js';
import { checkPath,checkValue,checkDocument,separateImages,mergeContent,digest,contentLabel,imageFields,imageAt,putImage,GALLERY_LIMIT,TRASH_DAYS,HISTORY_LIMIT } from './content-model.js';
const clean = data => Object.fromEntries(Object.entries(data || {}).filter(([k])=>!k.startsWith('_')));
export function createContentHandler({getServices,origin,now=Date.now}) {
 return async function(req,res) {
  res.setHeader('Cache-Control','no-store');
  try {
   if(!['GET','POST'].includes(req.method)) throw new ApiError(405,'Método no permitido.');
   if(!origin || new URL(origin).protocol!=='https:') throw new ApiError(503,'Falta configurar la dirección del sitio.');
   if(req.method==='POST' && req.headers.origin!==origin) throw new ApiError(403,'Origen no autorizado.');
   const bearer=/^Bearer (\S+)$/.exec(req.headers.authorization||'');
   if(!bearer) throw new ApiError(401,'Inicia sesión para continuar.');
   const {auth,db}=getServices(); let token;
   try { token=await auth.verifyIdToken(bearer[1],true); } catch { throw new ApiError(401,'Tu sesión terminó. Ingresa nuevamente.'); }
   const actor=db.doc(`administradores/${token.uid}`);
   requireAdmin((await actor.get()).data());
   const security=(await db.doc('sistema/seguridad').get()).data();
   if(security?.requireMfa && token.firebase?.sign_in_second_factor!=='totp') throw new ApiError(403,'Ingresa con tu segundo factor.');
   await db.runTransaction(async tx=>{
    const ref=db.doc(`limitesContenido/${token.uid}`),old=(await tx.get(ref)).data(),minute=Math.floor(now()/60000);
    const count=old?.minute===minute?old.count+1:1;
    if(count>120) throw new ApiError(429,'Espera un minuto antes de continuar.');
    tx.set(ref,{minute,count});
   });
   const url=new URL(req.url,'https://local.invalid');
   if(req.method==='GET') {
    const mode=url.searchParams.get('mode')||'recent';
    if(mode==='source') {
     const id=url.searchParams.get('id'); if(!/^[a-f0-9]{64}$/.test(id||'')) throw new ApiError(400,'Imagen no válida.');
     const doc=await db.doc(`imagenesTrabajo/${id}`).get();
     if(!doc.exists) throw new ApiError(404,'No se conserva una imagen de trabajo para esta foto.');
     return res.status(200).json(doc.data());
    }
    if(mode==='history') {
     const path=checkPath(url.searchParams.get('path')),root=db.doc(`historialContenido/${digest(path)}`),meta=(await root.get()).data();
     if(meta?.deletedAt && meta.deletedAt+TRASH_DAYS*86400000<=now()) return res.status(200).json({items:[]});
     const items=await root.collection('versiones').orderBy('revision','desc').limit(HISTORY_LIMIT).get();
     return res.status(200).json({items:items.docs.map(d=>({id:d.id,...d.data()}))});
    }
    if(mode==='trash') {
     const list=await db.collection('papeleraContenido').orderBy('deletedAt','desc').limit(100).get();
     return res.status(200).json({items:list.docs.map(d=>({id:d.id,...d.data()})).filter(d=>d.until>now()).map(({data,...meta})=>meta),days:TRASH_DAYS});
    }
    if(mode==='backup') {
     const collection=url.searchParams.get('collection'),after=url.searchParams.get('after');
     if(!['platos','bebidas','galeria','configuracion','imagenesPublicas','imagenesTrabajo'].includes(collection))throw new ApiError(400,'Colección de respaldo no válida.');
     if(after&&!/^[\w-]{1,128}$/.test(after))throw new ApiError(400,'Página no válida.');
     if(collection==='configuracion'){
      const names=['destacados','galeriaOpciones','historia','imagenesSeccion','menuDia','portadas'];
      if(after&&!names.includes(after))throw new ApiError(400,'Página no válida.');
      const start=after?names.indexOf(after)+1:0,selected=names.slice(start,start+3);
      const documents=selected.length?await db.getAll(...selected.map(id=>db.doc(`configuracion/${id}`))):[];
      return res.status(200).json({collection,items:documents.filter(d=>d.exists).map(d=>({id:d.id,data:d.data()})),next:start+3<names.length?selected.at(-1):null});
     }
     let query=db.collection(collection).orderBy('__name__').limit(3);if(after)query=query.startAfter(after);
     const list=await query.get();
     return res.status(200).json({collection,items:list.docs.map(d=>({id:d.id,data:d.data()})),next:list.size===3?list.docs.at(-1).id:null});
    }
    const list=await db.collection('historialContenido').orderBy('at','desc').limit(30).get();
    return res.status(200).json({items:list.docs.map(d=>({id:d.id,...d.data()})),galleryLimit:GALLERY_LIMIT,trashDays:TRASH_DAYS,role:(await actor.get()).data()?.rol});
   }
   if(!String(req.headers['content-type']||'').startsWith('application/json')) throw new ApiError(415,'Envía datos JSON.');
   let body=req.body;
   if(typeof body==='string') { try{body=JSON.parse(body);}catch{throw new ApiError(400,'Datos no válidos.');} }
   if(!body || Buffer.byteLength(JSON.stringify(body))>3800000) throw new ApiError(413,'La solicitud es demasiado grande. Guarda una imagen a la vez.');
   if(body.sources!==undefined && (!Array.isArray(body.sources)||body.sources.length>12||body.sources.some(s=>!s||typeof s.published!=='string'||typeof s.source!=='string'))) throw new ApiError(400,'Las imágenes de trabajo no son válidas.');
   if(body.action==='restore-image'&&!/^[a-f0-9]{64}$/.test(body.trashKey||''))throw new ApiError(400,'Imagen de papelera no válida.');
   const path=checkPath(body.path),key=digest(path),ref=db.doc(path),root=db.doc(`historialContenido/${key}`),trashRef=db.doc(`papeleraContenido/${body.action==='restore-image'?body.trashKey:key}`);
   if(!['save','migrate','delete','restore','restore-image','version'].includes(body.action)) throw new ApiError(400,'Acción no válida.');
   if(body.action==='migrate')requireAdmin((await actor.get()).data(),true);
   if(!Number.isSafeInteger(body.revision)||body.revision<0) throw new ApiError(400,'Actualiza el contenido antes de guardar.');
   const assets=new Map();
   const patch=['save','migrate'].includes(body.action)?separateImages(body.data,body.sources||[],assets):null;
   if(patch) checkValue(patch);
   let result;
   await db.runTransaction(async tx=>{
    requireAdmin((await tx.get(actor)).data(),body.action==='migrate');
    const sec=(await tx.get(db.doc('sistema/seguridad'))).data();
    if(sec?.requireMfa && token.firebase?.sign_in_second_factor!=='totp') throw new ApiError(403,'Ingresa con tu segundo factor.');
    const serialRef=db.doc('sistema/contenidoEdicion'),serial=(await tx.get(serialRef)).data();
    const current=(await tx.get(ref)).data(),meta=(await tx.get(root)).data(),trash=(await tx.get(trashRef)).data();
    const revision=current?._revision??meta?.revision??0;
    if(body.action!=='restore-image'&&body.revision!==revision) throw new ApiError(409,'Otra persona cambió este contenido. Vuelve a cargarlo antes de guardar.');
    let previous=current?separateImages(clean(current),[],assets):null;
    let next;
    if(body.action==='restore-image') {
     if(!trash||trash.kind!=='image'||trash.path!==path||!imageFields(path).includes(trash.field)||trash.until<=now())throw new ApiError(410,'Esta foto ya no se puede recuperar de la papelera.');
     if(body.trashRevision!==trash.revision)throw new ApiError(409,'La papelera cambió. Actualiza la lista.');
     if(!previous)throw new ApiError(404,'Restaura primero el elemento al que pertenece esta foto.');
     if(imageAt(path,previous,trash.field))throw new ApiError(409,'Este apartado ya tiene una imagen. Quítala antes de restaurar otra.');
     next=putImage(path,previous,trash.field,trash.data);
    } else if(body.action==='restore') {
     if(!trash || trash.until<=now()) throw new ApiError(410,'Terminó el plazo de 5 días para recuperar este elemento.');
     if(current) throw new ApiError(409,'El elemento ya fue restaurado.');
     next=trash.data;
    } else if(body.action==='version') {
     if(meta?.deletedAt && meta.deletedAt+TRASH_DAYS*86400000<=now()) throw new ApiError(410,'Terminó el plazo de recuperación.');
     if(!Number.isSafeInteger(body.version)||body.version<0) throw new ApiError(400,'Versión no válida.');
     const snapshot=(await tx.get(root.collection('versiones').doc(String(body.version)))).data();
     if(!snapshot?.data) throw new ApiError(404,'La versión ya no está disponible.');
     next=snapshot.data;
    } else if(['save','migrate'].includes(body.action)) {
     if(body.mustExist && !current) throw new ApiError(404,'El elemento fue eliminado.');
     if(trash && !current) throw new ApiError(409,'Restaura el elemento desde la papelera antes de editarlo.');
     next=body.merge?mergeContent(previous||{},patch):patch;
    } else if(!current) throw new ApiError(404,'El elemento ya no existe.');
    const isGallery=path.startsWith('galeria/');
    let lock,lockRef;
    if(isGallery) {
     lockRef=db.doc('sistema/galeriaEdicion');lock=(await tx.get(lockRef)).data();
     if(next && !current) {
      const active=await tx.get(db.collection('galeria').select('_revision').limit(GALLERY_LIMIT));
      if(active.size>=GALLERY_LIMIT) throw new ApiError(409,'La galería ya tiene 15 fotos. Envía alguna a la papelera para agregar otra.');
     }
    }
    if(next) checkDocument(path,next);
    const imageTrash=await tx.get(db.collection('papeleraContenido').where('path','==',path).limit(101));
    if(imageTrash.size>100)throw new ApiError(409,'Este apartado necesita una limpieza supervisada de la papelera antes de seguir editando.');
    if(body.action==='version')for(const entry of imageTrash.docs){const image=entry.data();if(image.kind==='image'&&image.until<=now()&&imageAt(path,next,image.field)===image.data)throw new ApiError(410,'Esta versión incluye una foto cuyo plazo de recuperación de 5 días terminó.');}
    const removed=previous&&next?imageFields(path).filter(field=>imageAt(path,previous,field)&&!imageAt(path,next,field)):[];
    // Como máximo cinco revisiones de contenido previas; todos los recursos son
    // referencias a imágenes inmutables, no copias base64 dentro del historial.
    const history=await tx.get(root.collection('versiones').orderBy('revision','desc').limit(10));
    if(previous) tx.set(root.collection('versiones').doc(String(revision)),{revision,data:previous,at:now(),actor:token.uid});
    const keep=previous?HISTORY_LIMIT-1:HISTORY_LIMIT;
    for(const entry of history.docs.slice(keep)) tx.delete(entry.ref);
    for(const [id,asset] of assets) {
     tx.set(db.doc(`imagenesPublicas/${id}`),{data:asset.data,bytes:asset.data.length,created:now()});
     tx.set(db.doc(`imagenesTrabajo/${id}`),{source:asset.source,settings:asset.settings,created:now()});
    }
    for(const field of removed){const label=({inicio:'Inicio',carta:'Carta',nosotros:'Nosotros',img1:'Imagen superior',img2:'Imagen inferior',quienesSomosImg:'Quiénes Somos',nuestraCartaImg:'Nuestra Carta','b1.img':'Bloque 1','b2.img':'Bloque 2','b3.img':'Bloque 3'}[field]||'Imagen');tx.set(db.doc(`papeleraContenido/${digest(`${path}#${field}#${revision+1}`)}`),{kind:'image',path,field,label:`${contentLabel(path,previous)} · ${label}`,data:imageAt(path,previous,field),revision:revision+1,deletedAt:now(),until:now()+TRASH_DAYS*86400000});}
    if(next)for(const entry of imageTrash.docs){const image=entry.data();if(image.kind==='image'&&imageAt(path,next,image.field)===image.data)tx.delete(entry.ref);}
    if(next) {tx.set(ref,{...next,_revision:revision+1});tx.delete(trashRef);}
    else {tx.delete(ref);tx.set(trashRef,{kind:'document',path,label:contentLabel(path,previous),data:previous,revision:revision+1,deletedAt:now(),until:now()+TRASH_DAYS*86400000});}
    tx.set(root,{path,label:contentLabel(path,next||previous),revision:revision+1,at:now(),actor:token.uid,actorLabel:token.email||token.uid,action:removed.length?'remove-image':body.action,deletedAt:next?null:now()});
    if(isGallery) tx.set(lockRef,{revision:(lock?.revision||0)+1});
    tx.set(serialRef,{revision:(serial?.revision||0)+1});
    result={revision:revision+1,data:next,message:next?'Contenido guardado.':'Enviado a la papelera durante 5 días.'};
   });
   return res.status(200).json(result);
  } catch(error) {return res.status(error.status||500).json({message:error.status?error.message:'No se pudo guardar. Tus cambios siguen en pantalla; revisa la conexión e intenta nuevamente.'});}
 };
}
