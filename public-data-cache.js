export function validCatalog(value){return value?.version===1&&Number.isFinite(value.generatedAt)&&value.data&&Array.isArray(value.data.platos)&&Array.isArray(value.data.bebidas)&&Array.isArray(value.data.galeria)&&value.data.configuracion&&typeof value.data.configuracion==='object';}
export function createPublicLoader({fetchData,readSaved,writeSaved,onStale=()=>{},transform=value=>value,now=Date.now,ttl=600000,maxStale=86400000}){
 let memory,pending,blockedUntil=0;
 async function get(){
  if(memory)return memory;if(pending)return pending;
  pending=(async()=>{const candidate=readSaved(),old=validCatalog(candidate)?candidate:null;if(old&&now()-old.generatedAt<ttl)return (memory=old);try{if(now()<blockedUntil)throw new Error('Reintento en pausa.');const value=await fetchData();if(!validCatalog(value))throw new Error('Respuesta no válida.');memory=transform(value);try{writeSaved(memory);}catch{}return memory;}catch(error){blockedUntil=now()+120000;if(old&&now()-old.generatedAt<maxStale){onStale(old);return (memory=old);}throw error;}})();
  try{return await pending;}finally{pending=null;}
 }
 return {get};
}
