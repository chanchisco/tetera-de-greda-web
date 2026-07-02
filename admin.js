// ============================================================
// admin.js — Lógica del panel de administración
// ============================================================
import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------- Referencias UI ----------
const loginSection = document.getElementById('login-section');
const panelSection = document.getElementById('panel-section');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const btnLogout = document.getElementById('btn-logout');

const platoForm = document.getElementById('plato-form');
const platoIdInput = document.getElementById('plato-id');
const platoNombreInput = document.getElementById('plato-nombre');
const platoPrecioInput = document.getElementById('plato-precio');
const platoDescInput = document.getElementById('plato-desc');
const platoCategoriaInput = document.getElementById('plato-categoria');
const platoImagenInput = document.getElementById('plato-imagen');
const platoStatus = document.getElementById('plato-status');
const platosLista = document.getElementById('platos-lista');

const bebidaForm = document.getElementById('bebida-form');
const bebidaIdInput = document.getElementById('bebida-id');
const bebidaNombreInput = document.getElementById('bebida-nombre');
const bebidaPrecioInput = document.getElementById('bebida-precio');
const bebidaSubcategoriaInput = document.getElementById('bebida-subcategoria');
const bebidasLista = document.getElementById('bebidas-lista');

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ---------- LOGIN ----------
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

btnLogout.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginSection.style.display = 'none';
    panelSection.style.display = 'block';
    cargarPlatos();
    cargarBebidas();
  } else {
    loginSection.style.display = 'block';
    panelSection.style.display = 'none';
  }
});

// ---------- Compresión de imagen -> Base64 ----------
// Se guarda directamente en Firestore (no se usa Firebase Storage,
// así el proyecto se mantiene 100% gratis sin necesitar el plan Blaze).
async function comprimirYConvertir(file) {
  const options = {
    maxSizeMB: 0.18,          // ~180 KB máximo
    maxWidthOrHeight: 800,    // suficiente para verse nítido en el celular
    useWebWorker: true,
    fileType: 'image/jpeg'
  };
  const comprimido = await imageCompression(file, options);
  return await imageCompression.getDataUrlFromFile(comprimido);
}

// ---------- PLATOS ----------
platoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  platoStatus.textContent = 'Guardando...';

  const data = {
    nombre: platoNombreInput.value.trim(),
    precio: platoPrecioInput.value.trim(),
    descripcion: platoDescInput.value.trim(),
    categoria: platoCategoriaInput.value,
  };

  try {
    if (platoImagenInput.files[0]) {
      platoStatus.textContent = 'Comprimiendo y subiendo imagen...';
      data.imagenBase64 = await comprimirYConvertir(platoImagenInput.files[0]);
    }

    const id = platoIdInput.value;
    if (id) {
      await updateDoc(doc(db, 'platos', id), data);
    } else {
      data.orden = Date.now();
      await addDoc(collection(db, 'platos'), data);
    }

    platoForm.reset();
    platoIdInput.value = '';
    platoStatus.textContent = '✅ Guardado correctamente.';
    cargarPlatos();
  } catch (err) {
    console.error(err);
    platoStatus.textContent = '❌ Error al guardar: ' + err.message;
  }
});

document.getElementById('plato-cancel').addEventListener('click', () => {
  platoForm.reset();
  platoIdInput.value = '';
  platoStatus.textContent = '';
});

async function cargarPlatos() {
  platosLista.innerHTML = 'Cargando...';
  const q = query(collection(db, 'platos'), orderBy('categoria'));
  const snap = await getDocs(q);
  platosLista.innerHTML = '';
  if (snap.empty) {
    platosLista.innerHTML = '<p>Aún no hay platos. Usa "Importar carta actual" o agrega uno nuevo arriba.</p>';
    return;
  }
  snap.forEach(docSnap => {
    const p = docSnap.data();
    const img = p.imagenBase64 || p.imagenURL || '';
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
      <img src="${img}" alt="${escapeHtml(p.nombre)}" class="item-row-img">
      <div class="item-row-info">
        <strong>${escapeHtml(p.nombre)}</strong> — ${escapeHtml(p.precio)} <span class="tag">${escapeHtml(p.categoria)}</span>
        <p>${escapeHtml(p.descripcion)}</p>
      </div>
      <div class="item-row-actions">
        <button class="btn-edit">Editar</button>
        <button class="btn-delete">Eliminar</button>
      </div>`;
    div.querySelector('.btn-edit').addEventListener('click', () => {
      platoIdInput.value = docSnap.id;
      platoNombreInput.value = p.nombre;
      platoPrecioInput.value = p.precio;
      platoDescInput.value = p.descripcion || '';
      platoCategoriaInput.value = p.categoria;
      platoForm.scrollIntoView({ behavior: 'smooth' });
    });
    div.querySelector('.btn-delete').addEventListener('click', async () => {
      if (confirm(`¿Eliminar "${p.nombre}"?`)) {
        await deleteDoc(doc(db, 'platos', docSnap.id));
        cargarPlatos();
      }
    });
    platosLista.appendChild(div);
  });
}

// ---------- BEBIDAS ----------
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
    cargarBebidas();
  } catch (err) {
    console.error(err);
    alert('Error al guardar: ' + err.message);
  }
});

document.getElementById('bebida-cancel').addEventListener('click', () => {
  bebidaForm.reset();
  bebidaIdInput.value = '';
});

async function cargarBebidas() {
  bebidasLista.innerHTML = 'Cargando...';
  const q = query(collection(db, 'bebidas'), orderBy('subcategoria'));
  const snap = await getDocs(q);
  bebidasLista.innerHTML = '';
  if (snap.empty) {
    bebidasLista.innerHTML = '<p>Aún no hay bebidas. Usa "Importar carta actual" o agrega una nueva arriba.</p>';
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
        <button class="btn-edit">Editar</button>
        <button class="btn-delete">Eliminar</button>
      </div>`;
    div.querySelector('.btn-edit').addEventListener('click', () => {
      bebidaIdInput.value = docSnap.id;
      bebidaNombreInput.value = b.nombre;
      bebidaPrecioInput.value = b.precio;
      bebidaSubcategoriaInput.value = b.subcategoria;
      bebidaForm.scrollIntoView({ behavior: 'smooth' });
    });
    div.querySelector('.btn-delete').addEventListener('click', async () => {
      if (confirm(`¿Eliminar "${b.nombre}"?`)) {
        await deleteDoc(doc(db, 'bebidas', docSnap.id));
        cargarBebidas();
      }
    });
    bebidasLista.appendChild(div);
  });
}

// ---------- IMPORTAR CARTA ACTUAL (usar UNA sola vez) ----------
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
    status.textContent = `✅ Importados ${PLATOS_SEED.length} platos y ${BEBIDAS_SEED.length} bebidas.`;
    cargarPlatos();
    cargarBebidas();
  } catch (err) {
    console.error(err);
    status.textContent = '❌ Error: ' + err.message;
  }
});
