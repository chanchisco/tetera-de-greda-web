import { digest,imageAt,putImage } from './content-model.js';

// Quita solo la foto vencida: el resto de cada versión continúa recuperable.
export function scrubExpiredImages(path,data,expired) {
 let next=data;
 for(const item of expired){const image=item.data;if(image.kind==='image'&&image.path===path&&imageAt(path,next,image.field)===image.data)next=putImage(path,next,image.field,null);}
 return next;
}

export function retentionPlan(collections,versions,now) {
 const expired=collections.papeleraContenido.filter(item=>item.data.until<=now);
 const expiredIds=new Set(expired.map(item=>item.id));
 const deletedRoots=new Set(expired.filter(item=>item.data.kind!=='image').map(item=>digest(item.data.path)));
 const liveVersions=Object.entries(versions).filter(([id])=>!deletedRoots.has(id)).flatMap(([id,items])=>{
  const path=collections.historialContenido.find(item=>item.id===id)?.data.path;
  return items.map(item=>({...item,data:{...item.data,data:scrubExpiredImages(path,item.data.data,expired)}}));
 });
 const liveTrash=collections.papeleraContenido.filter(item=>!expiredIds.has(item.id)).map(item=>item.data.kind==='image'?item:{...item,data:{...item.data,data:scrubExpiredImages(item.data.path,item.data.data,expired)}});
 const liveData=[...['platos','bebidas','galeria','configuracion'].flatMap(name=>collections[name]),...liveTrash,...liveVersions];
 const references=new Set([...JSON.stringify(liveData).matchAll(/\/api\/imagen\?id=([a-f0-9]{64})/g)].map(match=>match[1]));
 const unused=collections.imagenesPublicas.filter(item=>!references.has(item.id)&&item.data.created<now-5*86400000);
 return {expired,unused};
}
