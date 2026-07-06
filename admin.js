import { db, auth } from './firebase-config.js';
import { collection, addDoc, getDocs, doc, setDoc, deleteDoc, updateDoc, getDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ============================
   AUTH Y UI BÁSICA
============================ */
const loginPage = document.getElementById('login-page');
const panelRoot = document.getElementById('panel-root');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const btnLogout = document.getElementById('btn-logout');

onAuthStateChanged(auth, user => {
    if (user) { loginPage.style.display = 'none'; panelRoot.classList.remove('hidden'); initAdmin(); }
    else { loginPage.style.display = 'flex'; panelRoot.classList.add('hidden'); }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); }
    catch(err) { loginError.textContent = "Credenciales incorrectas."; }
});
btnLogout.addEventListener('click', () => signOut(auth));

function showStatus(elemId, msg, isError = false) {
    const el = document.getElementById(elemId);
    if (!el) { console.warn('showStatus: elemento no encontrado:', elemId); return; }
    el.innerHTML = isError ? `<i class="fa-solid fa-triangle-exclamation"></i> ${msg}` : `<i class="fa-solid fa-rotate"></i> ${msg}`;
    el.className = 'status-msg ' + (isError ? 'status-err' : 'status-ok');
    setTimeout(() => { if(el) el.innerHTML = ''; }, 3500);
}

function scrollToTop() {
    // Intenta scroll en el contenedor .content primero, luego window
    const contentEl = document.querySelector('.content');
    if (contentEl) contentEl.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initAdmin() {
    cargarDashboard();
    cargarPlatos();
    cargarBebidas();
    cargarConfiguracionGeneral();
    cargarTextosMenuDia();
    cargarMenuDiaImgs();
    cargarHistoria();
    cargarGaleria();
}

/* Dashboard stats */
async function cargarDashboard() {
    try {
        const [platosSnap, bebidasSnap, galeriaSnap] = await Promise.all([
            getDocs(collection(db, 'platos')),
            getDocs(collection(db, 'bebidas')),
            getDocs(collection(db, 'galeria'))
        ]);
        const dp = document.getElementById('dash-platos');
        const db2 = document.getElementById('dash-bebidas');
        const di = document.getElementById('dash-imgs');
        if (dp) dp.textContent = platosSnap.size;
        if (db2) db2.textContent = bebidasSnap.size;
        if (di) di.textContent = galeriaSnap.size;
    } catch(e) { console.warn('dashboard error', e); }
}

// Nav Tabs
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`page-${btn.dataset.page}`).classList.add('active');
        scrollToTop();
    });
});

// Navegar a tab por nombre (usado en dashboard)
window.irA = function(page) {
    const btn = document.querySelector(`[data-page="${page}"]`);
    if (btn) btn.click();
};

// Checkbox Oferta Platos
document.getElementById('plato-oferta-cb').addEventListener('change', (e) => {
    const fields = document.getElementById('plato-oferta-fields');
    if(e.target.checked) fields.classList.remove('hidden');
    else fields.classList.add('hidden');
});

/* Formateador de precio: convierte "13000" -> "$13.000" */
function formatPrecio(raw) {
    const num = parseInt(String(raw).replace(/\D/g, ''), 10);
    if (isNaN(num)) return raw;
    return '$' + num.toLocaleString('es-CL');
}
function attachPriceFormatter(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.addEventListener('blur', () => { el.value = formatPrecio(el.value); });
}
attachPriceFormatter('plato-precio');
attachPriceFormatter('plato-oferta-precio');
attachPriceFormatter('bebida-precio');

/* ============================
   CROPPER MODAL (Universal)
   LÓGICA CORREGIDA: usamos posición relativa del img dentro del container
============================ */
let cropperResolve = null;
let currentAspectRatio = 1;
let imgDrag = { active: false, startX: 0, startY: 0, bgX: 0, bgY: 0 };

const cropperModal = document.getElementById('cropper-modal');
const cropperImg = document.getElementById('cropper-img');
const cropperOverlay = document.getElementById('cropper-overlay');
const cropperZoom = document.getElementById('cropper-zoom');
const cropperContainer = document.getElementById('cropper-container');

// Posición actual de la imagen (en px relativos al centro del contenedor)
let imgOffsetX = 0, imgOffsetY = 0, imgScale = 1;

async function openCropper(b64Data, aspectRatio) {
    return new Promise((resolve) => {
        cropperResolve = resolve;
        currentAspectRatio = aspectRatio;

        cropperImg.onload = () => {
            cropperModal.classList.remove('hidden');
            requestAnimationFrame(() => {
                const cw = cropperContainer.clientWidth;
                const ch = cropperContainer.clientHeight;

                // Calcular tamaño del overlay (area de recorte visible)
                let ow, oh;
                if (cw / ch > aspectRatio) {
                    oh = ch * 0.9; ow = oh * aspectRatio;
                } else {
                    ow = cw * 0.9; oh = ow / aspectRatio;
                }
                cropperOverlay.style.width = `${ow}px`;
                cropperOverlay.style.height = `${oh}px`;
                // Centrar overlay
                cropperOverlay.style.position = 'absolute';
                cropperOverlay.style.left = `${(cw - ow) / 2}px`;
                cropperOverlay.style.top = `${(ch - oh) / 2}px`;

                // Escala inicial: la imagen llena el overlay
                const scaleW = ow / cropperImg.naturalWidth;
                const scaleH = oh / cropperImg.naturalHeight;
                imgScale = Math.max(scaleW, scaleH);
                imgOffsetX = 0;
                imgOffsetY = 0;

                cropperZoom.min = imgScale * 0.8;
                cropperZoom.max = imgScale * 5;
                cropperZoom.step = imgScale * 0.01;
                cropperZoom.value = imgScale;

                applyCropperTransform();
            });
        };
        cropperImg.src = b64Data;
    });
}

function applyCropperTransform() {
    // La imagen está posicionada en el centro del container con transform
    cropperImg.style.position = 'absolute';
    cropperImg.style.top = '50%';
    cropperImg.style.left = '50%';
    cropperImg.style.transformOrigin = 'center center';
    cropperImg.style.transform = `translate(calc(-50% + ${imgOffsetX}px), calc(-50% + ${imgOffsetY}px)) scale(${imgScale})`;
    cropperImg.style.cursor = 'grab';
    cropperImg.style.userSelect = 'none';
    cropperImg.style.pointerEvents = 'none';
}

cropperZoom.addEventListener('input', (e) => {
    imgScale = parseFloat(e.target.value);
    applyCropperTransform();
});

function cDragStart(e) {
    if (e.target === cropperZoom || e.target.tagName === 'BUTTON') return;
    imgDrag.active = true;
    const pt = e.touches ? e.touches[0] : e;
    imgDrag.startX = pt.clientX;
    imgDrag.startY = pt.clientY;
    imgDrag.bgX = imgOffsetX;
    imgDrag.bgY = imgOffsetY;
    e.preventDefault();
}
function cDragMove(e) {
    if (!imgDrag.active) return;
    e.preventDefault();
    const pt = e.touches ? e.touches[0] : e;
    imgOffsetX = imgDrag.bgX + (pt.clientX - imgDrag.startX);
    imgOffsetY = imgDrag.bgY + (pt.clientY - imgDrag.startY);
    applyCropperTransform();
}
function cDragEnd() { imgDrag.active = false; }

cropperContainer.addEventListener('mousedown', cDragStart);
cropperContainer.addEventListener('touchstart', cDragStart, { passive: false });
window.addEventListener('mousemove', cDragMove);
window.addEventListener('touchmove', cDragMove, { passive: false });
window.addEventListener('mouseup', cDragEnd);
window.addEventListener('touchend', cDragEnd);

document.getElementById('btn-crop-cancel').addEventListener('click', () => {
    cropperModal.classList.add('hidden');
    if (cropperResolve) cropperResolve(null);
});

document.getElementById('btn-crop-apply').addEventListener('click', async () => {
    const cw = cropperContainer.clientWidth;
    const ch = cropperContainer.clientHeight;

    // Centro del contenedor
    const containerCenterX = cw / 2;
    const containerCenterY = ch / 2;

    // Overlay bounds relativas al contenedor
    const ovLeft = parseFloat(cropperOverlay.style.left);
    const ovTop = parseFloat(cropperOverlay.style.top);
    const ovW = parseFloat(cropperOverlay.style.width);
    const ovH = parseFloat(cropperOverlay.style.height);

    // El centro de la imagen en coordenadas del contenedor
    const imgCenterInContainer_X = containerCenterX + imgOffsetX;
    const imgCenterInContainer_Y = containerCenterY + imgOffsetY;

    // Esquina superior izquierda del overlay relativa al centro de la imagen (en coords imagen original)
    const cropX = (ovLeft - imgCenterInContainer_X) / imgScale + cropperImg.naturalWidth / 2;
    const cropY = (ovTop - imgCenterInContainer_Y) / imgScale + cropperImg.naturalHeight / 2;
    const cropW = ovW / imgScale;
    const cropH = ovH / imgScale;

    // Canvas de salida en alta resolución
    const outW = Math.round(Math.min(2400, Math.max(800, ovW * 2)));
    const outH = Math.round(outW / currentAspectRatio);

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(cropperImg, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

    const base64 = canvas.toDataURL('image/jpeg', 0.9);
    cropperModal.classList.add('hidden');
    if (cropperResolve) cropperResolve(base64);
});

/* ============================
   HELPERS
============================ */
async function compressImage(file, maxMB = 0.8, maxDim = 2400) {
    // Usar maxDim y calidad más alta para portadas que son grandes
    const options = { maxSizeMB: maxMB, maxWidthOrHeight: maxDim, useWebWorker: true, initialQuality: 0.92 };
    try {
        const compressed = await imageCompression(file, options);
        return await fileToBase64(compressed);
    } catch (e) {
        return await fileToBase64(file);
    }
}
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

function renderPreview(imgId, src, noImgId, delBtnId) {
    const img = document.getElementById(imgId);
    const no = document.getElementById(noImgId);
    const del = document.getElementById(delBtnId);
    if (src) { img.src = src; img.classList.remove('hidden'); no.classList.add('hidden'); if (del) del.classList.remove('hidden'); }
    else { img.classList.add('hidden'); no.classList.remove('hidden'); img.src = ''; if (del) del.classList.add('hidden'); }
}

/* ============================
   UTILIDADES RECORTADOR
============================ */
window.abrirRecortadorPlato = async (input) => {
    if (input.files.length === 0) return;
    showStatus('plato-status', 'Procesando imagen...');
    const b64_temp = await compressImage(input.files[0]);
    const b64 = await openCropper(b64_temp, 4 / 3);
    input.value = '';
    if (b64) {
        document.getElementById('plato-preview-box').style.display = 'flex';
        document.getElementById('plato-img-current').src = b64;
        estadoPlatoImg.base64 = b64;
        showStatus('plato-status', 'Imagen lista. Recuerda guardar.');
    } else {
        showStatus('plato-status', '');
    }
};

// Genera la función de recorte para cada contexto
window.recortarYGuardar = async (prefix, input, ratio, saveFunc) => {
    if (input.files.length === 0) return;
    const b64_temp = await compressImage(input.files[0]);
    const b64 = await openCropper(b64_temp, ratio);
    input.value = '';
    if (b64) saveFunc(prefix, b64);
};

// Para historia (necesita statusId propio)
window.recortarHistoria = async (idx, input) => {
    if (input.files.length === 0) return;
    showStatus(`hist-${idx}-status`, 'Procesando imagen...');
    const b64_temp = await compressImage(input.files[0]);
    const b64 = await openCropper(b64_temp, 4 / 3);
    input.value = '';
    if (!b64) { showStatus(`hist-${idx}-status`, ''); return; }
    await guardarHistoriaImgSolo(idx, b64);
};

/* ============================
   PLATOS
============================ */
const platoForm = document.getElementById('plato-form');
let estadoPlatoImg = { base64: null };

platoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = platoForm.querySelector('button[type="submit"]');
    btnSubmit.disabled = true; btnSubmit.textContent = "Guardando...";

    const id = document.getElementById('plato-id').value;
    // Recoger etiquetas seleccionadas
    const etiquetas = [...document.querySelectorAll('.plato-etiqueta:checked')].map(cb => cb.value);
    const data = {
        nombre: document.getElementById('plato-nombre').value,
        precio: formatPrecio(document.getElementById('plato-precio').value),
        descripcion: document.getElementById('plato-desc').value,
        categoria: document.getElementById('plato-categoria').value,
        imagenBase64: estadoPlatoImg.base64,
        imagenPos: null,
        oferta: document.getElementById('plato-oferta-cb').checked,
        ofertaEtiqueta: document.getElementById('plato-oferta-etiqueta').value,
        ofertaPrecio: formatPrecio(document.getElementById('plato-oferta-precio').value),
        disponible: document.getElementById('plato-disponible').checked,
        etiquetas: etiquetas
    };

    try {
        if (id) { await updateDoc(doc(db, 'platos', id), data); showStatus('plato-status', 'Actualizado correctamente'); }
        else { data.orden = Date.now(); await addDoc(collection(db, 'platos'), data); showStatus('plato-status', 'Plato creado'); }
        limpiarPlatoForm();
        cargarPlatos();
        cargarDashboard();
    } catch (e) { showStatus('plato-status', 'Error al guardar', true); }
    btnSubmit.disabled = false; btnSubmit.innerHTML = `Guardar`;
});

function limpiarPlatoForm() {
    platoForm.reset();
    document.getElementById('plato-id').value = '';
    estadoPlatoImg.base64 = null;
    document.getElementById('plato-preview-box').style.display = 'none';
    document.getElementById('plato-oferta-cb').checked = false;
    document.getElementById('plato-oferta-fields').classList.add('hidden');
    document.getElementById('plato-disponible').checked = true;
    document.querySelectorAll('.plato-etiqueta').forEach(cb => cb.checked = false);
}
document.getElementById('plato-cancel').addEventListener('click', limpiarPlatoForm);
document.getElementById('btn-eliminar-foto-plato').addEventListener('click', () => {
    document.getElementById('plato-preview-box').style.display = 'none';
    estadoPlatoImg.base64 = null;
});

// Lista de todos los platos para filtro
let _todosLosPlatos = [];

async function cargarPlatos() {
    const lista = document.getElementById('platos-lista');
    lista.innerHTML = 'Cargando...';
    const snap = await getDocs(query(collection(db, 'platos'), orderBy('orden')));
    _todosLosPlatos = [];
    snap.forEach(docSnap => {
        _todosLosPlatos.push({ id: docSnap.id, ...docSnap.data() });
    });
    renderListaPlatos(_todosLosPlatos);
}

function renderListaPlatos(platos) {
    const lista = document.getElementById('platos-lista');
    lista.innerHTML = '';
    if (!platos.length) { lista.innerHTML = '<p style="color:#999; text-align:center;">No hay platos.</p>'; return; }
    platos.forEach((d, idx) => {
        const div = document.createElement('div');
        div.className = 'item-row';
        const tag = d.oferta ? `<span class="tag tag-oferta"><i class="fa-solid fa-tag"></i> Oferta</span>` : '';
        const disponibleTag = d.disponible === false
            ? `<span class="tag" style="background:#fde8e8;color:#c0392b;">Agotado</span>`
            : `<span class="tag" style="background:#eaf7ea;color:#27ae60;">Disponible</span>`;
        const imgHtml = d.imagenBase64
            ? `<img class="item-row-img-thumb" src="${d.imagenBase64}" alt="${d.nombre}">`
            : `<div class="item-row-img-placeholder"><i class="fa-solid fa-image"></i></div>`;
        div.innerHTML = `
            ${imgHtml}
            <div class="item-row-info"><strong>${d.nombre}</strong> ${tag} ${disponibleTag}<p>${d.precio} &mdash; ${d.categoria}</p></div>
            <div class="item-row-actions">
                <button class="btn-edit-sm" title="Subir" onclick="reordenarPlato('${d.id}', ${idx}, -1)"><i class="fa-solid fa-arrow-up"></i></button>
                <button class="btn-edit-sm" title="Bajar" onclick="reordenarPlato('${d.id}', ${idx}, 1)"><i class="fa-solid fa-arrow-down"></i></button>
                <button class="btn-edit-sm" onclick="editarPlato('${d.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-danger" onclick="borrarPlato('${d.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>`;
        lista.appendChild(div);
    });
}

// Filtro de búsqueda y categoría
window.filtrarListaPlatos = function() {
    const q = (document.getElementById('platos-search')?.value || '').toLowerCase();
    const cat = document.getElementById('platos-filtro-cat')?.value || '';
    const filtered = _todosLosPlatos.filter(p =>
        (!q || p.nombre.toLowerCase().includes(q)) &&
        (!cat || p.categoria === cat)
    );
    renderListaPlatos(filtered);
};

window.borrarPlato = async (id) => { if (confirm('¿Eliminar este plato?')) { await deleteDoc(doc(db, 'platos', id)); cargarPlatos(); cargarDashboard(); } };

window.editarPlato = async (id) => {
    const docSnap = await getDoc(doc(db, 'platos', id));
    if (docSnap.exists()) {
        const d = docSnap.data();
        document.getElementById('plato-id').value = id;
        document.getElementById('plato-nombre').value = d.nombre;
        document.getElementById('plato-precio').value = d.precio;
        document.getElementById('plato-desc').value = d.descripcion || '';
        document.getElementById('plato-categoria').value = d.categoria;
        document.getElementById('plato-oferta-cb').checked = d.oferta || false;
        document.getElementById('plato-oferta-etiqueta').value = d.ofertaEtiqueta || '';
        document.getElementById('plato-oferta-precio').value = d.ofertaPrecio || '';
        document.getElementById('plato-oferta-fields').classList.toggle('hidden', !d.oferta);
        document.getElementById('plato-disponible').checked = d.disponible !== false;
        // Etiquetas
        document.querySelectorAll('.plato-etiqueta').forEach(cb => {
            cb.checked = (d.etiquetas || []).includes(cb.value);
        });

        if (d.imagenBase64) {
            estadoPlatoImg.base64 = d.imagenBase64;
            document.getElementById('plato-preview-box').style.display = 'flex';
            document.getElementById('plato-img-current').src = d.imagenBase64;
        } else {
            estadoPlatoImg.base64 = null;
            document.getElementById('plato-preview-box').style.display = 'none';
        }
        scrollToTop();
    }
};

/* Reordenar platos: intercambia el campo orden con el plato adyacente */
window.reordenarPlato = async (id, idx, dir) => {
    const arr = _todosLosPlatos;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= arr.length) return;
    const a = arr[idx], b = arr[newIdx];
    const ordenA = a.orden ?? idx;
    const ordenB = b.orden ?? newIdx;
    await Promise.all([
        updateDoc(doc(db, 'platos', a.id), { orden: ordenB }),
        updateDoc(doc(db, 'platos', b.id), { orden: ordenA })
    ]);
    cargarPlatos();
};

/* ============================
   BEBIDAS
============================ */
const bebidaForm = document.getElementById('bebida-form');
let _todasLasBebidas = [];

bebidaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = bebidaForm.querySelector('button[type="submit"]');
    btnSubmit.disabled = true; btnSubmit.textContent = "Guardando...";
    const id = document.getElementById('bebida-id').value;
    const etiquetas = [...document.querySelectorAll('.bebida-etiqueta:checked')].map(cb => cb.value);
    const data = {
        nombre: document.getElementById('bebida-nombre').value,
        precio: formatPrecio(document.getElementById('bebida-precio').value),
        subcategoria: document.getElementById('bebida-subcategoria').value,
        categoria: 'bebestibles',
        disponible: document.getElementById('bebida-disponible').checked,
        etiquetas: etiquetas
    };
    try {
        if (id) { await updateDoc(doc(db, 'bebidas', id), data); showStatus('bebida-status', 'Actualizado correctamente'); }
        else { data.orden = Date.now(); await addDoc(collection(db, 'bebidas'), data); showStatus('bebida-status', 'Bebida creada'); }
        bebidaForm.reset();
        document.getElementById('bebida-id').value = '';
        document.getElementById('bebida-disponible').checked = true;
        document.querySelectorAll('.bebida-etiqueta').forEach(cb => cb.checked = false);
        cargarBebidas();
        cargarDashboard();
    } catch (e) { showStatus('bebida-status', 'Error al guardar', true); }
    btnSubmit.disabled = false; btnSubmit.innerHTML = `Guardar`;
});
document.getElementById('bebida-cancel').addEventListener('click', () => {
    bebidaForm.reset();
    document.getElementById('bebida-id').value = '';
    document.getElementById('bebida-disponible').checked = true;
    document.querySelectorAll('.bebida-etiqueta').forEach(cb => cb.checked = false);
});

async function cargarBebidas() {
    const lista = document.getElementById('bebidas-lista');
    lista.innerHTML = 'Cargando...';
    const snap = await getDocs(query(collection(db, 'bebidas'), orderBy('orden')));
    _todasLasBebidas = [];
    snap.forEach(docSnap => {
        _todasLasBebidas.push({ id: docSnap.id, ...docSnap.data() });
    });
    renderListaBebidas(_todasLasBebidas);
}

function renderListaBebidas(bebidas) {
    const lista = document.getElementById('bebidas-lista');
    lista.innerHTML = '';
    if (!bebidas.length) { lista.innerHTML = '<p style="color:#999; text-align:center;">No hay bebidas.</p>'; return; }
    bebidas.forEach(d => {
        const div = document.createElement('div');
        div.className = 'item-row';
        const dispTag = d.disponible === false
            ? `<span class="tag" style="background:#fde8e8;color:#c0392b;">Agotada</span>`
            : '';
        div.innerHTML = `
            <div class="item-row-info"><strong>${d.nombre}</strong> ${dispTag}<p>${d.precio} - ${d.subcategoria}</p></div>
            <div class="item-row-actions">
                <button class="btn-edit-sm" onclick="editarBebida('${d.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-danger" onclick="borrarBebida('${d.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>`;
        lista.appendChild(div);
    });
}

window.filtrarListaBebidas = function() {
    const q = (document.getElementById('bebidas-search')?.value || '').toLowerCase();
    const filtered = _todasLasBebidas.filter(b => !q || b.nombre.toLowerCase().includes(q));
    renderListaBebidas(filtered);
};
window.borrarBebida = async (id) => { if (confirm('¿Eliminar?')) { await deleteDoc(doc(db, 'bebidas', id)); cargarBebidas(); cargarDashboard(); } };
window.editarBebida = async (id) => {
    const docSnap = await getDoc(doc(db, 'bebidas', id));
    if (docSnap.exists()) {
        const d = docSnap.data();
        document.getElementById('bebida-id').value = id;
        document.getElementById('bebida-nombre').value = d.nombre;
        document.getElementById('bebida-precio').value = d.precio;
        document.getElementById('bebida-subcategoria').value = d.subcategoria;
        document.getElementById('bebida-disponible').checked = d.disponible !== false;
        document.querySelectorAll('.bebida-etiqueta').forEach(cb => {
            cb.checked = (d.etiquetas || []).includes(cb.value);
        });
        scrollToTop();
    }
};

/* ============================
   CONFIGURACIÓN GENERAL
============================ */
window.cargarConfiguracionGeneral = async () => {
    window.recargarPortadas();
    const secciones = await getDoc(doc(db, 'configuracion', 'imagenesSeccion'));
    if (secciones.exists()) {
        const s = secciones.data();
        document.getElementById('qs-habilitar').checked = s.quienesSomosHabilitado !== false;
        document.getElementById('qs-texto').value = s.quienesSomosTexto || '';
        renderPreview('qs-img-img', s.quienesSomosImg, 'qs-img-no', 'btn-del-qs-img');
        document.getElementById('nc-habilitar').checked = s.nuestraCartaHabilitado !== false;
        document.getElementById('nc-titulo').value = s.nuestraCartaTitulo || '';
        renderPreview('nc-img-img', s.nuestraCartaImg, 'nc-img-no', 'btn-del-nc-img');
    }
};

window.recargarPortadas = async () => {
    const portadas = await getDoc(doc(db, 'configuracion', 'portadas'));
    if (portadas.exists()) {
        const p = portadas.data();
        renderPreview('portada-inicio-img', p.inicio, 'portada-inicio-no', 'btn-del-portada-inicio');
        renderPreview('portada-nosotros-img', p.nosotros, 'portada-nosotros-no', 'btn-del-portada-nosotros');
        renderPreview('portada-carta-img', p.carta, 'portada-carta-no', 'btn-del-portada-carta');
    }
};

window.guardarPortada = async (prefix, base64) => {
    const tipo = prefix.replace('portada-', '');
    showStatus(`portada-${tipo}-status`, 'Guardando...');
    await setDoc(doc(db, 'configuracion', 'portadas'), { [tipo]: base64 }, { merge: true });
    renderPreview(`portada-${tipo}-img`, base64, `portada-${tipo}-no`, `btn-del-portada-${tipo}`);
    showStatus(`portada-${tipo}-status`, 'Actualizado correctamente');
};
window.borrarPortada = async (tipo) => {
    if (confirm('¿Eliminar esta portada?')) {
        await setDoc(doc(db, 'configuracion', 'portadas'), { [tipo]: null }, { merge: true });
        renderPreview(`portada-${tipo}-img`, null, `portada-${tipo}-no`, `btn-del-portada-${tipo}`);
    }
};

window.cargarMenuDiaImgs = async () => {
    const menudia = await getDoc(doc(db, 'configuracion', 'menuDia'));
    if (menudia.exists()) {
        const m = menudia.data();
        renderPreview('menudia-img1-img', m.img1, 'menudia-img1-no', 'btn-del-menudia-img1');
        renderPreview('menudia-img2-img', m.img2, 'menudia-img2-no', 'btn-del-menudia-img2');
    }
};
window.guardarMenuDiaImg = async (prefix, base64) => {
    const tipo = prefix.replace('menudia-', '');
    showStatus(`menudia-${tipo}-status`, 'Guardando...');
    await setDoc(doc(db, 'configuracion', 'menuDia'), { [tipo]: base64 }, { merge: true });
    renderPreview(`menudia-${tipo}-img`, base64, `menudia-${tipo}-no`, `btn-del-menudia-${tipo}`);
    showStatus(`menudia-${tipo}-status`, 'Actualizado correctamente');
};
window.borrarMenuDiaImg = async (tipo) => {
    if (confirm('¿Eliminar esta imagen?')) {
        await setDoc(doc(db, 'configuracion', 'menuDia'), { [tipo]: null }, { merge: true });
        renderPreview(`menudia-${tipo}-img`, null, `menudia-${tipo}-no`, `btn-del-menudia-${tipo}`);
    }
};

window.cargarTextosMenuDia = async () => {
    const menudia = await getDoc(doc(db, 'configuracion', 'menuDia'));
    if (menudia.exists()) {
        const m = menudia.data();
        document.getElementById('md-incluye').value = m.incluye || '';
        document.getElementById('md-acomp').value = m.acompanamientos || '';
        document.getElementById('md-precio-s').value = m.precioServir || '';
        document.getElementById('md-precio-l').value = m.precioLlevar || '';
    }
};
window.guardarTextosMenuDia = async () => {
    showStatus('md-txt-status', 'Guardando...');
    await setDoc(doc(db, 'configuracion', 'menuDia'), {
        incluye: document.getElementById('md-incluye').value,
        acompanamientos: document.getElementById('md-acomp').value,
        precioServir: document.getElementById('md-precio-s').value,
        precioLlevar: document.getElementById('md-precio-l').value,
    }, { merge: true });
    showStatus('md-txt-status', 'Actualizado correctamente');
};

window.guardarQuienesSomos = async (prefix, base64) => {
    showStatus('qs-status', 'Guardando...');
    let updates = {
        quienesSomosHabilitado: document.getElementById('qs-habilitar').checked,
        quienesSomosTexto: document.getElementById('qs-texto').value
    };
    if (base64) { updates.quienesSomosImg = base64; renderPreview('qs-img-img', base64, 'qs-img-no', 'btn-del-qs-img'); }
    await setDoc(doc(db, 'configuracion', 'imagenesSeccion'), updates, { merge: true });
    showStatus('qs-status', 'Actualizado correctamente');
};
window.guardarNuestraCarta = async (prefix, base64) => {
    showStatus('nc-status', 'Guardando...');
    let updates = {
        nuestraCartaHabilitado: document.getElementById('nc-habilitar').checked,
        nuestraCartaTitulo: document.getElementById('nc-titulo').value
    };
    if (base64) { updates.nuestraCartaImg = base64; renderPreview('nc-img-img', base64, 'nc-img-no', 'btn-del-nc-img'); }
    await setDoc(doc(db, 'configuracion', 'imagenesSeccion'), updates, { merge: true });
    showStatus('nc-status', 'Actualizado correctamente');
};
window.borrarSeccionImagen = async (campo) => {
    if (confirm('¿Eliminar esta imagen?')) {
        let f = campo === 'quienesSomos' ? 'qs' : 'nc';
        await setDoc(doc(db, 'configuracion', 'imagenesSeccion'), { [campo + 'Img']: null }, { merge: true });
        renderPreview(`${f}-img-img`, null, `${f}-img-no`, `btn-del-${f}-img`);
    }
};

/* ============================
   HISTORIA (NOSOTROS) — Cada bloque independiente con su propio guardar/toggle
============================ */
let historiaData = {};

window.cargarHistoria = async () => {
    const docSnap = await getDoc(doc(db, 'configuracion', 'historia'));
    historiaData = docSnap.exists() ? docSnap.data() : { b1: {}, b2: {}, b3: {} };
    renderHistoriaForms();
};

function renderHistoriaForms() {
    const cont = document.getElementById('hist-blocks');
    cont.innerHTML = '';
    const titulos = ['Nuestros Orígenes', 'Referente Gastronómico', 'Familia y Comunidad'];
    for (let i = 1; i <= 3; i++) {
        let b = historiaData[`b${i}`] || {};
        const habilitado = b.habilitado !== false;
        cont.innerHTML += `
            <div class="seccion-card" id="hist-card-${i}">
                <h3>
                    <span><i class="fa-solid fa-book-open"></i> Bloque ${i}: ${b.tit || titulos[i-1]}</span>
                </h3>
                <div class="switch-container">
                    <label class="switch">
                        <input type="checkbox" id="hist-habilitar-${i}" ${habilitado ? 'checked' : ''} onchange="guardarBloqueHistoria(${i})">
                        <span class="slider"></span>
                    </label>
                    <span>Mostrar este bloque en la página</span>
                </div>
                <label>Título del bloque</label>
                <input type="text" id="hist-tit${i}" value="${b.tit || ''}" placeholder="${titulos[i-1]}...">
                <label>Texto descriptivo</label>
                <textarea id="hist-txt${i}" rows="3" placeholder="Descripción...">${b.txt || ''}</textarea>
                <label>Imagen del bloque</label>
                <div class="preview-box" style="height:160px; max-width:100%;">
                    <img id="hist-img${i}-img" ${b.img ? `src="${b.img}"` : 'class="hidden"'} style="width:100%; height:100%; object-fit:cover;">
                    <div class="no-img-text ${b.img ? 'hidden' : ''}" id="hist-img${i}-no">Sin imagen</div>
                    <button type="button" class="btn-delete-img ${b.img ? '' : 'hidden'}" id="btn-del-hist-img${i}" onclick="borrarHistoriaImg(${i})"><i class="fa-solid fa-trash"></i></button>
                </div>
                <input type="file" id="hist-file${i}" accept="image/*" style="margin-top:8px;" onchange="recortarHistoria(${i}, this)">
                <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
                    <button class="btn-primary" onclick="guardarBloqueHistoria(${i})"><i class="fa-solid fa-floppy-disk"></i> Guardar Bloque ${i}</button>
                    <button class="btn-secondary" onclick="cargarHistoria()">Restaurar</button>
                </div>
                <p id="hist-${i}-status" class="status-msg"></p>
            </div>
        `;
    }
}

window.guardarBloqueHistoria = async (i) => {
    showStatus(`hist-${i}-status`, 'Guardando...');
    if (!historiaData[`b${i}`]) historiaData[`b${i}`] = {};
    historiaData[`b${i}`].tit = document.getElementById(`hist-tit${i}`).value;
    historiaData[`b${i}`].txt = document.getElementById(`hist-txt${i}`).value;
    historiaData[`b${i}`].habilitado = document.getElementById(`hist-habilitar-${i}`).checked;
    await setDoc(doc(db, 'configuracion', 'historia'), historiaData, { merge: true });
    showStatus(`hist-${i}-status`, 'Actualizado correctamente');
};

window.guardarHistoriaImgSolo = async (idx, base64) => {
    showStatus(`hist-${idx}-status`, 'Guardando imagen...');
    if (!historiaData[`b${idx}`]) historiaData[`b${idx}`] = {};
    historiaData[`b${idx}`].img = base64;
    // También guarda título y texto que haya en los campos
    historiaData[`b${idx}`].tit = document.getElementById(`hist-tit${idx}`)?.value || historiaData[`b${idx}`].tit || '';
    historiaData[`b${idx}`].txt = document.getElementById(`hist-txt${idx}`)?.value || historiaData[`b${idx}`].txt || '';
    historiaData[`b${idx}`].habilitado = document.getElementById(`hist-habilitar-${idx}`)?.checked !== false;
    await setDoc(doc(db, 'configuracion', 'historia'), historiaData, { merge: true });
    renderPreview(`hist-img${idx}-img`, base64, `hist-img${idx}-no`, `btn-del-hist-img${idx}`);
    showStatus(`hist-${idx}-status`, 'Imagen guardada correctamente');
};

window.borrarHistoriaImg = async (i) => {
    if (confirm('¿Eliminar esta imagen?')) {
        if (historiaData[`b${i}`]) historiaData[`b${i}`].img = null;
        await setDoc(doc(db, 'configuracion', 'historia'), historiaData, { merge: true });
        renderPreview(`hist-img${i}-img`, null, `hist-img${i}-no`, `btn-del-hist-img${i}`);
    }
};

/* ============================
   GALERIA NUESTRO ESPACIO
============================ */
window.cargarGaleria = async () => {
    const docSnap = await getDoc(doc(db, 'configuracion', 'galeriaOpciones'));
    if (docSnap.exists()) document.getElementById('galeria-habilitar').checked = docSnap.data().habilitado !== false;

    const cont = document.getElementById('galeria-contenedor');
    const addBtn = `<div class="galeria-item galeria-add" onclick="document.getElementById('galeria-file').click()"><i class="fa-solid fa-plus" style="font-size:1.5rem; margin-bottom:5px;"></i> Agregar</div>`;
    cont.innerHTML = 'Cargando...';
    const snap = await getDocs(collection(db, 'galeria'));
    let html = '';
    snap.forEach(d => {
        html += `<div class="galeria-item"><img src="${d.data().url}" style="width:100%;height:100%;object-fit:cover;"><button class="btn-delete-img" onclick="borrarGaleria('${d.id}')"><i class="fa-solid fa-trash"></i></button></div>`;
    });
    cont.innerHTML = addBtn + html;
};

document.getElementById('galeria-habilitar').addEventListener('change', async (e) => {
    showStatus('galeria-status', 'Guardando...');
    await setDoc(doc(db, 'configuracion', 'galeriaOpciones'), { habilitado: e.target.checked }, { merge: true });
    showStatus('galeria-status', 'Actualizado correctamente');
});

window.subirMultiGaleria = async (input) => {
    if (input.files.length === 0) return;

    // Verificar límite de 8 imágenes
    const snapActual = await getDocs(collection(db, 'galeria'));
    const actuales = snapActual.size;
    if (actuales >= 8) {
        showStatus('galeria-status', 'Límite de 8 imágenes alcanzado. Elimina alguna antes de agregar.', true);
        input.value = '';
        return;
    }

    if (input.files.length === 1) {
        showStatus('galeria-status', 'Procesando imagen...');
        const b64_temp = await compressImage(input.files[0]);
        const b64 = await openCropper(b64_temp, 4 / 3);
        input.value = '';
        if (b64) {
            showStatus('galeria-status', 'Subiendo imagen...');
            await addDoc(collection(db, 'galeria'), { url: b64, ts: Date.now() });
            showStatus('galeria-status', 'Imagen agregada');
            cargarGaleria();
            cargarDashboard();
        } else { showStatus('galeria-status', ''); }
    } else {
        const disponibles = 8 - actuales;
        const archivos = [...input.files].slice(0, disponibles);
        if (archivos.length < input.files.length) {
            showStatus('galeria-status', `Solo se agregarán ${disponibles} imágenes (límite 8).`);
        } else {
            showStatus('galeria-status', 'Subiendo imágenes...');
        }
        for (let file of archivos) {
            const b64 = await compressImage(file);
            await addDoc(collection(db, 'galeria'), { url: b64, ts: Date.now() });
        }
        input.value = '';
        showStatus('galeria-status', 'Imágenes agregadas');
        cargarGaleria();
        cargarDashboard();
    }
};

window.borrarGaleria = async (id) => {
    if (confirm('¿Eliminar imagen de la galería?')) {
        await deleteDoc(doc(db, 'galeria', id));
        cargarGaleria();
    }
};
