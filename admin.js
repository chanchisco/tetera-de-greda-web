import { addDoc,getDocs,setDoc,deleteDoc,updateDoc,getDoc,pinRevision,unpinRevision } from './content-client.js';
import { editImage,prepareImage } from './image-editor.js';
import { initContentTools,stageImage,bindImageTools,updateMetrics,pendingImage,canReplaceForm } from './content-tools.js';
import { db, auth } from './firebase-config.js';
import { collection, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { watchAccess, completeMfa } from './admin-management.js';
// Los editores escriben contenido que luego ve el administrador completo.
// Tratarlo como texto evita que pueda ejecutar HTML con sus permisos.
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ============================
   AUTH Y UI BÁSICA
============================ */
const loginPage = document.getElementById('login-page');
const panelRoot = document.getElementById('panel-root');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const btnLogout = document.getElementById('btn-logout');

onAuthStateChanged(auth, user => {
    loginPage.style.display = 'flex'; panelRoot.classList.add('hidden');
    watchAccess(user, initAdmin);
    if (!user) loginError.textContent = '';
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submit = loginForm.querySelector('button[type="submit"]');
    submit.disabled = true; loginError.textContent = 'Ingresando…';
    try {
        const previousUid = auth.currentUser?.uid;
        const credential = await signInWithEmailAndPassword(auth, document.getElementById('login-email').value.trim(), document.getElementById('login-password').value);
        // Si sigue siendo la misma cuenta, Auth puede no emitir otro cambio de
        // usuario. Reabrir la comprobación permite reintentar desde Ingresar.
        if (previousUid === credential.user.uid) watchAccess(credential.user, initAdmin);
        document.getElementById('login-password').value = '';
    } catch(err) {
        if (err.code === 'auth/multi-factor-auth-required') {
            try { const result = await completeMfa(err); loginError.textContent = result ? '' : 'Verificación cancelada. Puedes volver a ingresar.'; }
            catch { loginError.textContent = 'No se pudo verificar el código. Ingresa nuevamente y usa un código vigente.'; }
        } else loginError.textContent = 'No se pudo ingresar. Revisa los datos y la conexión; si persiste, solicita ayuda.';
    } finally { submit.disabled = false; }
});
btnLogout.addEventListener('click', () => signOut(auth));

function showStatus(elemId, msg, isError = false) {
    const el = document.getElementById(elemId);
    if (!el) { console.warn('showStatus: elemento no encontrado:', elemId); return; }
    el.textContent = msg;
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
        if (di) di.textContent = `${galeriaSnap.size} / 15`;
        updateMetrics(platosSnap,bebidasSnap,galeriaSnap);
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
async function openCropper(source,ratio,context) { return editImage(source,ratio,context); }

/* ============================
   HELPERS
============================ */
async function compressImage(file) { return prepareImage(file); }
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
        window.actualizarFotoPlato(b64);
        showStatus('plato-status', 'Imagen lista. Recuerda guardar.');
    } else {
        showStatus('plato-status', '');
    }
};

// Genera la función de recorte para cada contexto
window.recortarYGuardar = async (prefix, input, ratio, saveFunc) => {
    if (input.files.length === 0) return;
    const b64_temp = await compressImage(input.files[0]);
    const b64 = await openCropper(b64_temp, ratio, prefix);
    input.value = '';
    if (b64) stageImage(prefix, b64, saveFunc);
};

// Para historia (necesita statusId propio)
window.recortarHistoria = async (idx, input) => {
    if (input.files.length === 0) return;
    showStatus(`hist-${idx}-status`, 'Procesando imagen...');
    const b64_temp = await compressImage(input.files[0]);
    const b64 = await openCropper(b64_temp, 4 / 3, `hist-img${idx}`);
    input.value = '';
    if (!b64) { showStatus(`hist-${idx}-status`, ''); return; }
    stageImage(`hist-img${idx}`, b64, (_prefix,image)=>guardarHistoriaImgSolo(idx,image));
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
        imagenURL: null,
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
    if(document.getElementById('plato-id').value)unpinRevision('platos/'+document.getElementById('plato-id').value);
    platoForm.reset();
    document.getElementById('plato-id').value = '';
    estadoPlatoImg.base64 = null;
    document.getElementById('plato-img-current').removeAttribute('src');
    document.getElementById('plato-preview-box').style.display = 'none';
    document.getElementById('plato-oferta-cb').checked = false;
    document.getElementById('plato-oferta-fields').classList.add('hidden');
    document.getElementById('plato-disponible').checked = true;
    document.querySelectorAll('.plato-etiqueta').forEach(cb => cb.checked = false);
}
document.getElementById('plato-cancel').addEventListener('click', limpiarPlatoForm);
document.getElementById('btn-eliminar-foto-plato').addEventListener('click', () => {
    document.getElementById('plato-preview-box').style.display = 'none';
    document.getElementById('plato-img-current').removeAttribute('src');
    estadoPlatoImg.base64 = null;
    document.dispatchEvent(new Event('plato-image-changed'));
});

// Lista de todos los platos y estado de tabs/sortable
let _todosLosPlatos = [];
let _categoriaActivaAdmin = 'todos';
let _sortableInstance = null;
let _busquedaActiva = '';

const CATEGORIAS_ADMIN = [
    { val: 'todos',        label: '📋 Todos' },
    { val: 'carnes',       label: '🥩 Carnes' },
    { val: 'mar',          label: '🐟 Del Mar' },
    { val: 'fondos',       label: '🍲 Tradicionales' },
    { val: 'entradas',     label: '🥗 Entradas' },
    { val: 'guarniciones', label: '🍟 Guarniciones' },
    { val: 'ninos',        label: '🧒 Niños' },
    { val: 'postres',      label: '🍮 Postres' },
];

function renderCategoryTabs() {
    const cont = document.getElementById('platos-cat-tabs');
    if (!cont) return;
    cont.innerHTML = '';
    CATEGORIAS_ADMIN.forEach(cat => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cat-tab-btn' + (_categoriaActivaAdmin === cat.val ? ' active' : '');
        btn.textContent = cat.label;
        btn.onclick = () => {
            _categoriaActivaAdmin = cat.val;
            _busquedaActiva = '';
            const searchEl = document.getElementById('platos-search');
            if (searchEl) searchEl.value = '';
            renderCategoryTabs();
            renderListaPlatos(platosVisibles());
        };
        cont.appendChild(btn);
    });
}

function platosVisibles() {
    let arr = _categoriaActivaAdmin === 'todos'
        ? _todosLosPlatos
        : _todosLosPlatos.filter(p => p.categoria === _categoriaActivaAdmin);
    if (_busquedaActiva) {
        arr = arr.filter(p => p.nombre.toLowerCase().includes(_busquedaActiva));
    }
    if(window.filtroSinFoto) arr=arr.filter(p=>!p.imagenBase64&&!p.imagenURL);
    return arr;
}

async function cargarPlatos() {
    const lista = document.getElementById('platos-lista');
    lista.innerHTML = '<p style="color:#aaa;">Cargando...</p>';
    try {
        const snap = await getDocs(query(collection(db, 'platos'), orderBy('orden')));
        _todosLosPlatos = [];
        snap.forEach(docSnap => {
            _todosLosPlatos.push({ ...docSnap.data(), id: docSnap.id });
        });
    } catch(e) {
        // Si no hay índice de 'orden', cargar sin ordenar
        const snap = await getDocs(collection(db, 'platos'));
        _todosLosPlatos = [];
        snap.forEach(docSnap => {
            _todosLosPlatos.push({ ...docSnap.data(), id: docSnap.id });
        });
    }
    renderCategoryTabs();
    renderListaPlatos(platosVisibles());
}

function renderListaPlatos(platos) {
    const lista = document.getElementById('platos-lista');
    lista.innerHTML = '';

    if (!platos.length) {
        lista.innerHTML = '<p style="color:#999; text-align:center; padding:20px;">No hay platos en esta categoría.</p>';
        if (_sortableInstance) { _sortableInstance.destroy(); _sortableInstance = null; }
        return;
    }

    platos.forEach(d => {
        const div = document.createElement('div');
        div.className = 'item-row';
        div.dataset.id = d.id;
        const tag = d.oferta ? `<span class="tag tag-oferta"><i class="fa-solid fa-tag"></i> Oferta</span>` : '';
        const dispTag = d.disponible === false
            ? `<span class="tag" style="background:#fde8e8;color:#c0392b;font-size:0.72rem;">Agotado</span>`
            : `<span class="tag" style="background:#eaf7ea;color:#27ae60;font-size:0.72rem;">✓ Disp.</span>`;
        const imgHtml = d.imagenBase64
            ? `<img class="item-row-img-thumb" src="${escapeHtml(d.imagenBase64)}" alt="${escapeHtml(d.nombre)}">`
            : `<div class="item-row-img-placeholder"><i class="fa-solid fa-image"></i></div>`;
        div.innerHTML = `
            <div class="drag-handle" title="Mantén presionado y arrastra para reordenar">
                <i class="fa-solid fa-grip-vertical"></i>
            </div>
            ${imgHtml}
            <div class="item-row-info">
                <strong>${escapeHtml(d.nombre)}</strong> ${tag} ${dispTag}
                <p style="font-size:0.78rem; color:#888;">${escapeHtml(d.precio)} &mdash; ${escapeHtml(d.categoria)}</p>
            </div>
            <div class="item-row-actions">
                <button class="btn-edit-sm" title="Editar" aria-label="Editar plato"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-danger" title="Eliminar" aria-label="Eliminar plato"><i class="fa-solid fa-trash"></i></button>
            </div>`;
        div.querySelector('.btn-edit-sm').onclick = () => window.editarPlato(d.id);
        div.querySelector('.btn-danger').onclick = () => window.borrarPlato(d.id);
        lista.appendChild(div);
    });

    // Destruir instancia anterior si existe
    if (_sortableInstance) { _sortableInstance.destroy(); _sortableInstance = null; }

    // Solo habilitar drag si NO hay búsqueda activa (para no confundir posiciones)
    if (!_busquedaActiva && typeof Sortable !== 'undefined') {
        _sortableInstance = new Sortable(lista, {
            handle: '.drag-handle',
            animation: 180,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            onStart: () => {
                lista.style.minHeight = lista.offsetHeight + 'px';
            },
            onEnd: async () => {
                lista.style.minHeight = '';
                await guardarNuevoOrdenPlatos();
            }
        });
    }
}

/* Guarda el nuevo orden en Firestore solo para las placas visibles,
   manteniendo el orden de las demás categorías intacto */
async function guardarNuevoOrdenPlatos() {
    const rows = document.querySelectorAll('#platos-lista .item-row');
    const idsNuevoOrden = [...rows].map(r => r.dataset.id);

    // Obtener los valores de 'orden' actuales de las filas visibles (en su orden previo)
    const platosEnVista = idsNuevoOrden
        .map(id => _todosLosPlatos.find(p => p.id === id))
        .filter(Boolean);

    // Repartir los mismos valores de orden entre las nuevas posiciones
    // (así otras categorías no se ven afectadas)
    const ordenesActuales = platosEnVista.map(p => p.orden ?? Date.now()).sort((a, b) => a - b);

    // Si todos los valores son iguales o hay duplicados, generar nuevos
    const distintos = new Set(ordenesActuales).size === ordenesActuales.length;
    const valoresParaAsignar = distintos
        ? ordenesActuales
        : idsNuevoOrden.map((_, i) => Date.now() + i * 100);

    showStatus('platos-status', 'Guardando orden...');
    const updates = [];
    idsNuevoOrden.forEach((id, i) => {
        const plato = _todosLosPlatos.find(p => p.id === id);
        if (!plato) return;
        const nuevoOrden = valoresParaAsignar[i];
        plato.orden = nuevoOrden; // actualizar en memoria
        updates.push(updateDoc(doc(db, 'platos', id), { orden: nuevoOrden }));
    });

    try {
        await Promise.all(updates);
        showStatus('platos-status', '✓ Orden guardado');
    } catch(e) {
        showStatus('platos-status', 'Error al guardar orden', true);
    }
}

// Búsqueda: deshabilita drag cuando hay texto (para no confundir orden)
window.filtrarListaPlatos = function() {
    document.getElementById('content-clear-missing').hidden=!window.filtroSinFoto;
    _busquedaActiva = (document.getElementById('platos-search')?.value || '').toLowerCase().trim();
    renderListaPlatos(platosVisibles());
    // Mostrar aviso si búsqueda activa
    const hint = document.querySelector('.reorder-hint');
    if (hint) {
        hint.style.opacity = _busquedaActiva ? '0.3' : '1';
        hint.title = _busquedaActiva ? 'Limpia la búsqueda para poder reordenar' : '';
    }
};

window.borrarPlato = async (id) => {
    if (confirm('¿Enviar a la papelera? Podrás recuperarlo durante 5 días.')) {
        await deleteDoc(doc(db, 'platos', id));
        if(document.getElementById('plato-id').value===id)limpiarPlatoForm();
        _todosLosPlatos = _todosLosPlatos.filter(p => p.id !== id);
        renderCategoryTabs();
        renderListaPlatos(platosVisibles());
        cargarDashboard();
    }
};

window.editarPlato = async (id) => {
    if(!canReplaceForm('plato-form'))return;
    const docSnap = await getDoc(doc(db, 'platos', id));
    unpinRevision('platos/'+id);pinRevision('platos/'+id,docSnap.data()?._revision||0);
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
        document.querySelectorAll('.plato-etiqueta').forEach(cb => {
            cb.checked = (d.etiquetas || []).includes(cb.value);
        });
        if (d.imagenBase64 || d.imagenURL) {
            estadoPlatoImg.base64 = d.imagenBase64 || d.imagenURL;
            document.getElementById('plato-preview-box').style.display = 'flex';
            document.getElementById('plato-img-current').src = d.imagenBase64 || d.imagenURL;
        } else {
            estadoPlatoImg.base64 = null;
            document.getElementById('plato-img-current').removeAttribute('src');
            document.getElementById('plato-preview-box').style.display = 'none';
        }
        scrollToTop();
    }
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
        _todasLasBebidas.push({ ...docSnap.data(), id: docSnap.id });
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
            <div class="item-row-info"><strong>${escapeHtml(d.nombre)}</strong> ${dispTag}<p>${escapeHtml(d.precio)} - ${escapeHtml(d.subcategoria)}</p></div>
            <div class="item-row-actions">
                <button class="btn-edit-sm" aria-label="Editar bebida"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-danger" aria-label="Eliminar bebida"><i class="fa-solid fa-trash"></i></button>
            </div>`;
        div.querySelector('.btn-edit-sm').onclick = () => window.editarBebida(d.id);
        div.querySelector('.btn-danger').onclick = () => window.borrarBebida(d.id);
        lista.appendChild(div);
    });
}

window.filtrarListaBebidas = function() {
    const q = (document.getElementById('bebidas-search')?.value || '').toLowerCase();
    const filtered = _todasLasBebidas.filter(b => !q || b.nombre.toLowerCase().includes(q));
    renderListaBebidas(filtered);
};
window.borrarBebida = async (id) => { if (confirm('¿Enviar a la papelera? Podrás recuperarlo durante 5 días.')) { await deleteDoc(doc(db, 'bebidas', id)); cargarBebidas(); cargarDashboard(); } };
window.editarBebida = async (id) => {
    if(!canReplaceForm('bebida-form'))return;
    const docSnap = await getDoc(doc(db, 'bebidas', id));
    unpinRevision('bebidas/'+id);pinRevision('bebidas/'+id,docSnap.data()?._revision||0);
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
    if (confirm('¿Enviar a la papelera? Podrás recuperarlo durante 5 días.')) {
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
    if (confirm('¿Enviar a la papelera? Podrás recuperarlo durante 5 días.')) {
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
    base64 ||= pendingImage('qs');
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
    base64 ||= pendingImage('nc');
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
    if (confirm('¿Enviar a la papelera? Podrás recuperarlo durante 5 días.')) {
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
                    <span><i class="fa-solid fa-book-open"></i> Bloque ${i}: ${escapeHtml(b.tit || titulos[i-1])}</span>
                </h3>
                <div class="switch-container">
                    <label class="switch">
                        <input type="checkbox" id="hist-habilitar-${i}" ${habilitado ? 'checked' : ''} onchange="guardarBloqueHistoria(${i})">
                        <span class="slider"></span>
                    </label>
                    <span>Mostrar este bloque en la página</span>
                </div>
                <label>Título del bloque</label>
                <input type="text" id="hist-tit${i}" value="${escapeHtml(b.tit || '')}" placeholder="${titulos[i-1]}...">
                <label>Texto descriptivo</label>
                <textarea id="hist-txt${i}" rows="3" placeholder="Descripción...">${escapeHtml(b.txt || '')}</textarea>
                <label>Imagen del bloque</label>
                <div class="preview-box" style="height:160px; max-width:100%;">
                    <img id="hist-img${i}-img" ${b.img ? `src="${escapeHtml(b.img)}"` : 'class="hidden"'} style="width:100%; height:100%; object-fit:cover;">
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
    if(pendingImage(`hist-img${i}`)){historiaData[`b${i}`] ||= {};historiaData[`b${i}`].img=pendingImage(`hist-img${i}`);}
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
    if (confirm('¿Enviar a la papelera? Podrás recuperarlo durante 5 días.')) {
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
    const addBtn = `<button type="button" class="galeria-item galeria-add" onclick="document.getElementById('galeria-file').click()">+ Agregar foto</button>`;
    cont.innerHTML = 'Cargando...';
    const snap = await getDocs(collection(db, 'galeria'));
    cont.innerHTML = snap.size < 15 ? addBtn : '';
    document.getElementById('galeria-capacidad').textContent = `${snap.size} de 15 fotos. Puedes agregar ${Math.max(0,15-snap.size)} más.`;
    [...snap.docs].sort((a,b)=>(a.data().orden||a.data().ts||0)-(b.data().orden||b.data().ts||0)).forEach(d => {
        const item = document.createElement('div'); item.className = 'galeria-item';
        const image = document.createElement('img'); image.src = d.data().url; image.alt = 'Foto del local';
        const button = document.createElement('button'); button.type = 'button'; button.className = 'btn-delete-img'; button.setAttribute('aria-label', 'Eliminar foto'); button.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i>';
        button.onclick = () => window.borrarGaleria(d.id); item.append(image, button); cont.append(item);
        bindImageTools(image, `galeria-${d.id}`, 1, async (_prefix,b64)=>{await updateDoc(doc(db,'galeria',d.id),{url:b64});await cargarGaleria();});
        const orderButton=document.createElement('button');orderButton.type='button';orderButton.className='content-action';orderButton.textContent='Mover al inicio';orderButton.onclick=async()=>{await updateDoc(doc(db,'galeria',d.id),{orden:Date.now()*-1});await cargarGaleria();};item.append(orderButton);
        const describe=document.createElement('button');describe.type='button';describe.className='content-action';describe.textContent='Descripción';describe.onclick=async()=>{const value=prompt('Descripción accesible de la foto (hasta 200 caracteres):',d.data().descripcion||'Foto del local');if(value===null)return;if(value.length>200){showStatus('galeria-status','Usa hasta 200 caracteres.',true);return;}await updateDoc(doc(db,'galeria',d.id),{descripcion:value});await cargarGaleria();};item.append(describe);
        const visibility=document.createElement('button');visibility.type='button';visibility.className='content-action';visibility.textContent=d.data().disponible===false?'Mostrar foto':'Ocultar foto';visibility.onclick=async()=>{await updateDoc(doc(db,'galeria',d.id),{disponible:d.data().disponible===false});await cargarGaleria();};item.append(visibility);
    });
};

document.getElementById('galeria-habilitar').addEventListener('change', async (e) => {
    showStatus('galeria-status', 'Guardando...');
    await setDoc(doc(db, 'configuracion', 'galeriaOpciones'), { habilitado: e.target.checked }, { merge: true });
    showStatus('galeria-status', 'Actualizado correctamente');
});

window.subirMultiGaleria = async input => {
 const files=[...input.files];input.value='';if(!files.length)return;
 const current=await getDocs(collection(db,'galeria'));
 if(current.size>=15){showStatus('galeria-status','La galería ya tiene 15 fotos.',true);return;}
 let added=0;
 for(const [index,file] of files.slice(0,15-current.size).entries()) {
  try{showStatus('galeria-status',`Revisando foto ${index+1} de ${Math.min(files.length,15-current.size)}…`);
   const source=await prepareImage(file),image=await editImage(source,1,'galeria-new');
   if(!image)continue;if(!confirm('¿Guardar esta foto en la galería?'))continue;
   await addDoc(collection(db,'galeria'),{url:image,ts:Date.now(),orden:Date.now(),descripcion:'Foto del local'});added++;
  }catch(error){showStatus('galeria-status',error.message,true);await cargarGaleria();return;}
 }
 await cargarGaleria();cargarDashboard();showStatus('galeria-status',`Se guardaron ${added} fotos. Las canceladas no se publicaron.`);
};

window.borrarGaleria = async (id) => {
    if (confirm('¿Enviar esta foto a la papelera? Podrás recuperarla durante 5 días.')) {
        await deleteDoc(doc(db, 'galeria', id));
        cargarGaleria();
    }
};

window.actualizarFotoPlato = image => {estadoPlatoImg.base64=image;document.getElementById('plato-img-current').src=image;document.getElementById('plato-preview-box').style.display='flex';showStatus('plato-status','Imagen lista. Recuerda guardar el plato.');document.dispatchEvent(new Event('plato-image-changed'));};
initContentTools();

window.verTodosLosPlatos=()=>{window.filtroSinFoto=false;renderListaPlatos(platosVisibles());};
