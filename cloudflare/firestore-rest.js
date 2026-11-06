// Adaptador del contrato usado por server/*.js a la API REST oficial de Firestore.
// Mantiene transacciones atómicas; nunca convierte escrituras en operaciones públicas.
import { randomUUID } from 'node:crypto';
export function encodeValue(value){
 if(value===null)return {nullValue:null};if(typeof value==='boolean')return {booleanValue:value};if(typeof value==='string')return {stringValue:value};
 if(typeof value==='number'&&Number.isFinite(value))return Number.isInteger(value)?{integerValue:String(value)}:{doubleValue:value};
 if(value instanceof Date)return {timestampValue:value.toISOString()};if(Array.isArray(value))return {arrayValue:{values:value.map(encodeValue)}};
 if(value&&Object.getPrototypeOf(value)===Object.prototype)return {mapValue:{fields:encodeFields(value)}};
 throw new Error('Tipo de dato no admitido en Firestore REST.');
}
const encodeFields=value=>Object.fromEntries(Object.entries(value).map(([key,item])=>[key,encodeValue(item)]));
export function decodeValue(value){if('nullValue'in value)return null;if('booleanValue'in value)return value.booleanValue;if('stringValue'in value)return value.stringValue;if('integerValue'in value)return Number(value.integerValue);if('doubleValue'in value)return value.doubleValue;if('timestampValue'in value)return new Date(value.timestampValue);if(value.arrayValue)return (value.arrayValue.values||[]).map(decodeValue);if(value.mapValue)return decodeFields(value.mapValue.fields);if('referenceValue'in value)return value.referenceValue;throw new Error('Tipo de Firestore no admitido.');}
const decodeFields=fields=>Object.fromEntries(Object.entries(fields||{}).map(([key,value])=>[key,decodeValue(value)]));
const codes={ABORTED:10,RESOURCE_EXHAUSTED:8,NOT_FOUND:5,ALREADY_EXISTS:6,PERMISSION_DENIED:7,UNAUTHENTICATED:16,FAILED_PRECONDITION:9,UNAVAILABLE:14,DEADLINE_EXCEEDED:4};
export function createRestFirestore({projectId,getAccessToken,endpoint='https://firestore.googleapis.com/v1',fetcher=fetch}){
 if(!/^[\w-]+$/.test(projectId))throw new Error('Proyecto no válido.');
 const database=`projects/${projectId}/databases/(default)`,root=`${database}/documents`;
 const clean=path=>{if(typeof path!=='string'||path.split('/').some(part=>!part||part==='.'||part==='..'))throw new Error('Ruta no válida.');return path;};
 const name=path=>`${root}/${clean(path)}`;
 async function call(path,body,method='POST'){
  // Google distingue el sufijo RPC literal (:runQuery) de un carácter dentro
  // del nombre de documento. Codificar el separador como %3A devuelve 404.
  const action=/:(batchGet|runQuery|commit|beginTransaction|rollback)$/.exec(path);
  const resource=action?path.slice(0,-action[0].length):path;
  const encoded=resource.split('/').map(encodeURIComponent).join('/')+(action?action[0]:'');
  const token=await getAccessToken();const response=await fetcher(`${endpoint}/${encoded}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  const value=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(new Error(value.error?.message||'Firestore no disponible.'),{code:codes[value.error?.status]||response.status});return value;
 }
 function snap(path,record){return {id:path.split('/').at(-1),ref:doc(path),exists:!!record,data:()=>record?decodeFields(record.fields):undefined};}
 async function batchGet(refs,transaction){const values=await call(`${root}:batchGet`,{documents:refs.map(ref=>name(ref.path)),...(transaction?{transaction}:{})});const byName=new Map(values.filter(item=>item.found).map(item=>[item.found.name,item.found]));return refs.map(ref=>snap(ref.path,byName.get(name(ref.path))));}
 async function queryGet(ref,transaction){const parts=ref.path.split('/'),collectionId=parts.pop(),parent=parts.length?`${root}/${parts.join('/')}`:root;
  const structuredQuery={from:[{collectionId}]};
  const filters=(ref.filters||[]).map(([field,op,value])=>{if(op!=='==')throw new Error('Operador no admitido.');return {fieldFilter:{field:{fieldPath:field},op:'EQUAL',value:encodeValue(value)}};});if(filters.length)structuredQuery.where=filters.length===1?filters[0]:{compositeFilter:{op:'AND',filters}};
  if(ref.orders?.length)structuredQuery.orderBy=ref.orders.map(([field,direction])=>({field:{fieldPath:field},direction:direction==='desc'?'DESCENDING':'ASCENDING'}));
  if(ref.max!==undefined)structuredQuery.limit=ref.max;if(ref.selected)structuredQuery.select={fields:ref.selected.map(fieldPath=>({fieldPath}))};
  if(ref.after!==undefined){if(ref.orders?.[0]?.[0]!=='__name__')throw new Error('Cursor no admitido.');structuredQuery.startAt={values:[{referenceValue:name(`${ref.path}/${ref.after}`)}],before:false};}
  const result=await call(`${parent}:runQuery`,{structuredQuery,...(transaction?{transaction}:{})});const docs=result.filter(item=>item.document).map(item=>snap(item.document.name.slice(root.length+1),item.document));return {docs,size:docs.length,empty:!docs.length,forEach:fn=>docs.forEach(fn)};
 }
 function query(path,options={}){return {path:clean(path),...options,where(field,op,value){return query(path,{...options,filters:[...(options.filters||[]),[field,op,value]]});},orderBy(field,direction='asc'){return query(path,{...options,orders:[...(options.orders||[]),[field,direction]]});},limit(max){return query(path,{...options,max});},select(...selected){return query(path,{...options,selected});},startAfter(after){return query(path,{...options,after});},doc(id=randomUUID().replaceAll('-','')){return doc(`${path}/${id}`);},get(){return queryGet(this);}};}
 function write(ref,data,update=false,merge=false){return {update:{name:name(ref.path),fields:encodeFields(data)},...((update||merge)?{updateMask:{fieldPaths:Object.keys(data).map(key=>'`'+key.replaceAll('`','\\`')+'`')}}:{}),...(update?{currentDocument:{exists:true}}:{})};}
 const commit=writes=>call(`${root}:commit`,{writes});
 function doc(path){clean(path);return {path,collection:child=>query(`${path}/${child}`),async get(){return (await batchGet([this]))[0];},set(data,options={}){return commit([write(this,data,false,options.merge)]);},update(data){return commit([write(this,data,true)]);},delete(){return commit([{delete:name(path)}]);}};}
 async function runTransaction(fn){
  for(let attempt=0;attempt<3;attempt++){
   const {transaction}=await call(`${root}:beginTransaction`,{options:{readWrite:{}}});const writes=[];
   const tx={async get(ref){if(writes.length)throw new Error('Todas las lecturas deben preceder a las escrituras.');return ref.where?queryGet(ref,transaction):(await batchGet([ref],transaction))[0];},set(ref,data,options={}){writes.push(write(ref,data,false,options.merge));},update(ref,data){writes.push(write(ref,data,true));},delete(ref){writes.push({delete:name(ref.path)});}};
   try{const result=await fn(tx);await call(`${root}:commit`,{writes,transaction});return result;}
   catch(error){await call(`${root}:rollback`,{transaction}).catch(()=>{});if(error.code!==10||attempt===2)throw error;await new Promise(resolve=>setTimeout(resolve,25*2**attempt));}
  }
 }
 return {doc,collection:path=>query(path),getAll:(...refs)=>batchGet(refs),runTransaction};
}
