import { db,auth } from './firebase-config.js';
import { doc,collection } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { contentRequest,getDoc,getDocs,setDoc,forgetRevisions,pinRevision,unpinRevision } from './content-client.js';
import { editImage,downloadImage } from './image-editor.js';
import { ask } from './admin-management.js';
import { siteConfig } from './site-config.js';
const $=id=>document.getElementById(id),pending=new Map(),dirty=new Set();
const boundSources=new WeakMap();
let qrSvg='',qrPng='',featuredLoaded=false;
const date=value=>new Date(value).toLocaleString('es-CL');
function feedback(id,text,error=false){const el=$(id);if(el){el.textContent=text;el.dataset.error=String(error);}}
function toolbarButton(text,action){const button=document.createElement('button');button.type='button';button.className='content-action';button.textContent=text;button.onclick=async()=>{button.disabled=true;try{await action();}catch(e){showError(e);}finally{button.disabled=false;}};return button;}
function showError(error){feedback('content-global-status',error.message||'No se pudo completar la operación. Conserva tus cambios e intenta nuevamente.',true);$('content-global-status')?.scrollIntoView({block:'nearest'});}
const previewFor=prefix=>$(prefix==='qs'||prefix==='nc'?`${prefix}-img-img`:`${prefix}-img`);
function imagePath(prefix){if(prefix.startsWith('portada-'))return 'configuracion/portadas';if(prefix.startsWith('menudia-'))return 'configuracion/menuDia';if(['qs','nc'].includes(prefix))return 'configuracion/imagenesSeccion';if(prefix.startsWith('hist-img'))return 'configuracion/historia';if(prefix.startsWith('galeria-'))return `galeria/${prefix.slice(8)}`;if(prefix==='plato'&&$('plato-id').value)return `platos/${$('plato-id').value}`;}
function cardPath(card){if(!card)return;if(card.contains($('plato-form'))&&$('plato-id').value)return `platos/${$('plato-id').value}`;if(card.contains($('bebida-form'))&&$('bebida-id').value)return `bebidas/${$('bebida-id').value}`;if(card.querySelector('[id^="portada-"]'))return 'configuracion/portadas';if(card.closest('#page-menudia'))return 'configuracion/menuDia';if(card.querySelector('#qs-texto,#nc-titulo'))return 'configuracion/imagenesSeccion';if(card.matches('[id^="hist-card-"]')||card.querySelector('#hist-blocks'))return 'configuracion/historia';if(card.querySelector('#galeria-contenedor'))return 'configuracion/galeriaOpciones';if(card.contains($('featured-enabled')))return 'configuracion/destacados';}
export function canReplaceForm(id){const form=$(id),card=form?.closest('.card');if(!dirty.has(card)&&!(id==='plato-form'&&dirty.has('plato-form')))return true;if(!confirm('Hay cambios pendientes. ¿Descartarlos para cargar el formulario?'))return false;const path=cardPath(card);if(path)unpinRevision(path);dirty.delete(card);dirty.delete('plato-form');document.dispatchEvent(new Event('content-dirty'));return true;}
export const pendingImage=prefix=>pending.get(prefix)?.image;
function removedImage(prefix,data){if(!data)return false;if(prefix==='qs')return data.quienesSomosImg===null;if(prefix==='nc')return data.nuestraCartaImg===null;if(prefix.startsWith('portada-'))return data[prefix.slice(8)]===null;if(prefix.startsWith('menudia-'))return data[prefix.slice(8)]===null;if(/^hist-img[123]$/.test(prefix))return data['b'+prefix.at(-1)]?.img===null;return false;}
export function stageImage(prefix,image,save) {
 const img=previewFor(prefix);if(!img)throw new Error('No se encontró la vista previa de esta imagen.');
 const original=pending.get(prefix)?.original||img.getAttribute('src')||'';
 pending.set(prefix,{image,save,original});dirty.add(prefix);
 const path=imagePath(prefix);if(path)pinRevision(path);
 img.src=image;img.classList.remove('hidden');const no=img.parentElement.querySelector('.no-img-text');if(no)no.classList.add('hidden');
 attachToolbar(img,prefix,Number(img.dataset.editorRatio)||4/3,save);
 document.dispatchEvent(new Event('content-dirty'));
}
function attachToolbar(img,prefix,ratio,save,plato=false) {
 if(!img.isConnected)return;
 let bar=img.parentElement.parentElement.querySelector(`.image-toolbar[data-image="${prefix}"]`);
 if(!bar){bar=document.createElement('div');bar.className='image-toolbar';bar.dataset.image=prefix;if(prefix.startsWith('galeria-'))img.after(bar);else img.parentElement.after(bar);}
 bar.replaceChildren();
 const source=()=>img.getAttribute('src');
 bar.append(toolbarButton('Editar imagen',async()=>{if(!source())return;const path=imagePath(prefix);if(path)pinRevision(path);const result=await editImage(source(),ratio,prefix);if(result){if(plato){window.actualizarFotoPlato(result);dirty.add('plato-form');document.dispatchEvent(new Event('content-dirty'));}else stageImage(prefix,result,save);}}),toolbarButton('Descargar',()=>{if(source())downloadImage(source());}));
 if(source()?.includes('/api/imagen?id='))bar.append(toolbarButton('Descargar imagen de trabajo',async()=>{const id=new URL(source(),location.origin).searchParams.get('id');const result=await contentRequest(null,`?mode=source&id=${encodeURIComponent(id)}`);downloadImage(result.source,'imagen-trabajo.jpg');}));
 if(pending.has(prefix)) {
  bar.append(toolbarButton('Guardar imagen',async()=>{const draft=pending.get(prefix);await draft.save(prefix,draft.image);pending.delete(prefix);dirty.delete(prefix);attachToolbar(img,prefix,ratio,save);feedback('content-global-status','Imagen guardada.');document.dispatchEvent(new Event('content-dirty'));}),toolbarButton('Cancelar cambio',()=>{const draft=pending.get(prefix);img.src=draft.original;img.classList.toggle('hidden',!draft.original);pending.delete(prefix);dirty.delete(prefix);attachToolbar(img,prefix,ratio,save);document.dispatchEvent(new Event('content-dirty'));}));
 }
 bar.hidden=!source();
}
export function bindImageTools(img,prefix,ratio,save,plato=false){if(!img)return;if(!img.id)img.id=`${prefix}-img`;img.dataset.editorRatio=String(ratio);if(img.parentElement?.classList.contains('preview-box')){const box=img.parentElement;box.style.aspectRatio=String(ratio);box.style.height='auto';img.style.position='absolute';img.style.inset='0';}attachToolbar(img,prefix,ratio,save,plato);}
const definitions=[
 ['portada-inicio',16/9,()=>window.guardarPortada],['portada-carta',16/9,()=>window.guardarPortada],['portada-nosotros',16/9,()=>window.guardarPortada],
 ['menudia-img1',4/3,()=>window.guardarMenuDiaImg],['menudia-img2',4/3,()=>window.guardarMenuDiaImg],
 ['qs',4/3,()=>window.guardarQuienesSomos],['nc',4/3,()=>window.guardarNuestraCarta],
 ...[1,2,3].map(i=>[`hist-img${i}`,4/3,()=> (_prefix,image)=>window.guardarHistoriaImgSolo(i,image)])
];
export function updateMetrics(platos,bebidas,galeria) {
 const list=platos.docs.map(d=>({id:d.id,...d.data()}));
 const missing=list.filter(p=>!p.imagenBase64&&!p.imagenURL).length,hidden=list.filter(p=>p.disponible===false).length;
 const details=list.filter(p=>!String(p.descripcion||'').trim()).length,offers=list.filter(p=>p.oferta&&!/\d/.test(p.ofertaPrecio||'')).length;
 let panel=$('content-metrics');if(!panel){panel=document.createElement('div');panel.id='content-metrics';panel.className='content-metrics';$('page-inicio').append(panel);}
 panel.replaceChildren();
 for(const [value,label]of [[missing,'Platos sin foto'],[hidden,'Platos ocultos'],[details,'Sin descripción'],[offers,'Ofertas por revisar'],[`${galeria.size} / 15`,'Fotos de galería']]){
  const item=document.createElement('div');item.className='content-metric';const number=document.createElement('strong');number.textContent=value;item.append(number,document.createTextNode(label));
  if(label==='Platos sin foto')item.append(toolbarButton('Ver platos',()=>{window.filtroSinFoto=true;window.irA('platos');window.filtrarListaPlatos?.();}),toolbarButton('Mostrar todos',()=>window.verTodosLosPlatos?.()));
  if(label==='Fotos de galería'){const remaining=document.createElement('p');remaining.textContent=`Puedes agregar ${Math.max(0,15-galeria.size)} más.`;const meter=document.createElement('meter');meter.min=0;meter.max=15;meter.value=galeria.size;meter.setAttribute('aria-label','Fotos guardadas fuera de la papelera');meter.style.width='100%';item.append(remaining,meter);}
  panel.append(item);
 }
 let fields=$('featured-fields');
 if(fields && !fields.children.length){for(let i=0;i<3;i++){const label=document.createElement('label');label.textContent=`Plato destacado ${i+1}`;label.htmlFor=`featured-${i}`;const select=document.createElement('select');select.id=label.htmlFor;const empty=new Option('Sin selección','');select.append(empty);for(const p of list)if(p.disponible!==false)select.append(new Option(p.nombre,p.id));fields.append(label,select);}loadFeatured().catch(showError);}
 else if(fields){for(let i=0;i<3;i++){const select=$(`featured-${i}`),selected=select.value;select.replaceChildren(new Option('Sin selección',''));for(const p of list)if(p.disponible!==false)select.append(new Option(p.nombre,p.id));select.value=selected;}}
}
async function loadFeatured(){const snapshot=await getDoc(doc(db,'configuracion','destacados')),value=snapshot.data()||{};$('featured-enabled').checked=!!value.habilitado;for(let i=0;i<3;i++)if($(`featured-${i}`))$(`featured-${i}`).value=value.platos?.[i]||'';featuredLoaded=true;}
async function refreshHistory(){
 feedback('history-feedback','Cargando historial y papelera…');
 const [recent,trash]=await Promise.all([contentRequest(null,'?mode=recent'),contentRequest(null,'?mode=trash')]);
 $('content-history').replaceChildren();$('content-trash').replaceChildren();
 for(const item of trash.items){const row=document.createElement('div');row.className='content-row';const title=document.createElement('p');title.textContent=`${item.label} · Recuperable hasta ${date(item.until)}`;row.append(title,toolbarButton('Restaurar',async()=>{if(!await ask({title:'Restaurar contenido',text:`Volverá a publicarse ${item.label}.`,submit:'Restaurar'}))return;await contentRequest({action:item.kind==='image'?'restore-image':'restore',path:item.path,revision:item.revision,trashKey:item.id,trashRevision:item.revision});forgetRevisions();await refreshHistory();feedback('history-feedback','Restaurado. Actualiza el apartado para ver el contenido.');}));$('content-trash').append(row);}
 for(const item of recent.items){const row=document.createElement('div');row.className='content-row';const title=document.createElement('p');title.textContent=`${item.label} · ${date(item.at)} · ${item.actorLabel||item.actor} · ${item.action==='delete'?'En papelera':item.action==='version'?'Versión restaurada':'Actualizado'}`;
  const versions=document.createElement('div');row.append(title,toolbarButton('Ver versiones',async()=>{
   const result=await contentRequest(null,`?mode=history&path=${encodeURIComponent(item.path)}`);versions.replaceChildren();
   if(!result.items.length)versions.textContent='No hay versiones anteriores recuperables.';
   for(const version of result.items){const detail=document.createElement('p');detail.textContent=`Versión ${version.revision} · ${date(version.at)} · ${version.data.nombre||item.label}`;versions.append(detail,toolbarButton('Restaurar esta versión',async()=>{if(!await ask({title:'Restaurar versión anterior',text:`Se publicará la versión ${version.revision} de ${item.label}. El estado actual quedará en el historial.`,submit:'Restaurar versión'}))return;await contentRequest({action:'version',path:item.path,revision:item.revision,version:version.revision});forgetRevisions();await refreshHistory();feedback('history-feedback','Versión restaurada. Actualiza el apartado para verla.');}));}
  }),versions);$('content-history').append(row);
 }
 if(!trash.items.length)$('content-trash').textContent='La papelera está vacía. Los elementos borrados se conservan 5 días.';
 if(!recent.items.length)$('content-history').textContent='Los cambios se registrarán desde que comiences a guardar con esta versión.';
 feedback('history-feedback','Historial actualizado.');
}
function saveFile(data,name,type){const url=URL.createObjectURL(new Blob([data],{type}));downloadImage(url,name);setTimeout(()=>URL.revokeObjectURL(url),10000);}
export function initContentTools(){
 const status=document.createElement('p');status.id='content-global-status';status.className='content-feedback';status.setAttribute('role','status');document.querySelector('.content').prepend(status);
 const clearMissing=toolbarButton('Mostrar todos los platos',()=>{window.verTodosLosPlatos?.();clearMissing.hidden=true;});clearMissing.id='content-clear-missing';clearMissing.hidden=true;$('platos-search').parentElement.before(clearMissing);
 const dirtyNote=document.createElement('p');dirtyNote.className='content-dirty';dirtyNote.hidden=true;dirtyNote.textContent='Hay cambios pendientes. Guarda el apartado antes de cerrar.';status.after(dirtyNote);
 document.addEventListener('content-dirty',()=>dirtyNote.hidden=dirty.size===0);
 document.addEventListener('plato-image-changed',()=>{dirty.add('plato-form');document.dispatchEvent(new Event('content-dirty'));});
 document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(['plato-cancel','bebida-cancel'].includes(button.id)||(button.textContent.trim()==='Restaurar'&&!button.closest('#page-historial'))){const card=button.closest('.card'),path=cardPath(card);if(path)unpinRevision(path);for(const [prefix,draft]of pending){const img=previewFor(prefix);if(card?.contains(img)){img.src=draft.original;pending.delete(prefix);dirty.delete(prefix);attachToolbar(img,prefix,Number(img.dataset.editorRatio)||4/3,draft.save);}}dirty.delete(card);dirty.delete('plato-form');document.dispatchEvent(new Event('content-dirty'));}},true);
 document.addEventListener('input',e=>{if(e.target.closest('#panel-root')&&e.target.type!=='file'&&!e.target.id.includes('search')&&e.target.closest('.card')){const card=e.target.closest('.card'),path=cardPath(card);if(path)pinRevision(path);dirty.add(card);document.dispatchEvent(new Event('content-dirty'));}});
 window.addEventListener('beforeunload',e=>{if(dirty.size){e.preventDefault();e.returnValue='';}});
 document.addEventListener('content-saved',e=>{const path=e.detail.path,input=JSON.stringify(e.detail.inputData||{});if(path.startsWith('platos/'))dirty.delete('plato-form');for(const [prefix,draft]of pending)if(input.includes(draft.image)||(e.detail.action==='delete'&&imagePath(prefix)===path)||removedImage(prefix,e.detail.inputData)){pending.delete(prefix);dirty.delete(prefix);const img=previewFor(prefix);if(img)attachToolbar(img,prefix,Number(img.dataset.editorRatio)||4/3,draft.save);}for(const item of dirty)if(item instanceof Element&&((path.startsWith('platos/')&&item.contains($('plato-form')))||(path.startsWith('bebidas/')&&item.contains($('bebida-form')))||(path.startsWith('configuracion/')&&item.contains(document.activeElement))))dirty.delete(item);document.dispatchEvent(new Event('content-dirty'));feedback('content-global-status','Cambios guardados.');});
 window.addEventListener('unhandledrejection',e=>{showError(e.reason||new Error('No se pudo completar la operación.'));});
 let scheduled=false;
 const bind=()=>{scheduled=false;for(const [prefix,ratio,save]of definitions){const image=previewFor(prefix);if(image&&(!boundSources.has(image)||boundSources.get(image)!==image.getAttribute('src'))){boundSources.set(image,image.getAttribute('src'));bindImageTools(image,prefix,ratio,(p,src)=>save()(p,src));}}const image=$('plato-img-current');if(image&&(!boundSources.has(image)||boundSources.get(image)!==image.getAttribute('src'))){boundSources.set(image,image.getAttribute('src'));bindImageTools(image,'plato',4/3,()=>{},true);}};
 const panelRoot=$('panel-root');if(panelRoot)new MutationObserver(()=>{if(!scheduled){scheduled=true;queueMicrotask(bind);}}).observe(panelRoot,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});bind();
 $('refresh-content-history').onclick=()=>refreshHistory().catch(showError);
 const migrate=toolbarButton('Preparar carga ligera de fotos existentes',async()=>{
  const profile=await contentRequest(null,'?mode=recent');if(profile.role!=='completo')throw new Error('Esta preparación la realiza un administrador completo.');
  if(!await ask({title:'Preparar las fotos existentes',text:'Primero descarga un respaldo de contenido. Se separarán las fotos de los textos para cargar la carta de forma progresiva, conservando su apariencia. Los cambios quedarán registrados.',submit:'Preparar imágenes'}))return;
  const snapshots=[];for(const name of ['platos','bebidas','galeria'])snapshots.push(...(await getDocs(collection(db,name))).docs);
  for(const name of ['portadas','menuDia','imagenesSeccion','historia','galeriaOpciones']){const value=await getDoc(doc(db,'configuracion',name));if(value.exists())snapshots.push(value);}
  let count=0;for(const snapshot of snapshots){const data=snapshot.data();if(!JSON.stringify(data).includes('data:image/'))continue;feedback('history-feedback',`Preparando ${snapshot.ref.path}…`);await contentRequest({action:'migrate',path:snapshot.ref.path,revision:data._revision||0,data});count++;}
  forgetRevisions();feedback('history-feedback',`Preparación completada: ${count} elementos. Las siguientes visitas cargarán las fotos por separado.`);
 });$('refresh-content-history').parentElement.append(migrate);
 document.querySelector('[data-page="historial"]').addEventListener('click',()=>refreshHistory().catch(showError));
 $('content-backup').onclick=async e=>{e.target.disabled=true;try{const backup={format:'tetera-content-v1',at:Date.now(),collections:{}};for(const name of ['platos','bebidas','galeria','configuracion','imagenesPublicas','imagenesTrabajo']){backup.collections[name]=[];let after;do{feedback('history-feedback',`Preparando respaldo: ${name} · ${backup.collections[name].length} elementos…`);const page=await contentRequest(null,`?mode=backup&collection=${name}${after?`&after=${encodeURIComponent(after)}`:''}`);backup.collections[name].push(...page.items);after=page.next;}while(after);}saveFile(JSON.stringify(backup,null,2),`tetera-contenido-${new Date().toISOString().slice(0,10)}.json`,'application/json');feedback('history-feedback','Respaldo descargado. Guárdalo de forma privada; incluye imágenes de trabajo.');}catch(error){showError(error);}finally{e.target.disabled=false;}};
 $('save-featured').onclick=async e=>{e.target.disabled=true;try{if(!featuredLoaded)throw new Error('Espera a que carguen los platos.');const ids=[0,1,2].map(i=>$(`featured-${i}`).value).filter(Boolean);if(new Set(ids).size!==ids.length)throw new Error('Selecciona platos distintos.');const enabled=$('featured-enabled').checked;await setDoc(doc(db,'configuracion','destacados'),{habilitado:enabled,platos:ids,titulo:'Recomendados de la casa'});if($('featured-enabled').checked===enabled&&JSON.stringify([0,1,2].map(i=>$(`featured-${i}`).value).filter(Boolean))===JSON.stringify(ids)){dirty.delete($('featured-enabled').closest('.card'));document.dispatchEvent(new Event('content-dirty'));}feedback('featured-feedback','Destacados guardados.');}catch(error){feedback('featured-feedback',error.message,true);}finally{e.target.disabled=false;}};
 $('qr-url').value=new URL('/carta.html',siteConfig.publicOrigin).href;
 $('generate-qr').onclick=async e=>{e.target.disabled=true;try{const {default:QR}=await import('./qr-code.js');const value=$('qr-url').value;qrSvg=await QR.toString(value,{type:'svg',margin:4,errorCorrectionLevel:'M'});qrPng=await QR.toDataURL(value,{margin:4,width:1000,errorCorrectionLevel:'M'});$('qr-preview').innerHTML=qrSvg;$('qr-preview').querySelector('svg').style.width='240px';for(const id of ['download-qr-svg','download-qr-png','print-qr'])$(id).disabled=false;feedback('qr-feedback','QR generado. Actualizar los platos no cambia este enlace.');}catch{feedback('qr-feedback','No se pudo generar el QR. Reintenta.',true);}finally{e.target.disabled=false;}};
 $('download-qr-svg').onclick=()=>saveFile(qrSvg,'carta-tetera.svg','image/svg+xml');$('download-qr-png').onclick=()=>downloadImage(qrPng,'carta-tetera.png');
 $('print-qr').onclick=()=>{let area=$('qr-print-area');if(!area){area=document.createElement('section');area.id='qr-print-area';area.style.display='none';document.body.append(area);}area.className='qr-printing';area.innerHTML=qrSvg;const heading=document.createElement('h1');heading.textContent='La Tetera de Greda';area.prepend(heading);const p=document.createElement('p');p.textContent=`Escanea para ver nuestra carta\n${$('qr-url').value}`;area.append(p);window.print();};
}
