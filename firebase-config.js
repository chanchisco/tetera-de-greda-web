// ============================================================
// firebase-config.js
// ============================================================
// PASO A PASO PARA CONFIGURAR (léelo en INSTRUCCIONES-FIREBASE.md):
// 1. Crea un proyecto en https://console.firebase.google.com
// 2. Ve a "Configuración del proyecto" (ícono de engranaje) > "Tus apps"
// 3. Crea una app web (ícono </>) y copia el objeto firebaseConfig que te entrega
// 4. Reemplaza TODOS los valores de abajo por los tuyos
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "PEGA_AQUI_TU_API_KEY",
  authDomain: "PEGA_AQUI_TU_PROYECTO.firebaseapp.com",
  projectId: "PEGA_AQUI_TU_PROYECTO_ID",
  storageBucket: "PEGA_AQUI_TU_PROYECTO.firebasestorage.app",
  messagingSenderId: "PEGA_AQUI_TU_SENDER_ID",
  appId: "PEGA_AQUI_TU_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
