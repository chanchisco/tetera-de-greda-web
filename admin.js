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
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value);
    } catch(err) { loginError.textContent = "Credenciales incorrectas."; }
});
btnLogout.addEventListener('click', () => signOut(auth));

// UI general
function showStatus(elemId, msg, isError = false) {
    const el = document.getElementById(elemId);
    el.innerHTML = isError ? `<i class="fa-solid fa-triangle-exclamation"></i> ${msg}` : `<i class="fa-solid fa-rotate"></i> ${msg}`;
    el.className = 'status-msg ' + (isError ? 'status-err' : 'status-ok');
    setTimeout(() => { el.innerHTML = ''; }, 3500);
}

function initAdmin() {
    cargarPlatos();
    cargarBebidas();
    cargarConfiguracionGeneral();
    cargarHistoria();
    cargarGaleria();
}

// Nav Tabs
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`page-${btn.dataset.page}`).classList.add('active');
    });
});

// Colapsables Móvil
document.getElementById('btn-toggle-platos').addEventListener('click', (e) => {
    document.getElementById('platos-lista').classList.toggle('collapsed');
});
document.getElementById('btn-toggle-bebidas').addEventListener('click', (e) => {
    document.getElementById('bebidas-lista').classList.toggle('collapsed');
});

// Checkbox Oferta Platos
document.getElementById('plato-oferta-cb').addEventListener('change', (e) => {
    const fields = document.getElementById('plato-oferta-fields');
    if(e.target.checked) fields.classList.remove('hidden');
    else fields.classList.add('hidden');
});

/* ============================
   UTILIDADES IMÁGENES
============================ */
async function compressImage(file) {
    const options = { maxSizeMB: 0.25, maxWidthOrHeight: 1200, useWebWorker: true };
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
    if(src) { img.src = src; img.classList.remove('hidden'); no.classList.add('hidden'); if(del) del.classList.remove('hidden'); }
    else { img.classList.add('hidden'); no.classList.remove('hidden'); img.src = ''; if(del) del.classList.add('hidden'); }
}

/* ============================
   PLATOS
============================ */
const platoForm = document.getElementById('plato-form');
let estadoPlatoImg = { base64: null, pos: { x:50, y:50 }, zoom: 100 };

platoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = platoForm.querySelector('button[type="submit"]');
    btnSubmit.disabled = true; btnSubmit.textContent = "Guardando...";

    const id = document.getElementById('plato-id').value;
    const nombre = document.getElementById('plato-nombre').value;
    const precio = document.getElementById('plato-precio').value;
    const desc = document.getElementById('plato-desc').value;
    const categoria = document.getElementById('plato-categoria').value;
    
    // Oferta
    const isOferta = document.getElementById('plato-oferta-cb').checked;
    const ofertaEtiq = document.getElementById('plato-oferta-etiqueta').value;
    const ofertaPrecio = document.getElementById('plato-oferta-precio').value;

    const fileInput = document.getElementById('plato-imagen');
    const fotoEliminada = document.getElementById('plato-foto-eliminada').value === 'true';

    let imagenBase64 = null;
    let pos = null;

    if (fileInput.files.length > 0) {
        imagenBase64 = await compressImage(fileInput.files[0]);
        pos = { 
            x: parseFloat(document.getElementById('plato-img-pos-x').value), 
            y: parseFloat(document.getElementById('plato-img-pos-y').value),
            zoom: parseFloat(document.getElementById('plato-img-size').value)
        };
    } else if (!fotoEliminada && estadoPlatoImg.base64) {
        imagenBase64 = estadoPlatoImg.base64;
        pos = { 
            x: parseFloat(document.getElementById('plato-img-pos-x').value), 
            y: parseFloat(document.getElementById('plato-img-pos-y').value),
            zoom: parseFloat(document.getElementById('plato-img-size').value)
        };
    }

    const data = { 
        nombre, precio, descripcion: desc, categoria, 
        imagenBase64, imagenPos: pos,
        oferta: isOferta, ofertaEtiqueta: ofertaEtiq, ofertaPrecio: ofertaPrecio
    };

    try {
        if (id) {
            await updateDoc(doc(db, 'platos', id), data);
            showStatus('plato-status', 'Actualizado correctamente');
        } else {
            data.orden = 999;
            await addDoc(collection(db, 'platos'), data);
            showStatus('plato-status', 'Plato creado');
        }
        platoForm.reset();
        document.getElementById('plato-id').value = '';
        estadoPlatoImg = { base64: null, pos: { x:50, y:50 }, zoom: 100 };
        document.getElementById('plato-preview-box').style.display = 'none';
        document.getElementById('img-editor-section').classList.add('hidden');
        document.getElementById('plato-oferta-cb').checked = false;
        document.getElementById('plato-oferta-fields').classList.add('hidden');
        cargarPlatos();
    } catch(e) {
        showStatus('plato-status', 'Error al guardar', true);
    }
    btnSubmit.disabled = false; btnSubmit.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Plato`;
});

document.getElementById('plato-cancel').addEventListener('click', () => {
    platoForm.reset(); document.getElementById('plato-id').value = '';
    estadoPlatoImg = { base64: null, pos: { x:50, y:50 }, zoom: 100 };
    document.getElementById('plato-preview-box').style.display = 'none';
    document.getElementById('img-editor-section').classList.add('hidden');
    document.getElementById('plato-oferta-cb').checked = false;
    document.getElementById('plato-oferta-fields').classList.add('hidden');
});

document.getElementById('btn-eliminar-foto-plato').addEventListener('click', () => {
    document.getElementById('plato-foto-eliminada').value = 'true';
    document.getElementById('plato-preview-box').style.display = 'none';
    estadoPlatoImg.base64 = null;
    document.getElementById('img-editor-section').classList.add('hidden');
});

// EDITOR DE IMAGEN (Drag & Zoom)
const filePlato = document.getElementById('plato-imagen');
const editorSec = document.getElementById('img-editor-section');
const editorPreview = document.getElementById('img-editor-preview');
const wrapEditor = document.getElementById('img-editor-wrap');
const inputX = document.getElementById('plato-img-pos-x');
const inputY = document.getElementById('plato-img-pos-y');
const inputZ = document.getElementById('plato-img-size');
const zoomSlider = document.getElementById('plato-img-zoom');

function actualizarBgEditor() {
    editorPreview.style.backgroundPosition = `${inputX.value}% ${inputY.value}%`;
    editorPreview.style.backgroundSize = `${inputZ.value}%`;
}

filePlato.addEventListener('change', async (e) => {
    if(e.target.files.length > 0) {
        document.getElementById('plato-foto-eliminada').value = 'false';
        const b64 = await compressImage(e.target.files[0]);
        estadoPlatoImg.base64 = b64;
        estadoPlatoImg.zoom = 100;
        inputX.value = 50; inputY.value = 50; inputZ.value = 100; zoomSlider.value = 100;
        editorPreview.style.backgroundImage = `url('${b64}')`;
        editorSec.classList.remove('hidden');
        actualizarBgEditor();
    } else if(estadoPlatoImg.base64 && document.getElementById('plato-foto-eliminada').value !== 'true') {
        editorSec.classList.remove('hidden');
    }
});

zoomSlider.addEventListener('input', (e) => {
    inputZ.value = e.target.value;
    actualizarBgEditor();
});

let isDragging = false, startX, startY, startBgX, startBgY;
wrapEditor.addEventListener('mousedown', dragStart);
wrapEditor.addEventListener('touchstart', dragStart, {passive:false});
window.addEventListener('mousemove', dragMove);
window.addEventListener('touchmove', dragMove, {passive:false});
window.addEventListener('mouseup', dragEnd);
window.addEventListener('touchend', dragEnd);

function dragStart(e) {
    if(e.target !== wrapEditor && e.target !== editorPreview) return;
    isDragging = true;
    startX = e.type.includes('mouse') ? e.pageX : e.touches[0].pageX;
    startY = e.type.includes('mouse') ? e.pageY : e.touches[0].pageY;
    startBgX = parseFloat(inputX.value);
    startBgY = parseFloat(inputY.value);
    e.preventDefault();
}
function dragMove(e) {
    if(!isDragging) return;
    e.preventDefault();
    const x = e.type.includes('mouse') ? e.pageX : e.touches[0].pageX;
    const y = e.type.includes('mouse') ? e.pageY : e.touches[0].pageY;
    let dx = (startX - x) * 0.15;
    let dy = (startY - y) * 0.15;
    let nX = Math.max(0, Math.min(100, startBgX + dx));
    let nY = Math.max(0, Math.min(100, startBgY + dy));
    inputX.value = nX; inputY.value = nY;
    actualizarBgEditor();
}
function dragEnd() { isDragging = false; }


async function cargarPlatos() {
    const lista = document.getElementById('platos-lista');
    lista.innerHTML = 'Cargando...';
    const q = query(collection(db, 'platos'), orderBy('orden'));
    const snap = await getDocs(q);
    lista.innerHTML = '';
    snap.forEach(docSnap => {
        const d = docSnap.data();
        const div = document.createElement('div');
        div.className = 'item-row';
        const imgStyle = d.imagenBase64 ? `background-image:url('${d.imagenBase64}'); background-position:${d.imagenPos?.x||50}% ${d.imagenPos?.y||50}%; background-size:${d.imagenPos?.zoom||100}%;` : '';
        const tag = d.oferta ? `<span class="tag tag-oferta"><i class="fa-solid fa-tag"></i> Oferta</span>` : '';
        div.innerHTML = `
            <div class="item-row-img" style="${imgStyle}"></div>
            <div class="item-row-info">
                <strong>${d.nombre}</strong> ${tag}
                <p>${d.precio} - ${d.categoria}</p>
            </div>
            <div class="item-row-actions">
                <button class="btn-edit-sm" onclick="editarPlato('${docSnap.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-danger" onclick="borrarPlato('${docSnap.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        lista.appendChild(div);
    });
}

window.borrarPlato = async (id) => {
    if(confirm('¿Seguro que deseas eliminar este plato?')) {
        await deleteDoc(doc(db, 'platos', id)); cargarPlatos();
    }
};

window.editarPlato = async (id) => {
    const docSnap = await getDoc(doc(db, 'platos', id));
    if(docSnap.exists()) {
        const d = docSnap.data();
        document.getElementById('plato-id').value = id;
        document.getElementById('plato-nombre').value = d.nombre;
        document.getElementById('plato-precio').value = d.precio;
        document.getElementById('plato-desc').value = d.descripcion || '';
        document.getElementById('plato-categoria').value = d.categoria;
        
        document.getElementById('plato-oferta-cb').checked = d.oferta || false;
        document.getElementById('plato-oferta-etiqueta').value = d.ofertaEtiqueta || '';
        document.getElementById('plato-oferta-precio').value = d.ofertaPrecio || '';
        if(d.oferta) document.getElementById('plato-oferta-fields').classList.remove('hidden');
        else document.getElementById('plato-oferta-fields').classList.add('hidden');

        document.getElementById('plato-foto-eliminada').value = 'false';

        if(d.imagenBase64) {
            estadoPlatoImg.base64 = d.imagenBase64;
            const px = d.imagenPos?.x || 50; const py = d.imagenPos?.y || 50; const pz = d.imagenPos?.zoom || 100;
            inputX.value = px; inputY.value = py; inputZ.value = pz; zoomSlider.value = pz;
            
            document.getElementById('plato-preview-box').style.display = 'flex';
            const curImg = document.getElementById('plato-img-current');
            curImg.src = d.imagenBase64;
            curImg.style.objectPosition = `${px}% ${py}%`;

            editorPreview.style.backgroundImage = `url('${d.imagenBase64}')`;
            actualizarBgEditor();
            editorSec.classList.remove('hidden');
        } else {
            document.getElementById('plato-preview-box').style.display = 'none';
            estadoPlatoImg.base64 = null;
            editorSec.classList.add('hidden');
        }
        
        // En móvil, auto scroll y colapsar la lista
        if(window.innerWidth <= 768) {
            document.getElementById('platos-lista').classList.add('collapsed');
            document.querySelector('.content').scrollTop = 0;
        }
    }
};

/* ============================
   BEBIDAS
============================ */
const bebidaForm = document.getElementById('bebida-form');
bebidaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = bebidaForm.querySelector('button[type="submit"]');
    btnSubmit.disabled = true; btnSubmit.textContent = "Guardando...";

    const id = document.getElementById('bebida-id').value;
    const nombre = document.getElementById('bebida-nombre').value;
    const precio = document.getElementById('bebida-precio').value;
    const subcategoria = document.getElementById('bebida-subcategoria').value;

    const data = { nombre, precio, subcategoria, categoria: 'bebestibles' };
    try {
        if (id) { await updateDoc(doc(db, 'bebidas', id), data); showStatus('bebida-status', 'Actualizado correctamente'); }
        else { await addDoc(collection(db, 'bebidas'), data); showStatus('bebida-status', 'Bebida creada'); }
        bebidaForm.reset(); document.getElementById('bebida-id').value = ''; cargarBebidas();
    } catch(e) { showStatus('bebida-status', 'Error al guardar', true); }
    btnSubmit.disabled = false; btnSubmit.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Bebida`;
});

document.getElementById('bebida-cancel').addEventListener('click', () => { bebidaForm.reset(); document.getElementById('bebida-id').value = ''; });

async function cargarBebidas() {
    const lista = document.getElementById('bebidas-lista');
    lista.innerHTML = 'Cargando...';
    const snap = await getDocs(collection(db, 'bebidas'));
    lista.innerHTML = '';
    snap.forEach(docSnap => {
        const d = docSnap.data();
        const div = document.createElement('div');
        div.className = 'item-row';
        div.innerHTML = `
            <div class="item-row-info"><strong>${d.nombre}</strong><p>${d.precio} - ${d.subcategoria}</p></div>
            <div class="item-row-actions">
                <button class="btn-edit-sm" onclick="editarBebida('${docSnap.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-danger" onclick="borrarBebida('${docSnap.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        lista.appendChild(div);
    });
}

window.borrarBebida = async (id) => {
    if(confirm('¿Seguro que deseas eliminar?')) { await deleteDoc(doc(db, 'bebidas', id)); cargarBebidas(); }
};
window.editarBebida = async (id) => {
    const docSnap = await getDoc(doc(db, 'bebidas', id));
    if(docSnap.exists()) {
        const d = docSnap.data();
        document.getElementById('bebida-id').value = id;
        document.getElementById('bebida-nombre').value = d.nombre;
        document.getElementById('bebida-precio').value = d.precio;
        document.getElementById('bebida-subcategoria').value = d.subcategoria;
        
        if(window.innerWidth <= 768) {
            document.getElementById('bebidas-lista').classList.add('collapsed');
            document.querySelector('.content').scrollTop = 0;
        }
    }
};


/* ============================
   CONFIGURACIÓN GENERAL 
============================ */
async function cargarConfiguracionGeneral() {
    // Portadas
    const portadas = await getDoc(doc(db, 'configuracion', 'portadas'));
    if(portadas.exists()) {
        const p = portadas.data();
        renderPreview('portada-inicio-img', p.inicio, 'portada-inicio-no', 'btn-del-portada-inicio');
        renderPreview('portada-nosotros-img', p.nosotros, 'portada-nosotros-no', 'btn-del-portada-nosotros');
        renderPreview('portada-carta-img', p.carta, 'portada-carta-no', 'btn-del-portada-carta');
    }
    // Menu Dia
    const menudia = await getDoc(doc(db, 'configuracion', 'menuDia'));
    if(menudia.exists()) {
        const m = menudia.data();
        renderPreview('menudia-img1-img', m.img1, 'menudia-img1-no', 'btn-del-menudia-img1');
        renderPreview('menudia-img2-img', m.img2, 'menudia-img2-no', 'btn-del-menudia-img2');
    }
    // Secciones Index
    const secciones = await getDoc(doc(db, 'configuracion', 'imagenesSeccion'));
    if(secciones.exists()) {
        const s = secciones.data();
        document.getElementById('qs-habilitar').checked = s.quienesSomosHabilitado !== false; // por defecto true
        document.getElementById('qs-texto').value = s.quienesSomosTexto || '';
        renderPreview('qs-img-img', s.quienesSomosImg, 'qs-img-no', 'btn-del-qs-img');
        
        document.getElementById('nc-titulo').value = s.nuestraCartaTitulo || '';
        renderPreview('nc-img-img', s.nuestraCartaImg, 'nc-img-no', 'btn-del-nc-img');
    }
}

// Portadas
window.guardarPortada = async (tipo) => {
    const file = document.getElementById(`portada-${tipo}-file`).files[0];
    if(!file) return;
    showStatus(`portada-${tipo}-status`, 'Guardando...');
    const b64 = await compressImage(file);
    await setDoc(doc(db, 'configuracion', 'portadas'), { [tipo]: b64 }, { merge: true });
    renderPreview(`portada-${tipo}-img`, b64, `portada-${tipo}-no`, `btn-del-portada-${tipo}`);
    document.getElementById(`portada-${tipo}-file`).value = '';
    showStatus(`portada-${tipo}-status`, 'Actualizado correctamente');
};
window.borrarPortada = async (tipo) => {
    if(confirm('¿Eliminar esta portada?')) {
        await setDoc(doc(db, 'configuracion', 'portadas'), { [tipo]: null }, { merge: true });
        renderPreview(`portada-${tipo}-img`, null, `portada-${tipo}-no`, `btn-del-portada-${tipo}`);
    }
};

// Menu del dia
window.guardarMenuDiaImg = async (tipo) => {
    const file = document.getElementById(`menudia-${tipo}-file`).files[0];
    if(!file) return;
    showStatus(`menudia-${tipo}-status`, 'Guardando...');
    const b64 = await compressImage(file);
    await setDoc(doc(db, 'configuracion', 'menuDia'), { [tipo]: b64 }, { merge: true });
    renderPreview(`menudia-${tipo}-img`, b64, `menudia-${tipo}-no`, `btn-del-menudia-${tipo}`);
    document.getElementById(`menudia-${tipo}-file`).value = '';
    showStatus(`menudia-${tipo}-status`, 'Actualizado correctamente');
};
window.borrarMenuDiaImg = async (tipo) => {
    if(confirm('¿Eliminar esta imagen?')) {
        await setDoc(doc(db, 'configuracion', 'menuDia'), { [tipo]: null }, { merge: true });
        renderPreview(`menudia-${tipo}-img`, null, `menudia-${tipo}-no`, `btn-del-menudia-${tipo}`);
    }
};

// Secciones Index
window.guardarQuienesSomos = async () => {
    showStatus('qs-status', 'Guardando...');
    const h = document.getElementById('qs-habilitar').checked;
    const txt = document.getElementById('qs-texto').value;
    const file = document.getElementById('qs-img-file').files[0];
    
    let updates = { quienesSomosHabilitado: h, quienesSomosTexto: txt };
    if(file) {
        updates.quienesSomosImg = await compressImage(file);
        renderPreview('qs-img-img', updates.quienesSomosImg, 'qs-img-no', 'btn-del-qs-img');
        document.getElementById('qs-img-file').value = '';
    }
    await setDoc(doc(db, 'configuracion', 'imagenesSeccion'), updates, { merge: true });
    showStatus('qs-status', 'Actualizado correctamente');
};
window.guardarNuestraCarta = async () => {
    showStatus('nc-status', 'Guardando...');
    const tit = document.getElementById('nc-titulo').value;
    const file = document.getElementById('nc-img-file').files[0];
    let updates = { nuestraCartaTitulo: tit };
    if(file) {
        updates.nuestraCartaImg = await compressImage(file);
        renderPreview('nc-img-img', updates.nuestraCartaImg, 'nc-img-no', 'btn-del-nc-img');
        document.getElementById('nc-img-file').value = '';
    }
    await setDoc(doc(db, 'configuracion', 'imagenesSeccion'), updates, { merge: true });
    showStatus('nc-status', 'Actualizado correctamente');
};
window.borrarSeccionImagen = async (campo) => {
    if(confirm('¿Eliminar esta imagen?')) {
        let f = campo === 'quienesSomos' ? 'qs' : 'nc';
        await setDoc(doc(db, 'configuracion', 'imagenesSeccion'), { [campo + 'Img']: null }, { merge: true });
        renderPreview(`${f}-img-img`, null, `${f}-img-no`, `btn-del-${f}-img`);
    }
};

/* ============================
   HISTORIA (NOSOTROS)
============================ */
async function cargarHistoria() {
    const docSnap = await getDoc(doc(db, 'configuracion', 'historia'));
    if(docSnap.exists()) {
        const d = docSnap.data();
        for(let i=1; i<=3; i++) {
            if(d[`b${i}`]) {
                document.getElementById(`hist-tit${i}`).value = d[`b${i}`].tit || '';
                document.getElementById(`hist-txt${i}`).value = d[`b${i}`].txt || '';
                renderPreview(`hist-img${i}-img`, d[`b${i}`].img, `hist-img${i}-no`, `btn-del-hist-img${i}`);
            }
        }
    }
}
window.guardarHistoria = async () => {
    showStatus('hist-status', 'Guardando...');
    const docSnap = await getDoc(doc(db, 'configuracion', 'historia'));
    let data = docSnap.exists() ? docSnap.data() : { b1:{}, b2:{}, b3:{} };

    for(let i=1; i<=3; i++) {
        if(!data[`b${i}`]) data[`b${i}`] = {};
        data[`b${i}`].tit = document.getElementById(`hist-tit${i}`).value;
        data[`b${i}`].txt = document.getElementById(`hist-txt${i}`).value;
        const file = document.getElementById(`hist-file${i}`).files[0];
        if(file) {
            data[`b${i}`].img = await compressImage(file);
            renderPreview(`hist-img${i}-img`, data[`b${i}`].img, `hist-img${i}-no`, `btn-del-hist-img${i}`);
            document.getElementById(`hist-file${i}`).value = '';
        }
    }
    await setDoc(doc(db, 'configuracion', 'historia'), data);
    showStatus('hist-status', 'Actualizado correctamente');
};
window.borrarHistoriaImg = async (i) => {
    if(confirm('¿Eliminar esta imagen?')) {
        const docSnap = await getDoc(doc(db, 'configuracion', 'historia'));
        let data = docSnap.exists() ? docSnap.data() : {};
        if(data[`b${i}`]) data[`b${i}`].img = null;
        await setDoc(doc(db, 'configuracion', 'historia'), data);
        renderPreview(`hist-img${i}-img`, null, `hist-img${i}-no`, `btn-del-hist-img${i}`);
    }
};

/* ============================
   GALERIA NUESTRO ESPACIO
============================ */
async function cargarGaleria() {
    const cont = document.getElementById('galeria-contenedor');
    // Mantenemos el botón de agregar
    const addBtn = cont.querySelector('.galeria-add').outerHTML;
    cont.innerHTML = 'Cargando...';
    
    const snap = await getDocs(collection(db, 'galeria'));
    let html = '';
    snap.forEach(d => {
        html += `<div class="galeria-item">
            <img src="${d.data().url}" alt="Galeria">
            <button class="btn-delete-img" onclick="borrarGaleria('${d.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    });
    cont.innerHTML = addBtn + html;
}

document.getElementById('galeria-file').addEventListener('change', async (e) => {
    if(e.target.files.length === 0) return;
    showStatus('galeria-status', 'Subiendo imágenes...');
    for(let file of e.target.files) {
        const b64 = await compressImage(file);
        await addDoc(collection(db, 'galeria'), { url: b64, ts: Date.now() });
    }
    document.getElementById('galeria-file').value = '';
    showStatus('galeria-status', 'Imágenes agregadas');
    cargarGaleria();
});

window.borrarGaleria = async (id) => {
    if(confirm('¿Eliminar imagen de la galería?')) {
        await deleteDoc(doc(db, 'galeria', id));
        cargarGaleria();
    }
};

/* ============================
   IMPORTAR DATOS
============================ */
document.getElementById('btn-importar').addEventListener('click', async () => {
    if (!confirm('¿Seguro que deseas importar la carta de prueba?')) return;
    try {
        showStatus('importar-status', 'Importando...');
        for(let i=0; i<CARTA_INICIAL.length; i++) {
            let p = CARTA_INICIAL[i];
            p.orden = i;
            await addDoc(collection(db, 'platos'), p);
        }
        showStatus('importar-status', 'Carta importada correctamente');
        cargarPlatos();
    } catch(err) {
        showStatus('importar-status', 'Error al importar', true);
    }
});
