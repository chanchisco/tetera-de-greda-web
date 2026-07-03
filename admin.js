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
    el.innerHTML = isError ? `<i class="fa-solid fa-triangle-exclamation"></i> ${msg}` : `<i class="fa-solid fa-rotate"></i> ${msg}`;
    el.className = 'status-msg ' + (isError ? 'status-err' : 'status-ok');
    setTimeout(() => { el.innerHTML = ''; }, 3500);
}

function initAdmin() {
    cargarPlatos();
    cargarBebidas();
    cargarConfiguracionGeneral();
    cargarTextosMenuDia();
    cargarMenuDiaImgs();
    cargarHistoria();
    cargarGaleria();
    renderHistoriaForms();
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

// Checkbox Oferta Platos
document.getElementById('plato-oferta-cb').addEventListener('change', (e) => {
    const fields = document.getElementById('plato-oferta-fields');
    if(e.target.checked) fields.classList.remove('hidden');
    else fields.classList.add('hidden');
});

/* ============================
   CROPPER MODAL (Universal)
============================ */
let cropperResolve = null;
let currentCropperImg = null;
let currentAspectRatio = 1;
let imgDrag = { active: false, startX: 0, startY: 0, bgX: 0, bgY: 0 };

const cropperModal = document.getElementById('cropper-modal');
const cropperImg = document.getElementById('cropper-img');
const cropperOverlay = document.getElementById('cropper-overlay');
const cropperZoom = document.getElementById('cropper-zoom');
const cropperContainer = document.getElementById('cropper-container');

async function openCropper(file, aspectRatio) {
    return new Promise((resolve) => {
        cropperResolve = resolve;
        currentAspectRatio = aspectRatio;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            cropperImg.src = e.target.result;
            cropperImg.onload = () => {
                // Ajustar overlay
                const cw = cropperContainer.clientWidth;
                const ch = cropperContainer.clientHeight;
                let ow, oh;
                if (cw / ch > aspectRatio) {
                    oh = ch * 0.9; ow = oh * aspectRatio;
                } else {
                    ow = cw * 0.9; oh = ow / aspectRatio;
                }
                cropperOverlay.style.width = `${ow}px`;
                cropperOverlay.style.height = `${oh}px`;
                cropperOverlay.style.top = `${(ch - oh) / 2}px`;
                cropperOverlay.style.left = `${(cw - ow) / 2}px`;

                // Inicializar imagen
                const scale = Math.max(ow / cropperImg.naturalWidth, oh / cropperImg.naturalHeight);
                cropperZoom.min = scale;
                cropperZoom.max = scale * 4;
                cropperZoom.value = scale;
                updateCropperTransform(0, 0, scale);

                cropperModal.classList.remove('hidden');
            };
        };
        reader.readAsDataURL(file);
    });
}

function updateCropperTransform(x, y, scale) {
    cropperImg.dataset.x = x;
    cropperImg.dataset.y = y;
    cropperImg.dataset.scale = scale;
    cropperImg.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale})`;
}

cropperZoom.addEventListener('input', (e) => {
    updateCropperTransform(parseFloat(cropperImg.dataset.x||0), parseFloat(cropperImg.dataset.y||0), e.target.value);
});

function cDragStart(e) {
    if(e.target === cropperZoom || e.target.tagName==='BUTTON') return;
    imgDrag.active = true;
    imgDrag.startX = e.type.includes('mouse') ? e.pageX : e.touches[0].pageX;
    imgDrag.startY = e.type.includes('mouse') ? e.pageY : e.touches[0].pageY;
    imgDrag.bgX = parseFloat(cropperImg.dataset.x || 0);
    imgDrag.bgY = parseFloat(cropperImg.dataset.y || 0);
    e.preventDefault();
}
function cDragMove(e) {
    if(!imgDrag.active) return;
    e.preventDefault();
    const x = e.type.includes('mouse') ? e.pageX : e.touches[0].pageX;
    const y = e.type.includes('mouse') ? e.pageY : e.touches[0].pageY;
    const dx = x - imgDrag.startX;
    const dy = y - imgDrag.startY;
    updateCropperTransform(imgDrag.bgX + dx, imgDrag.bgY + dy, cropperImg.dataset.scale);
}
function cDragEnd() { imgDrag.active = false; }

cropperContainer.addEventListener('mousedown', cDragStart);
cropperContainer.addEventListener('touchstart', cDragStart, {passive:false});
window.addEventListener('mousemove', cDragMove);
window.addEventListener('touchmove', cDragMove, {passive:false});
window.addEventListener('mouseup', cDragEnd);
window.addEventListener('touchend', cDragEnd);

document.getElementById('btn-crop-cancel').addEventListener('click', () => {
    cropperModal.classList.add('hidden');
    if(cropperResolve) cropperResolve(null);
});

document.getElementById('btn-crop-apply').addEventListener('click', async () => {
    const scale = parseFloat(cropperImg.dataset.scale);
    const x = parseFloat(cropperImg.dataset.x);
    const y = parseFloat(cropperImg.dataset.y);
    const cw = cropperContainer.clientWidth;
    const ch = cropperContainer.clientHeight;
    
    // Obtener dimensiones del overlay
    const overlayRect = cropperOverlay.getBoundingClientRect();
    const contRect = cropperContainer.getBoundingClientRect();
    const ovX = overlayRect.left - contRect.left;
    const ovY = overlayRect.top - contRect.top;
    const ovW = overlayRect.width;
    const ovH = overlayRect.height;

    // Calcular posición real en la imagen original
    const imgCenterX = cropperImg.naturalWidth / 2;
    const imgCenterY = cropperImg.naturalHeight / 2;
    
    // El contenedor está centrado, calculamos el offset de la esquina superior izquierda del overlay relativo al centro de la imagen
    const cropX = imgCenterX - ((cw / 2 - ovX) / scale) - (x / scale);
    const cropY = imgCenterY - ((ch / 2 - ovY) / scale) - (y / scale);
    const cropW = ovW / scale;
    const cropH = ovH / scale;

    const canvas = document.createElement('canvas');
    canvas.width = Math.min(1200, ovW * 2); // Max resolucion razonable
    canvas.height = canvas.width / currentAspectRatio;
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(cropperImg, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
    
    const base64 = canvas.toDataURL('image/jpeg', 0.85); // comprimido
    cropperModal.classList.add('hidden');
    
    // Si la imagen es muy pesada, la pasamos por el compresor nativo
    let finalBase64 = base64;
    try {
        const fileObj = dataURLtoFile(base64, 'cropped.jpg');
        finalBase64 = await compressImage(fileObj);
    } catch(e) {}
    
    if(cropperResolve) cropperResolve(finalBase64);
});

// Helpers
function dataURLtoFile(dataurl, filename) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){ u8arr[n] = bstr.charCodeAt(n); }
    return new File([u8arr], filename, {type:mime});
}

async function compressImage(file) {
    const options = { maxSizeMB: 0.3, maxWidthOrHeight: 1200, useWebWorker: true };
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
   UTILIDADES RECORTADOR
============================ */
// Funciones globales para que el HTML pueda llamarlas onchange
window.abrirRecortadorPlato = async (input) => {
    if(input.files.length === 0) return;
    const b64 = await openCropper(input.files[0], 4/3); // Aspect ratio platos
    input.value = ''; // Reset input
    if(b64) {
        document.getElementById('plato-preview-box').style.display = 'flex';
        document.getElementById('plato-img-current').src = b64;
        estadoPlatoImg.base64 = b64; // Guarda el nuevo base64
    }
};

window.recortarYGuardar = async (prefix, input, ratio, saveFunc) => {
    if(input.files.length === 0) return;
    const b64 = await openCropper(input.files[0], ratio);
    input.value = '';
    if(b64) {
        // Ejecutar funcion de guardado y pasarle el base64
        saveFunc(prefix, b64);
    }
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
    const data = { 
        nombre: document.getElementById('plato-nombre').value, 
        precio: document.getElementById('plato-precio').value, 
        descripcion: document.getElementById('plato-desc').value, 
        categoria: document.getElementById('plato-categoria').value, 
        imagenBase64: estadoPlatoImg.base64,
        imagenPos: null, // Ya no se usa posicion, la imagen viene recortada
        oferta: document.getElementById('plato-oferta-cb').checked, 
        ofertaEtiqueta: document.getElementById('plato-oferta-etiqueta').value, 
        ofertaPrecio: document.getElementById('plato-oferta-precio').value
    };

    try {
        if (id) { await updateDoc(doc(db, 'platos', id), data); showStatus('plato-status', 'Actualizado correctamente'); } 
        else { data.orden = 999; await addDoc(collection(db, 'platos'), data); showStatus('plato-status', 'Plato creado'); }
        limpiarPlatoForm();
        cargarPlatos();
    } catch(e) { showStatus('plato-status', 'Error al guardar', true); }
    btnSubmit.disabled = false; btnSubmit.innerHTML = `Guardar Plato`;
});

function limpiarPlatoForm() {
    platoForm.reset();
    document.getElementById('plato-id').value = '';
    estadoPlatoImg.base64 = null;
    document.getElementById('plato-preview-box').style.display = 'none';
    document.getElementById('plato-oferta-cb').checked = false;
    document.getElementById('plato-oferta-fields').classList.add('hidden');
}
document.getElementById('plato-cancel').addEventListener('click', limpiarPlatoForm);

document.getElementById('btn-eliminar-foto-plato').addEventListener('click', () => {
    document.getElementById('plato-preview-box').style.display = 'none';
    estadoPlatoImg.base64 = null;
});

async function cargarPlatos() {
    const lista = document.getElementById('platos-lista');
    lista.innerHTML = 'Cargando...';
    const snap = await getDocs(query(collection(db, 'platos'), orderBy('orden')));
    lista.innerHTML = '';
    snap.forEach(docSnap => {
        const d = docSnap.data();
        const div = document.createElement('div');
        div.className = 'item-row';
        const imgStyle = d.imagenBase64 ? `background-image:url('${d.imagenBase64}'); background-position:${d.imagenPos?.x||50}% ${d.imagenPos?.y||50}%;` : '';
        const tag = d.oferta ? `<span class="tag tag-oferta"><i class="fa-solid fa-tag"></i> Oferta</span>` : '';
        div.innerHTML = `
            <div class="item-row-img" style="${imgStyle}"></div>
            <div class="item-row-info"><strong>${d.nombre}</strong> ${tag}<p>${d.precio} - ${d.categoria}</p></div>
            <div class="item-row-actions">
                <button class="btn-edit-sm" onclick="editarPlato('${docSnap.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-danger" onclick="borrarPlato('${docSnap.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>`;
        lista.appendChild(div);
    });
}

window.borrarPlato = async (id) => { if(confirm('¿Eliminar este plato?')) { await deleteDoc(doc(db, 'platos', id)); cargarPlatos(); } };

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
        document.getElementById('plato-oferta-fields').classList.toggle('hidden', !d.oferta);

        if(d.imagenBase64) {
            estadoPlatoImg.base64 = d.imagenBase64;
            document.getElementById('plato-preview-box').style.display = 'flex';
            document.getElementById('plato-img-current').src = d.imagenBase64;
            // Soporte para imagenes antiguas con posicion
            document.getElementById('plato-img-current').style.objectPosition = d.imagenPos ? `${d.imagenPos.x}% ${d.imagenPos.y}%` : '50% 50%';
        } else {
            estadoPlatoImg.base64 = null;
            document.getElementById('plato-preview-box').style.display = 'none';
        }
        window.scrollTo(0,0);
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
    const data = { 
        nombre: document.getElementById('bebida-nombre').value, 
        precio: document.getElementById('bebida-precio').value, 
        subcategoria: document.getElementById('bebida-subcategoria').value, 
        categoria: 'bebestibles' 
    };
    try {
        if (id) { await updateDoc(doc(db, 'bebidas', id), data); showStatus('bebida-status', 'Actualizado correctamente'); }
        else { await addDoc(collection(db, 'bebidas'), data); showStatus('bebida-status', 'Bebida creada'); }
        bebidaForm.reset(); document.getElementById('bebida-id').value = ''; cargarBebidas();
    } catch(e) { showStatus('bebida-status', 'Error al guardar', true); }
    btnSubmit.disabled = false; btnSubmit.innerHTML = `Guardar Bebida`;
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
            </div>`;
        lista.appendChild(div);
    });
}

window.borrarBebida = async (id) => { if(confirm('¿Eliminar?')) { await deleteDoc(doc(db, 'bebidas', id)); cargarBebidas(); } };
window.editarBebida = async (id) => {
    const docSnap = await getDoc(doc(db, 'bebidas', id));
    if(docSnap.exists()) {
        const d = docSnap.data();
        document.getElementById('bebida-id').value = id;
        document.getElementById('bebida-nombre').value = d.nombre;
        document.getElementById('bebida-precio').value = d.precio;
        document.getElementById('bebida-subcategoria').value = d.subcategoria;
        window.scrollTo(0,0);
    }
};

/* ============================
   CONFIGURACIÓN GENERAL 
============================ */
window.cargarConfiguracionGeneral = async () => {
    window.recargarPortadas();
    
    // Secciones Index
    const secciones = await getDoc(doc(db, 'configuracion', 'imagenesSeccion'));
    if(secciones.exists()) {
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
    if(portadas.exists()) {
        const p = portadas.data();
        renderPreview('portada-inicio-img', p.inicio, 'portada-inicio-no', 'btn-del-portada-inicio');
        renderPreview('portada-nosotros-img', p.nosotros, 'portada-nosotros-no', 'btn-del-portada-nosotros');
        renderPreview('portada-carta-img', p.carta, 'portada-carta-no', 'btn-del-portada-carta');
    }
};

window.guardarPortada = async (prefix, base64) => {
    const tipo = prefix.split('-')[1]; // portada-inicio -> inicio
    showStatus(`portada-${tipo}-status`, 'Guardando...');
    await setDoc(doc(db, 'configuracion', 'portadas'), { [tipo]: base64 }, { merge: true });
    renderPreview(`portada-${tipo}-img`, base64, `portada-${tipo}-no`, `btn-del-portada-${tipo}`);
    showStatus(`portada-${tipo}-status`, 'Actualizado correctamente');
};
window.borrarPortada = async (tipo) => {
    if(confirm('¿Eliminar esta portada?')) {
        await setDoc(doc(db, 'configuracion', 'portadas'), { [tipo]: null }, { merge: true });
        renderPreview(`portada-${tipo}-img`, null, `portada-${tipo}-no`, `btn-del-portada-${tipo}`);
    }
};

// Menu del dia Imgs
window.cargarMenuDiaImgs = async () => {
    const menudia = await getDoc(doc(db, 'configuracion', 'menuDia'));
    if(menudia.exists()) {
        const m = menudia.data();
        renderPreview('menudia-img1-img', m.img1, 'menudia-img1-no', 'btn-del-menudia-img1');
        renderPreview('menudia-img2-img', m.img2, 'menudia-img2-no', 'btn-del-menudia-img2');
    }
};

window.guardarMenuDiaImg = async (prefix, base64) => {
    const tipo = prefix.split('-')[1]; // menudia-img1 -> img1
    showStatus(`menudia-${tipo}-status`, 'Guardando...');
    await setDoc(doc(db, 'configuracion', 'menuDia'), { [tipo]: base64 }, { merge: true });
    renderPreview(`menudia-${tipo}-img`, base64, `menudia-${tipo}-no`, `btn-del-menudia-${tipo}`);
    showStatus(`menudia-${tipo}-status`, 'Actualizado correctamente');
};
window.borrarMenuDiaImg = async (tipo) => {
    if(confirm('¿Eliminar esta imagen?')) {
        await setDoc(doc(db, 'configuracion', 'menuDia'), { [tipo]: null }, { merge: true });
        renderPreview(`menudia-${tipo}-img`, null, `menudia-${tipo}-no`, `btn-del-menudia-${tipo}`);
    }
};

// Menu del dia Textos
window.cargarTextosMenuDia = async () => {
    const menudia = await getDoc(doc(db, 'configuracion', 'menuDia'));
    if(menudia.exists()) {
        const m = menudia.data();
        document.getElementById('md-incluye').value = m.incluye || '';
        document.getElementById('md-acomp').value = m.acompanamientos || '';
        document.getElementById('md-precio-s').value = m.precioServir || '';
        document.getElementById('md-precio-l').value = m.precioLlevar || '';
    }
};
window.guardarTextosMenuDia = async () => {
    showStatus('md-txt-status', 'Guardando...');
    const data = {
        incluye: document.getElementById('md-incluye').value,
        acompanamientos: document.getElementById('md-acomp').value,
        precioServir: document.getElementById('md-precio-s').value,
        precioLlevar: document.getElementById('md-precio-l').value,
    };
    await setDoc(doc(db, 'configuracion', 'menuDia'), data, { merge: true });
    showStatus('md-txt-status', 'Actualizado correctamente');
};

// Secciones Index Extras
window.guardarQuienesSomos = async (prefix, base64) => {
    showStatus('qs-status', 'Guardando...');
    let updates = { 
        quienesSomosHabilitado: document.getElementById('qs-habilitar').checked, 
        quienesSomosTexto: document.getElementById('qs-texto').value 
    };
    if(base64) {
        updates.quienesSomosImg = base64;
        renderPreview('qs-img-img', base64, 'qs-img-no', 'btn-del-qs-img');
    }
    await setDoc(doc(db, 'configuracion', 'imagenesSeccion'), updates, { merge: true });
    showStatus('qs-status', 'Actualizado correctamente');
};
window.guardarNuestraCarta = async (prefix, base64) => {
    showStatus('nc-status', 'Guardando...');
    let updates = { 
        nuestraCartaHabilitado: document.getElementById('nc-habilitar').checked,
        nuestraCartaTitulo: document.getElementById('nc-titulo').value 
    };
    if(base64) {
        updates.nuestraCartaImg = base64;
        renderPreview('nc-img-img', base64, 'nc-img-no', 'btn-del-nc-img');
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
let historiaData = {};

window.cargarHistoria = async () => {
    const docSnap = await getDoc(doc(db, 'configuracion', 'historia'));
    if(docSnap.exists()) {
        historiaData = docSnap.data();
        document.getElementById('hist-habilitar').checked = historiaData.habilitado !== false;
    } else {
        historiaData = { b1:{}, b2:{}, b3:{}, habilitado: true };
    }
    renderHistoriaForms();
};

window.renderHistoriaForms = () => {
    const cont = document.getElementById('hist-blocks');
    cont.innerHTML = '';
    for(let i=1; i<=3; i++) {
        let b = historiaData[`b${i}`] || {};
        cont.innerHTML += `
            <div class="seccion-card">
                <h3>Bloque ${i}</h3>
                <input type="text" id="hist-tit${i}" value="${b.tit||''}" placeholder="Título..." style="margin-bottom:10px; font-weight:bold;">
                <textarea id="hist-txt${i}" rows="3" placeholder="Texto descriptivo...">${b.txt||''}</textarea>
                <div class="preview-box" style="height:120px; max-width:300px;">
                    <img id="hist-img${i}-img" ${b.img ? `src="${b.img}"` : 'class="hidden"'}>
                    <div class="no-img-text ${b.img ? 'hidden':''}" id="hist-img${i}-no">Sin imagen</div>
                    <button type="button" class="btn-delete-img ${b.img ? '':'hidden'}" id="btn-del-hist-img${i}" onclick="borrarHistoriaImg(${i})"><i class="fa-solid fa-trash"></i></button>
                </div>
                <input type="file" id="hist-file${i}" accept="image/*" style="max-width:300px;" onchange="recortarYGuardar('hist-${i}', this, 4/3, guardarHistoriaImgSolo)">
            </div>
        `;
    }
};

window.guardarHistoriaImgSolo = async (prefix, base64) => {
    const idx = prefix.split('-')[1];
    if(!historiaData[`b${idx}`]) historiaData[`b${idx}`] = {};
    historiaData[`b${idx}`].img = base64;
    renderPreview(`hist-img${idx}-img`, base64, `hist-img${idx}-no`, `btn-del-hist-img${idx}`);
    guardarHistoria();
};

window.guardarHistoria = async () => {
    showStatus('hist-status', 'Guardando...');
    historiaData.habilitado = document.getElementById('hist-habilitar').checked;
    for(let i=1; i<=3; i++) {
        if(!historiaData[`b${i}`]) historiaData[`b${i}`] = {};
        historiaData[`b${i}`].tit = document.getElementById(`hist-tit${i}`).value;
        historiaData[`b${i}`].txt = document.getElementById(`hist-txt${i}`).value;
    }
    await setDoc(doc(db, 'configuracion', 'historia'), historiaData, { merge: true });
    showStatus('hist-status', 'Actualizado correctamente');
};
window.borrarHistoriaImg = async (i) => {
    if(confirm('¿Eliminar esta imagen?')) {
        if(historiaData[`b${i}`]) historiaData[`b${i}`].img = null;
        await setDoc(doc(db, 'configuracion', 'historia'), historiaData, { merge: true });
        renderPreview(`hist-img${i}-img`, null, `hist-img${i}-no`, `btn-del-hist-img${i}`);
    }
};

/* ============================
   GALERIA NUESTRO ESPACIO
============================ */
window.cargarGaleria = async () => {
    const docSnap = await getDoc(doc(db, 'configuracion', 'galeriaOpciones'));
    if(docSnap.exists()) document.getElementById('galeria-habilitar').checked = docSnap.data().habilitado !== false;

    const cont = document.getElementById('galeria-contenedor');
    const addBtn = `<div class="galeria-item galeria-add" onclick="document.getElementById('galeria-file').click()"><i class="fa-solid fa-plus" style="font-size:1.5rem; margin-bottom:5px;"></i> Agregar</div>`;
    cont.innerHTML = 'Cargando...';
    
    const snap = await getDocs(collection(db, 'galeria'));
    let html = '';
    snap.forEach(d => {
        html += `<div class="galeria-item"><img src="${d.data().url}"><button class="btn-delete-img" onclick="borrarGaleria('${d.id}')"><i class="fa-solid fa-trash"></i></button></div>`;
    });
    cont.innerHTML = addBtn + html;
};

// Guardar si se habilita o deshabilita
document.getElementById('galeria-habilitar').addEventListener('change', async (e) => {
    showStatus('galeria-status', 'Guardando...');
    await setDoc(doc(db, 'configuracion', 'galeriaOpciones'), { habilitado: e.target.checked }, { merge:true });
    showStatus('galeria-status', 'Actualizado correctamente');
});

window.subirMultiGaleria = async (input) => {
    if(input.files.length === 0) return;
    showStatus('galeria-status', 'Subiendo imágenes...');
    for(let file of input.files) {
        // Usar compresor directo para multiples, sin recortador para no bloquear con multiples modales
        const b64 = await compressImage(file);
        await addDoc(collection(db, 'galeria'), { url: b64, ts: Date.now() });
    }
    input.value = '';
    showStatus('galeria-status', 'Imágenes agregadas');
    cargarGaleria();
};

window.borrarGaleria = async (id) => {
    if(confirm('¿Eliminar imagen de la galería?')) {
        await deleteDoc(doc(db, 'galeria', id));
        cargarGaleria();
    }
};
