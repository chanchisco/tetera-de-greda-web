export function planOrderUpdates(items,ids,now=Date.now()){
 const byId=new Map(items.map(item=>[item.id,item]));const visible=ids.filter(id=>byId.has(id));const orders=visible.map(id=>byId.get(id).orden??now).sort((a,b)=>a-b);const values=new Set(orders).size===orders.length?orders:visible.map((_,index)=>now+index*100);
 return visible.flatMap((id,index)=>byId.get(id).orden===values[index]?[]:[{id,orden:values[index]}]);
}
// Caché de sesión. No contiene permisos ni sustituye las revisiones del servidor.
export function createContentStore({loadCollection,loadDocument,makeRef,now=Date.now,ttl=120000}) {
 const lists=new Map(),docs=new Map(),pending=new Map(),changes=new Map();let epoch=0,session=0;
 const stats={collectionLoads:0,documentLoads:0,cacheHits:0};
 function snapshot(path,data){return {id:path.split('/').at(-1),ref:makeRef(path),exists:()=>data!==undefined,data:()=>data===undefined?undefined:structuredClone(data)};}
 function collectionSnapshot(path,values){const items=[...values].map(([id,data])=>snapshot(`${path}/${id}`,data));items.sort((a,b)=>(Number(a.data()?.orden)||0)-(Number(b.data()?.orden)||0)||a.id.localeCompare(b.id));return {docs:items,size:items.length,empty:!items.length,forEach:fn=>items.forEach(fn)};}
 function set(path,data){const value=data===undefined?undefined:structuredClone(data);changes.set(path,{epoch:++epoch,data:value});docs.set(path,{data:value,at:now()});const split=path.lastIndexOf('/'),list=lists.get(path.slice(0,split));if(list){if(value===undefined)list.values.delete(path.slice(split+1));else list.values.set(path.slice(split+1),value);}}
 async function getCollection(path,{fresh=false,preferCache=false}={}){
  const old=lists.get(path);if(old&&!fresh&&(preferCache||now()-old.at<ttl)){stats.cacheHits++;return collectionSnapshot(path,old.values);}
  const key=`list:${path}`;if(pending.has(key))return pending.get(key);
  const start=epoch,scope=session;
  const task=(async()=>{stats.collectionLoads++;const result=await loadCollection(path);if(scope!==session)throw new Error('La sesión cambió.');const values=new Map(result.docs.map(d=>[d.id,d.data()]));for(const [name,change]of changes)if(change.epoch>start&&name.slice(0,name.lastIndexOf('/'))===path){const id=name.split('/').at(-1);if(change.data===undefined)values.delete(id);else values.set(id,change.data);}lists.set(path,{values,at:now()});for(const [id,data]of values)docs.set(`${path}/${id}`,{data,at:now()});return collectionSnapshot(path,values);})();
  pending.set(key,task);try{return await task;}finally{if(pending.get(key)===task)pending.delete(key);}
 }
 async function getDocument(path,{fresh=false,preferCache=false}={}){
  const old=docs.get(path);if(old&&!fresh&&(preferCache||now()-old.at<ttl)){stats.cacheHits++;return snapshot(path,old.data);}
  const key=`doc:${path}`;if(pending.has(key))return pending.get(key);
  const start=epoch,scope=session;
  const task=(async()=>{stats.documentLoads++;const result=await loadDocument(path);if(scope!==session)throw new Error('La sesión cambió.');const change=changes.get(path),data=change?.epoch>start?change.data:result.data();docs.set(path,{data,at:now()});return snapshot(path,data);})();
  pending.set(key,task);try{return await task;}finally{if(pending.get(key)===task)pending.delete(key);}
 }
 function invalidate(path){docs.delete(path);const collection=path.slice(0,path.lastIndexOf('/'));lists.delete(collection);}
 function clear(){session++;epoch++;lists.clear();docs.clear();pending.clear();changes.clear();}
 function exportData(){const data={platos:[],bebidas:[],galeria:[],configuracion:{}};for(const name of ['platos','bebidas','galeria'])for(const [id,value]of lists.get(name)?.values||[])data[name].push({id,data:structuredClone(value)});for(const [path,entry]of docs)if(path.startsWith('configuracion/')&&entry.data!==undefined)data.configuracion[path.split('/')[1]]=structuredClone(entry.data);return data;}
 return {getCollection,getDocument,set,invalidate,clear,exportData,stats};
}
