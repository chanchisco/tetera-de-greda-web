import { db } from './firebase-config.js';
import { doc,getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
export async function renderFeatured(grid){
 try{
  const value=(await getDoc(doc(db,'configuracion','destacados'))).data();if(!value?.habilitado||!Array.isArray(value.platos))return;
  let section=document.querySelector('.featured-section');if(section)section.remove();
  section=document.createElement('section');section.className='featured-section';section.setAttribute('aria-labelledby','featured-heading');
  const heading=document.createElement('h2');heading.id='featured-heading';heading.textContent=value.titulo||'Recomendados de la casa';
  const cards=document.createElement('div');cards.className='featured-grid';
  for(const id of value.platos.slice(0,3)){const card=[...grid.children].find(item=>item.dataset.id===id);if(!card)continue;const clone=card.cloneNode(true);clone.className='menu-item show';const image=clone.querySelector('img');if(image)image.loading='eager';cards.append(clone);}
  if(!cards.children.length)return;section.append(heading,cards);document.querySelector('.menu-section').before(section);
  document.getElementById('carta-search')?.addEventListener('input',e=>section.hidden=!!e.target.value.trim());
 }catch{ /* La lista principal sigue funcionando si no carga este bloque opcional. */ }
}
