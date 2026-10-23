import { contentRequest,imageDrafts } from './content-client.js';
import { showPagePreview } from './image-page-preview.js';
let active=false;
const dialog=document.createElement('dialog');dialog.className='image-editor';dialog.setAttribute('aria-labelledby','image-editor-title');
dialog.innerHTML=`<h2 id="image-editor-title">Ajustar imagen</h2><p>Mueve la foto dentro del cuadro. Los cambios se aplican al confirmar.</p><canvas aria-label="Vista previa del encuadre"></canvas><div class="image-adjustments"><label>Zoom <input name="zoom" type="range" min="1" max="4" step="0.01" value="1"></label><label>Posición horizontal <input name="x" type="range" min="0" max="1" step="0.005" value="0.5"></label><label>Posición vertical <input name="y" type="range" min="0" max="1" step="0.005" value="0.5"></label><label>Brillo <output>100%</output><input name="brightness" type="range" min="0.5" max="1.5" step="0.01" value="1"></label></div><div class="image-editor-previews"><figure><figcaption>Encuadre de escritorio</figcaption><img alt="Vista previa en escritorio"></figure><figure><figcaption>Encuadre en celular</figcaption><img alt="Vista previa en celular"></figure></div><p class="editor-note">El tamaño se adapta a la pantalla. Las portadas añaden el texto y la capa de color del sitio.</p><p role="status" class="editor-status"></p><div class="image-toolbar"><button type="button" data-editor="reset">Restablecer ajustes</button><button type="button" data-editor="cancel">Cancelar</button><button type="button" data-editor="apply">Aplicar imagen</button></div>`;
document.body.append(dialog);
dialog.querySelector('[name="brightness"]').setAttribute('aria-label','Brillo');
async function loadImage(source) {
 const image=new Image();image.crossOrigin='anonymous';image.src=source;await image.decode();return image;
}
function applyBrightness(ctx,width,height,value){if(value===1)return;const pixels=ctx.getImageData(0,0,width,height);for(let i=0;i<pixels.data.length;i+=4){pixels.data[i]*=value;pixels.data[i+1]*=value;pixels.data[i+2]*=value;}ctx.putImageData(pixels,0,0);}
function encode(canvas,maxLength=620000) {
 let result;
 for(let q=.88;q>=.42;q-=.08){result=canvas.toDataURL('image/jpeg',q);if(result.length<=maxLength)return result;}
 const small=document.createElement('canvas');small.width=Math.round(canvas.width*.75);small.height=Math.round(canvas.height*.75);small.getContext('2d').drawImage(canvas,0,0,small.width,small.height);
 if(small.width<320) throw new Error('No se pudo reducir la foto. Selecciona otra imagen.');return encode(small,maxLength);
}
export async function prepareImage(file) {
 if(!file?.type?.startsWith('image/') || file.size>25*1024*1024) throw new Error('Selecciona una imagen de hasta 25 MB.');
 const url=URL.createObjectURL(file);
 try{const image=await loadImage(url),canvas=document.createElement('canvas'),scale=Math.min(1,1800/Math.max(image.naturalWidth,image.naturalHeight));canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);return encode(canvas,720000);}finally{URL.revokeObjectURL(url);}
}
export async function editImage(published,ratio=4/3,context='plato') {
 if(active)throw new Error('Termina la edición actual antes de abrir otra imagen.');active=true;
 const focus=document.activeElement;
 try{
  let source=published,settings={zoom:1,x:.5,y:.5,brightness:1};
  const draft=imageDrafts.get(published);
  if(draft){source=draft.source;settings={...settings,...draft.settings};}
  else if(published?.includes('/api/imagen?id=')){
   const id=new URL(published,location.origin).searchParams.get('id');
   const saved=await contentRequest(null,`?mode=source&id=${encodeURIComponent(id)}`);source=saved.source;settings={...settings,...saved.settings};
  }
  let image=await loadImage(source);
  if(!source.startsWith('data:image/')){const working=document.createElement('canvas'),scale=Math.min(1,1800/Math.max(image.naturalWidth,image.naturalHeight));working.width=Math.round(image.naturalWidth*scale);working.height=Math.round(image.naturalHeight*scale);const work=working.getContext('2d');work.fillStyle='#fff';work.fillRect(0,0,working.width,working.height);work.drawImage(image,0,0,working.width,working.height);source=encode(working,720000);image=await loadImage(source);}
  const canvas=dialog.querySelector('canvas'),ctx=canvas.getContext('2d');
  const controls=Object.fromEntries([...dialog.querySelectorAll('input')].map(input=>[input.name,input]));
  canvas.width=800;canvas.height=Math.round(800/ratio);
  const previews=dialog.querySelectorAll('figure img');previews.forEach(p=>p.style.aspectRatio=String(ratio));
  let crop;
  function draw(){
   for(const name of Object.keys(controls)){settings[name]=Number(controls[name].value);}
   const fit=Math.max(canvas.width/image.naturalWidth,canvas.height/image.naturalHeight)*settings.zoom;
   const width=canvas.width/fit,height=canvas.height/fit;
   crop={x:(image.naturalWidth-width)*settings.x,y:(image.naturalHeight-height)*settings.y,width,height};
   ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,crop.x,crop.y,width,height,0,0,canvas.width,canvas.height);applyBrightness(ctx,canvas.width,canvas.height,settings.brightness);
   dialog.querySelector('output').value=`${Math.round(settings.brightness*100)}%`;
   const preview=canvas.toDataURL('image/jpeg',.6);previews.forEach(p=>p.src=preview);
  }
  const initial={...settings};
  let pageButton=dialog.querySelector('[data-editor="page"]');if(!pageButton){pageButton=document.createElement('button');pageButton.type='button';pageButton.dataset.editor='page';pageButton.textContent='Ver en la página';dialog.querySelector('.image-toolbar').prepend(pageButton);}pageButton.onclick=()=>showPagePreview(canvas.toDataURL('image/jpeg',.8),context);
  function reset(value){for(const [name,input]of Object.entries(controls))input.value=value[name]??initial[name];draw();}
  reset(settings);for(const input of Object.values(controls))input.oninput=draw;
  let pointer;
  canvas.onpointerdown=e=>{pointer={x:e.clientX,y:e.clientY,px:settings.x,py:settings.y};canvas.setPointerCapture(e.pointerId);};
  canvas.onpointermove=e=>{if(!pointer)return;controls.x.value=Math.max(0,Math.min(1,pointer.px-(e.clientX-pointer.x)/canvas.getBoundingClientRect().width));controls.y.value=Math.max(0,Math.min(1,pointer.py-(e.clientY-pointer.y)/canvas.getBoundingClientRect().height));draw();};
  canvas.onpointerup=canvas.onpointercancel=()=>pointer=null;
  dialog.querySelector('.editor-status').textContent='';dialog.showModal();
  return await new Promise(resolve=>{
   const finish=value=>{dialog.close();canvas.onpointerdown=canvas.onpointermove=canvas.onpointerup=canvas.onpointercancel=null;controls.zoom.focus();resolve(value);};
   dialog.oncancel=e=>{e.preventDefault();finish(null);};
   dialog.querySelector('[data-editor="cancel"]').onclick=()=>finish(null);
   dialog.querySelector('[data-editor="reset"]').onclick=()=>reset({zoom:1,x:.5,y:.5,brightness:1});
   dialog.querySelector('[data-editor="apply"]').onclick=()=>{
    try{const output=document.createElement('canvas');output.width=Math.min(1600,Math.round(crop.width));output.height=Math.round(output.width/ratio);const out=output.getContext('2d');out.fillStyle='#fff';out.fillRect(0,0,output.width,output.height);out.drawImage(image,crop.x,crop.y,crop.width,crop.height,0,0,output.width,output.height);applyBrightness(out,output.width,output.height,settings.brightness);const cooked=encode(output);imageDrafts.set(cooked,{published:cooked,source,settings:{...settings,ratio}});finish(cooked);}catch(error){dialog.querySelector('.editor-status').textContent=error.message;}
   };
  });
 }finally{active=false;focus?.focus();}
}
export function downloadImage(source,name='imagen-tetera.jpg') {const a=document.createElement('a');a.href=source;a.download=name;document.body.append(a);a.click();a.remove();}
