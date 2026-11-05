// Contrato público explícito: no exportar permisos, historial ni fuentes de trabajo.
const fields={platos:['nombre','precio','descripcion','categoria','imagenBase64','imagenURL','imagenPos','oferta','ofertaEtiqueta','ofertaPrecio','disponible','etiquetas','orden'],bebidas:['nombre','precio','categoria','subcategoria','orden','disponible','etiquetas'],galeria:['url','descripcion','orden','ts','disponible']};
const configs={portadas:['inicio','carta','nosotros'],menuDia:['img1','img2','incluye','acompanamientos','precioServir','precioLlevar'],imagenesSeccion:['quienesSomosImg','quienesSomosTexto','quienesSomosHabilitado','nuestraCartaImg','nuestraCartaTitulo','nuestraCartaHabilitado'],galeriaOpciones:['habilitado'],destacados:['habilitado','platos','titulo']};
export const publicConfigIds=['portadas','menuDia','imagenesSeccion','historia','galeriaOpciones','destacados'];
const pick=(value={},names=[])=>Object.fromEntries(names.filter(key=>value[key]!==undefined).map(key=>[key,structuredClone(value[key])]));
export function sanitizeCatalog(input,transformImage=value=>value){
 const result={platos:[],bebidas:[],galeria:[],configuracion:{}};
 function images(value,path,field=''){if(typeof value==='string'&&value.startsWith('data:image/'))return transformImage(value,path,field);if(value&&typeof value==='object'&&!Array.isArray(value))return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,images(item,path,field?`${field}.${key}`:key)]));return value;}
 for(const name of Object.keys(fields))result[name]=(input[name]||[]).filter(item=>item.data?.disponible!==false).map(item=>({id:item.id,data:images(pick(item.data,fields[name]),`${name}/${item.id}`)})).sort((a,b)=>(Number(a.data.orden)||0)-(Number(b.data.orden)||0)||a.id.localeCompare(b.id));
 for(const id of publicConfigIds){const value=input.configuracion?.[id];if(!value)continue;const data=id==='historia'?Object.fromEntries(['b1','b2','b3'].filter(key=>value[key]).map(key=>[key,pick(value[key],['img','tit','txt','habilitado'])])):pick(value,configs[id]);result.configuracion[id]=images(data,`configuracion/${id}`);}
 return result;
}
