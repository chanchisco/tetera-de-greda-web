const search=document.querySelector('.search-bar-wrap');
if(search){
 const wrap=document.createElement('div');wrap.className='carta-search-sticky';search.before(wrap);wrap.append(search);
 const field=search.querySelector('input');field?.setAttribute('aria-label','Buscar plato o ingrediente');
 const button=document.createElement('button');button.className='back-to-top';button.type='button';
 const icon=document.createElement('i');icon.className='fa-solid fa-angles-up';icon.setAttribute('aria-hidden','true');
 button.append(icon,document.createTextNode('Volver arriba'));button.title='Volver al inicio de la carta y sus filtros';button.hidden=true;
 button.onclick=()=>{const start=search.closest('.menu-section');const top=start?Math.max(0,start.getBoundingClientRect().top+window.scrollY):0;window.scrollTo({top,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};document.body.append(button);
 const update=()=>button.hidden=window.scrollY<window.innerHeight;window.addEventListener('scroll',update,{passive:true});update();
}
// Carga anticipada por el navegador: las primeras tarjetas son inmediatas.
let count=0;
function prepare(image){if(image.dataset.loadingPrepared)return;image.dataset.loadingPrepared='true';image.decoding='async';if(!image.closest('.hero-header')&&!image.classList.contains('hero-logo'))image.loading=count++<2?'eager':'lazy';if(image.classList.contains('plato-img')){image.width=800;image.height=600;}}
document.querySelectorAll('.plato-img,.gallery-item img,.story-img,.menu-dia-img-slot img').forEach(prepare);
if(document.body)new MutationObserver(records=>{for(const r of records)for(const node of r.addedNodes)if(node instanceof Element){if(node.matches('img'))prepare(node);node.querySelectorAll('img').forEach(prepare);}}).observe(document.body,{subtree:true,childList:true});
// Solo en el visor temporal del editor. Acepta mensajes del padre del mismo
// origen y modifica únicamente el DOM del iframe; no escribe en Firebase.
if(new URLSearchParams(location.search).has('image-preview') && parent!==window){
 document.documentElement.dataset.imagePreview='true';
 document.addEventListener('click',event=>{if(event.target.closest('a,.admin-lock-btn,.admin-lock-btn-footer'))event.preventDefault();});
 let selected,observer,scrolled=false;
 function apply(){if(!selected)return;const {prefix,source,id,name,price}=selected;let target;
  const direct={qs:'qs-imagen',nc:'nc-imagen','portada-inicio':'hero-header','portada-carta':'hero-carta','portada-nosotros':'hero-nosotros'};
  if(direct[prefix])target=document.getElementById(direct[prefix]);
  else if(/^hist-img[123]$/.test(prefix))target=document.getElementById(`story-img-${prefix.at(-1)}`);
  else if(prefix.startsWith('menudia-'))target=document.querySelector(`#menu-dia-imgs-container [data-image-key="${prefix.endsWith('img1')?'img1':'img2'}"]`);
  else if(prefix.startsWith('galeria-'))target=[...document.querySelectorAll('.gallery-item img')].find(img=>img.dataset.galleryId===prefix.slice(8));
  else if(prefix==='plato'){const cards=[...document.querySelectorAll('#menu-grid .menu-item')];let card=cards.find(item=>item.dataset.id===(id||'preview-new'));if(!card){card=document.createElement('div');card.className='menu-item show';card.dataset.id=id||'preview-new';const img=document.createElement('img');img.className='plato-img';img.width=800;img.height=600;const text=document.createElement('div');text.className='item-content';text.textContent=`${name||'Nuevo plato'} · ${price||'Precio'}`;card.append(img,text);document.getElementById('menu-grid')?.prepend(card);}target=card.querySelector('img');if(!target){target=document.createElement('img');target.className='plato-img';card.prepend(target);}}
  if(!target && prefix.startsWith('menudia-')){const container=document.getElementById('menu-dia-imgs-container');if(container){const slot=document.createElement('div');slot.className='menu-dia-img-slot';target=document.createElement('img');slot.append(target);container.append(slot);target.dataset.imageKey=prefix.endsWith('img1')?'img1':'img2';}}
  if(!target && prefix==='galeria-new'){const container=document.getElementById('galeria-display');if(container){const slot=document.createElement('div');slot.className='gallery-item';target=document.createElement('img');target.dataset.galleryId='new';slot.append(target);container.prepend(slot);}}
  if(!target)return;
  if(target.tagName==='IMG'){if(target.getAttribute('src')!==source)target.src=source;if(target.style.display==='none')target.style.display='';target.closest('.gallery-item')?.removeAttribute('hidden');}
  else {const background=prefix.startsWith('portada-')?`linear-gradient(rgba(64,27,15,.78),rgba(122,40,29,.78)), url("${source}")`:`url("${source}")`;if(!target.style.backgroundImage.includes(source))target.style.backgroundImage=background;}
  if(!scrolled){scrolled=true;target.scrollIntoView({block:'center'});}
 }
 window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='tetera-image-preview'||typeof event.data.source!=='string'||typeof event.data.prefix!=='string'||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(event.data.source))return;selected=event.data;scrolled=false;if(!observer&&document.body){observer=new MutationObserver(apply);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src','style']});}apply();});
 parent.postMessage({type:'tetera-preview-ready'},location.origin);
}
