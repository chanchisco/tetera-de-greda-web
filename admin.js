// ============================================================
// admin.js — Lógica del panel de administración (rediseñado)
// ============================================================
import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------- UTILIDADES ----------
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function comprimirYConvertir(file, maxSizeMB = 0.20, maxDim = 900) {
  const options = { maxSizeMB, maxWidthOrHeight: maxDim, useWebWorker: true, fileType: 'image/jpeg' };
  const comprimido = await imageCompression(file, options);
  return await imageCompression.getDataUrlFromFile(comprimido);
}

function setStatus(id, msg, ok = true) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'status-msg ' + (ok ? 'status-ok' : 'status-err');
}

// ---------- NAVEGACIÓN DE TABS ----------
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const pageId = 'page-' + btn.dataset.page;
    document.getElementById(pageId).classList.add('active');

    // Cargar datos al entrar en ciertas páginas
    if (btn.dataset.page === 'portadas') cargarPortadas();
    if (btn.dataset.page === 'menudia') cargarMenuDia();
    if (btn.dataset.page === 'imagenes') cargarImagenesSeccion();
  });
});

// ---------- AUTH ----------
const loginPage = document.getElementById('login-page');
const panelRoot = document.getElementById('panel-root');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    loginError.textContent = 'Correo o contraseña incorrectos.';
  }
});

document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginPage.style.display = 'none';
    panelRoot.classList.remove('hidden');
    panelRoot.style.display = 'flex';
    cargarPlatos();
    cargarBebidas();
  } else {
    loginPage.style.display = 'flex';
    panelRoot.classList.add('hidden');
    panelRoot.style.display = 'none';
  }
});

// ============================================================
// PLATOS
// ============================================================
const platoForm = document.getElementById('plato-form');
const platoIdInput = document.getElementById('plato-id');
const platoNombreInput = document.getElementById('plato-nombre');
const platoPrecioInput = document.getElementById('plato-precio');
const platoDescInput = document.getElementById('plato-desc');
const platoCategoriaInput = document.getElementById('plato-categoria');
const platoImagenInput = document.getElementById('plato-imagen');
const platoStatus = document.getElementById('plato-status');
const platosLista = document.getElementById('platos-lista');

// -- Editor de posición de imagen --
const imgEditorWrap = document.getElementById('img-editor-wrap');
const imgEditorPreview = document.getElementById('img-editor-preview');
const platoPosX = document.getElementById('plato-img-pos-x');
const platoPosY = document.getElementById('plato-img-pos-y');
let editorDragging = false;
let editorStart = { x: 0, y: 0 };
let editorPos = { x: 50, y: 50 };
let currentBase64 = null;

function actualizarEditorPos() {
  imgEditorPreview.style.objectPosition = `${editorPos.x}% ${editorPos.y}%`;
  platoPosX.value = editorPos.x;
  platoPosY.value = editorPos.y;
}

imgEditorWrap.addEventListener('mousedown', (e) => {
  editorDragging = true;
  editorStart = { x: e.clientX, y: e.clientY };
});
document.addEventListener('mousemove', (e) => {
  if (!editorDragging) return;
  const dx = (editorStart.x - e.clientX) / imgEditorWrap.offsetWidth * 100;
  const dy = (editorStart.y - e.clientY) / imgEditorWrap.offsetHeight * 100;
  editorPos.x = Math.min(100, Math.max(0, editorPos.x + dx));
  editorPos.y = Math.min(100, Math.max(0, editorPos.y + dy));
  editorStart = { x: e.clientX, y: e.clientY };
  actualizarEditorPos();
});
document.addEventListener('mouseup', () => { editorDragging = false; });

// Touch support
imgEditorWrap.addEventListener('touchstart', (e) => {
  editorDragging = true;
  editorStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
document.addEventListener('touchmove', (e) => {
  if (!editorDragging) return;
  const dx = (editorStart.x - e.touches[0].clientX) / imgEditorWrap.offsetWidth * 100;
  const dy = (editorStart.y - e.touches[0].clientY) / imgEditorWrap.offsetHeight * 100;
  editorPos.x = Math.min(100, Math.max(0, editorPos.x + dx));
  editorPos.y = Math.min(100, Math.max(0, editorPos.y + dy));
  editorStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  actualizarEditorPos();
}, { passive: true });
document.addEventListener('touchend', () => { editorDragging = false; });

platoImagenInput.addEventListener('change', async () => {
  const file = platoImagenInput.files[0];
  if (!file) { imgEditorWrap.classList.add('hidden'); return; }
  platoStatus.textContent = 'Procesando imagen...';
  currentBase64 = await comprimirYConvertir(file);
  imgEditorPreview.src = currentBase64;
  imgEditorWrap.classList.remove('hidden');
  editorPos = { x: 50, y: 50 };
  actualizarEditorPos();
  platoStatus.textContent = '';
});

platoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  platoStatus.textContent = 'Guardando...';
  platoStatus.className = 'status-msg';

  const data = {
    nombre: platoNombreInput.value.trim(),
    precio: platoPrecioInput.value.trim(),
    descripcion: platoDescInput.value.trim(),
    categoria: platoCategoriaInput.value,
  };

  if (currentBase64) {
    data.imagenBase64 = currentBase64;
    data.imagenPos = { x: parseFloat(platoPosX.value), y: parseFloat(platoPosY.value) };
  }

  try {
    const id = platoIdInput.value;
    if (id) {
      await updateDoc(doc(db, 'platos', id), data);
    } else {
      data.orden = Date.now();
      await addDoc(collection(db, 'platos'), data);
    }
    platoForm.reset();
    platoIdInput.value = '';
    currentBase64 = null;
    imgEditorWrap.classList.add('hidden');
    document.getElementById('plato-img-current').classList.add('hidden');
    document.getElementById('plato-no-img').classList.add('hidden');
    document.getElementById('plato-img-current-label').style.display = 'none';
    setStatus('plato-status', '✅ Guardado correctamente.');
    cargarPlatos();
  } catch (err) {
    console.error(err);
    setStatus('plato-status', '❌ Error: ' + err.message, false);
  }
});

document.getElementById('plato-cancel').addEventListener('click', () => {
  platoForm.reset();
  platoIdInput.value = '';
  currentBase64 = null;
  imgEditorWrap.classList.add('hidden');
  document.getElementById('plato-img-current').classList.add('hidden');
  document.getElementById('plato-no-img').classList.add('hidden');
  document.getElementById('plato-img-current-label').style.display = 'none';
  platoStatus.textContent = '';
});

async function cargarPlatos() {
  platosLista.innerHTML = '<p style="color:#aaa; font-size:0.85rem;">Cargando...</p>';
  try {
    const q = query(collection(db, 'platos'), orderBy('categoria'));
    const snap = await getDocs(q);
    platosLista.innerHTML = '';
    if (snap.empty) {
      platosLista.innerHTML = '<p style="color:#aaa; font-size:0.85rem;">Aún no hay platos. Agrégalos arriba o usa Importar.</p>';
      return;
    }
    snap.forEach(docSnap => {
      const p = docSnap.data();
      const img = p.imagenBase64 || p.imagenURL || '';
      const pos = p.imagenPos ? `${p.imagenPos.x}% ${p.imagenPos.y}%` : '50% 50%';
      const div = document.createElement('div');
      div.className = 'item-row';
      div.innerHTML = `
        <img src="${img}" alt="${escapeHtml(p.nombre)}" class="item-row-img" style="object-position:${pos}">
        <div class="item-row-info">
          <strong>${escapeHtml(p.nombre)}</strong> — ${escapeHtml(p.precio)} <span class="tag">${escapeHtml(p.categoria)}</span>
          <p>${escapeHtml(p.descripcion || '')}</p>
        </div>
        <div class="item-row-actions">
          <button class="btn-edit-sm">Editar</button>
          <button class="btn-danger">Eliminar</button>
        </div>`;
      div.querySelector('.btn-edit-sm').addEventListener('click', () => {
        platoIdInput.value = docSnap.id;
        platoNombreInput.value = p.nombre;
        platoPrecioInput.value = p.precio;
        platoDescInput.value = p.descripcion || '';
        platoCategoriaInput.value = p.categoria;
        platoImagenInput.value = '';
        imgEditorWrap.classList.add('hidden');
        currentBase64 = null;
        editorPos = p.imagenPos ? { x: p.imagenPos.x, y: p.imagenPos.y } : { x: 50, y: 50 };
        platoPosX.value = editorPos.x;
        platoPosY.value = editorPos.y;
        // Mostrar imagen actual
        const currentImgEl = document.getElementById('plato-img-current');
        const noImgEl = document.getElementById('plato-no-img');
        const labelEl = document.getElementById('plato-img-current-label');
        if (img) {
          currentImgEl.src = img;
          currentImgEl.style.objectPosition = pos;
          currentImgEl.classList.remove('hidden');
          noImgEl.classList.add('hidden');
        } else {
          currentImgEl.classList.add('hidden');
          noImgEl.classList.remove('hidden');
        }
        labelEl.style.display = 'block';
        // Ir al formulario
        document.querySelector('[data-page="platos"]').click();
        platoForm.scrollIntoView({ behavior: 'smooth' });
      });
      div.querySelector('.btn-danger').addEventListener('click', async () => {
        if (confirm(`¿Eliminar "${p.nombre}"?`)) {
          await deleteDoc(doc(db, 'platos', docSnap.id));
          cargarPlatos();
        }
      });
      platosLista.appendChild(div);
    });
  } catch (err) {
    platosLista.innerHTML = '<p style="color:red; font-size:0.85rem;">Error al cargar platos.</p>';
    console.error(err);
  }
}

// ============================================================
// BEBIDAS
// ============================================================
const bebidaForm = document.getElementById('bebida-form');
const bebidaIdInput = document.getElementById('bebida-id');
const bebidaNombreInput = document.getElementById('bebida-nombre');
const bebidaPrecioInput = document.getElementById('bebida-precio');
const bebidaSubcategoriaInput = document.getElementById('bebida-subcategoria');
const bebidasLista = document.getElementById('bebidas-lista');

bebidaForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    nombre: bebidaNombreInput.value.trim(),
    precio: bebidaPrecioInput.value.trim(),
    subcategoria: bebidaSubcategoriaInput.value,
  };
  const id = bebidaIdInput.value;
  try {
    if (id) {
      await updateDoc(doc(db, 'bebidas', id), data);
    } else {
      data.orden = Date.now();
      await addDoc(collection(db, 'bebidas'), data);
    }
    bebidaForm.reset();
    bebidaIdInput.value = '';
    setStatus('bebida-status', '✅ Guardado.');
    cargarBebidas();
  } catch (err) {
    setStatus('bebida-status', '❌ Error: ' + err.message, false);
  }
});

document.getElementById('bebida-cancel').addEventListener('click', () => {
  bebidaForm.reset();
  bebidaIdInput.value = '';
  document.getElementById('bebida-status').textContent = '';
});

async function cargarBebidas() {
  bebidasLista.innerHTML = '<p style="color:#aaa; font-size:0.85rem;">Cargando...</p>';
  try {
    const q = query(collection(db, 'bebidas'), orderBy('subcategoria'));
    const snap = await getDocs(q);
    bebidasLista.innerHTML = '';
    if (snap.empty) {
      bebidasLista.innerHTML = '<p style="color:#aaa; font-size:0.85rem;">Aún no hay bebidas.</p>';
      return;
    }
    snap.forEach(docSnap => {
      const b = docSnap.data();
      const div = document.createElement('div');
      div.className = 'item-row';
      div.innerHTML = `
        <div class="item-row-info">
          <strong>${escapeHtml(b.nombre)}</strong> — ${escapeHtml(b.precio)} <span class="tag">${escapeHtml(b.subcategoria)}</span>
        </div>
        <div class="item-row-actions">
          <button class="btn-edit-sm">Editar</button>
          <button class="btn-danger">Eliminar</button>
        </div>`;
      div.querySelector('.btn-edit-sm').addEventListener('click', () => {
        bebidaIdInput.value = docSnap.id;
        bebidaNombreInput.value = b.nombre;
        bebidaPrecioInput.value = b.precio;
        bebidaSubcategoriaInput.value = b.subcategoria;
        document.querySelector('[data-page="bebidas"]').click();
        bebidaForm.scrollIntoView({ behavior: 'smooth' });
      });
      div.querySelector('.btn-danger').addEventListener('click', async () => {
        if (confirm(`¿Eliminar "${b.nombre}"?`)) {
          await deleteDoc(doc(db, 'bebidas', docSnap.id));
          cargarBebidas();
        }
      });
      bebidasLista.appendChild(div);
    });
  } catch (err) {
    bebidasLista.innerHTML = '<p style="color:red; font-size:0.85rem;">Error al cargar.</p>';
  }
}

// ============================================================
// PORTADAS
// ============================================================
async function cargarPortadas() {
  const paginas = ['inicio', 'nosotros', 'carta'];
  try {
    const docRef = doc(db, 'configuracion', 'portadas');
    const snap = await getDoc(docRef);
    const data = snap.exists() ? snap.data() : {};
    paginas.forEach(pag => {
      const preview = document.getElementById(`portada-${pag}-preview`);
      if (data[pag]) {
        preview.outerHTML = `<img id="portada-${pag}-preview" src="${data[pag]}" style="width:100%; height:110px; object-fit:cover; display:block;">`;
      } else {
        preview.textContent = 'Sin imagen';
      }
    });
  } catch (err) {
    console.error(err);
  }
}

window.guardarPortada = async function(pagina, fileInputId, previewId) {
  const fileInput = document.getElementById(fileInputId);
  const statusId = `portada-${pagina}-status`;
  if (!fileInput.files[0]) { setStatus(statusId, '⚠️ Selecciona una imagen', false); return; }
  setStatus(statusId, 'Subiendo...');
  try {
    const base64 = await comprimirYConvertir(fileInput.files[0], 0.3, 1400);
    const docRef = doc(db, 'configuracion', 'portadas');
    const snap = await getDoc(docRef);
    const data = snap.exists() ? snap.data() : {};
    data[pagina] = base64;
    await setDoc(docRef, data);
    const preview = document.getElementById(previewId);
    if (preview) {
      const img = document.createElement('img');
      img.src = base64;
      img.id = previewId;
      img.style.cssText = 'width:100%; height:110px; object-fit:cover; display:block;';
      preview.replaceWith(img);
    }
    setStatus(statusId, '✅ Portada guardada.');
  } catch (err) {
    setStatus(statusId, '❌ Error: ' + err.message, false);
  }
};

// ============================================================
// MENÚ DEL DÍA
// ============================================================
async function cargarMenuDia() {
  try {
    const docRef = doc(db, 'configuracion', 'menuDia');
    const snap = await getDoc(docRef);
    const data = snap.exists() ? snap.data() : {};
    [1, 2].forEach(n => {
      const preview = document.getElementById(`menudia-img${n}-preview`);
      if (data[`img${n}`]) {
        const img = document.createElement('img');
        img.src = data[`img${n}`];
        img.style.cssText = 'width:100%; height:130px; object-fit:cover; display:block;';
        img.id = `menudia-img${n}-preview`;
        preview.replaceWith(img);
      } else {
        preview.textContent = 'Sin imagen';
      }
    });
  } catch (err) { console.error(err); }
}

window.guardarMenuDiaImg = async function(n) {
  const fileInput = document.getElementById(`menudia-img${n}-file`);
  const statusId = `menudia-img${n}-status`;
  if (!fileInput.files[0]) { setStatus(statusId, '⚠️ Selecciona una imagen', false); return; }
  setStatus(statusId, 'Subiendo...');
  try {
    const base64 = await comprimirYConvertir(fileInput.files[0], 0.25, 1000);
    const docRef = doc(db, 'configuracion', 'menuDia');
    const snap = await getDoc(docRef);
    const data = snap.exists() ? snap.data() : {};
    data[`img${n}`] = base64;
    await setDoc(docRef, data);
    const previewId = `menudia-img${n}-preview`;
    const preview = document.getElementById(previewId);
    const img = document.createElement('img');
    img.src = base64;
    img.id = previewId;
    img.style.cssText = 'width:100%; height:130px; object-fit:cover; display:block;';
    preview.replaceWith(img);
    setStatus(statusId, '✅ Imagen guardada.');
  } catch (err) {
    setStatus(statusId, '❌ Error: ' + err.message, false);
  }
};

window.borrarMenuDiaImg = async function(n) {
  if (!confirm(`¿Quitar la imagen ${n} del menú del día?`)) return;
  const statusId = `menudia-img${n}-status`;
  try {
    const docRef = doc(db, 'configuracion', 'menuDia');
    const snap = await getDoc(docRef);
    const data = snap.exists() ? snap.data() : {};
    delete data[`img${n}`];
    await setDoc(docRef, data);
    const previewId = `menudia-img${n}-preview`;
    const preview = document.getElementById(previewId);
    const div = document.createElement('div');
    div.id = previewId;
    div.className = 'menu-dia-slot-empty';
    div.textContent = 'Sin imagen';
    preview.replaceWith(div);
    setStatus(statusId, '✅ Imagen quitada.');
  } catch (err) {
    setStatus(statusId, '❌ Error: ' + err.message, false);
  }
};

// ============================================================
// IMÁGENES DE SECCIONES
// ============================================================
async function cargarImagenesSeccion() {
  try {
    const docRef = doc(db, 'configuracion', 'imagenesSeccion');
    const snap = await getDoc(docRef);
    const data = snap.exists() ? snap.data() : {};

    // Quiénes Somos
    const qsPreview = document.getElementById('qs-img-preview');
    if (data.quienesSomosImg) {
      const img = document.createElement('img');
      img.src = data.quienesSomosImg;
      img.id = 'qs-img-preview';
      img.style.cssText = 'width:100%; height:150px; object-fit:cover; border-radius:8px; display:block; margin-bottom:10px;';
      qsPreview.replaceWith(img);
    }
    if (data.quienesSomosTexto) {
      document.getElementById('qs-texto').value = data.quienesSomosTexto;
    }

    // Nuestra Carta
    const ncPreview = document.getElementById('nc-img-preview');
    if (data.nuestraCartaImg) {
      const img = document.createElement('img');
      img.src = data.nuestraCartaImg;
      img.id = 'nc-img-preview';
      img.style.cssText = 'width:100%; height:150px; object-fit:cover; border-radius:8px; display:block; margin-bottom:10px;';
      ncPreview.replaceWith(img);
    }
  } catch (err) { console.error(err); }
}

window.guardarSeccionImagen = async function(seccion, fileInputId, previewId, textoInputId, statusId) {
  const fileInput = document.getElementById(fileInputId);
  setStatus(statusId, 'Guardando...');
  try {
    const docRef = doc(db, 'configuracion', 'imagenesSeccion');
    const snap = await getDoc(docRef);
    const data = snap.exists() ? snap.data() : {};

    if (fileInput.files[0]) {
      const base64 = await comprimirYConvertir(fileInput.files[0], 0.3, 1200);
      data[`${seccion}Img`] = base64;
      // Actualizar preview
      const preview = document.getElementById(previewId);
      const img = document.createElement('img');
      img.src = base64;
      img.id = previewId;
      img.style.cssText = 'width:100%; height:150px; object-fit:cover; border-radius:8px; display:block; margin-bottom:10px;';
      preview.replaceWith(img);
    }

    if (textoInputId) {
      const texto = document.getElementById(textoInputId).value.trim();
      if (texto) data[`${seccion}Texto`] = texto;
    }

    await setDoc(docRef, data);
    setStatus(statusId, '✅ Guardado correctamente.');
  } catch (err) {
    setStatus(statusId, '❌ Error: ' + err.message, false);
  }
};

// ============================================================
// IMPORTAR CARTA (UNA SOLA VEZ)
// ============================================================
document.getElementById('btn-importar').addEventListener('click', async () => {
  if (!confirm('Esto copiará el menú actual del sitio a la base de datos. Solo debe hacerse UNA VEZ. ¿Continuar?')) return;
  const status = document.getElementById('importar-status');
  status.textContent = 'Importando...';
  try {
    const { PLATOS_SEED, BEBIDAS_SEED } = await import('./seed-data.js');
    for (const p of PLATOS_SEED) {
      await addDoc(collection(db, 'platos'), p);
    }
    for (const b of BEBIDAS_SEED) {
      await addDoc(collection(db, 'bebidas'), b);
    }
    setStatus('importar-status', `✅ Importados ${PLATOS_SEED.length} platos y ${BEBIDAS_SEED.length} bebidas.`);
    cargarPlatos();
    cargarBebidas();
  } catch (err) {
    console.error(err);
    setStatus('importar-status', '❌ Error: ' + err.message, false);
  }
});
