const preview=document.createElement('dialog');preview.className='image-editor image-page-preview';preview.setAttribute('aria-labelledby','page-preview-title');
preview.innerHTML='<h2 id="page-preview-title">Vista en la página</h2><p>Vista temporal: no guarda ni publica cambios.</p><div class="page-preview-grid"><figure><figcaption>Escritorio · 1024 px</figcaption><div><iframe title="Vista de escritorio" width="1024" height="700"></iframe></div></figure><figure><figcaption>Celular · 390 px</figcaption><div><iframe title="Vista de celular" width="390" height="700"></iframe></div></figure></div><button type="button" class="content-action">Volver a los ajustes</button>';
document.body.append(preview);
export function showPagePreview(source,prefix='plato'){
 let page='index.html';if(prefix==='plato')page='carta.html';if(prefix==='portada-carta')page='carta.html';if(prefix==='portada-nosotros'||prefix.startsWith('hist-img')||prefix.startsWith('galeria-'))page='nosotros.html';
 const before=document.activeElement,frames=[...preview.querySelectorAll('iframe')];
 const message={type:'tetera-image-preview',source,prefix,id:document.getElementById('plato-id')?.value,name:document.getElementById('plato-nombre')?.value,price:document.getElementById('plato-precio')?.value};
 function send(frame){frame.contentWindow?.postMessage(message,location.origin);}
 const listener=event=>{if(event.origin===location.origin&&event.data?.type==='tetera-preview-ready')for(const frame of frames)if(frame.contentWindow===event.source)send(frame);};window.addEventListener('message',listener);
 const resize=new ResizeObserver(()=>{for(const frame of frames){const width=Number(frame.width),scale=frame.parentElement.clientWidth/width;frame.style.transform=`scale(${scale})`;frame.parentElement.style.height=`${700*scale}px`;}});frames.forEach(frame=>{frame.onload=()=>send(frame);frame.src=`/${page}?image-preview=1`;resize.observe(frame.parentElement);});
 function close(){preview.close();for(const frame of frames){frame.onload=null;frame.removeAttribute('src');}window.removeEventListener('message',listener);resize.disconnect();before?.focus();}
 preview.querySelector('button').onclick=close;preview.oncancel=e=>{e.preventDefault();close();};preview.showModal();
}
