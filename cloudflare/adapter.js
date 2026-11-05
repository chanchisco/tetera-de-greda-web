const MAX_BODY=3800000;
export async function adaptHandler(handler,request){
 const headers=new Headers();let status=200,body=null;
 const response={setHeader(name,value){headers.set(name,String(value));},status(value){status=value;return this;},json(value){headers.set('Content-Type','application/json; charset=utf-8');body=JSON.stringify(value);return this;},end(value){body=value??null;return this;}};
 let data;
 if(!['GET','HEAD'].includes(request.method)){
  const size=Number(request.headers.get('Content-Length')||0);if(size>MAX_BODY)return Response.json({message:'Guarda una imagen a la vez: solicitud demasiado grande.'},{status:413,headers:{'Cache-Control':'no-store'}});
  const reader=request.body?.getReader(),chunks=[];let length=0;
  if(reader)while(true){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>MAX_BODY){await reader.cancel();return Response.json({message:'Guarda una imagen a la vez: solicitud demasiado grande.'},{status:413,headers:{'Cache-Control':'no-store'}});}chunks.push(part.value);}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}data=new TextDecoder().decode(bytes);
 }
 await handler({method:request.method,url:request.url,headers:Object.fromEntries(request.headers),body:data},response);
 return new Response(request.method==='HEAD'?null:body,{status,headers});
}
