# Cómo dejar funcionando el panel de administración

Este documento es solo para ti (el desarrollador). Tu cliente solo necesitará el link a `admin.html`, su correo y su contraseña.

## Qué se construyó

- **`carta.html`** (modificado): ahora carga los platos y bebidas automáticamente desde Firebase, en vez de tenerlos escritos a mano en el HTML.
- **`admin.html` + `admin.js`**: panel privado donde el dueño inicia sesión y agrega, edita o elimina platos y bebidas, incluyendo fotos tomadas con el celular (se comprimen automáticamente antes de guardarse).
- **`firebase-config.js`**: archivo donde van pegadas las credenciales de tu proyecto Firebase. Lo usan tanto `admin.js` como `carta.html`.
- **`seed-data.js`**: una copia de la carta que ya tenías escrita, lista para importarse a la base de datos con un botón, una sola vez.
- **`firestore.rules`**: las reglas de seguridad que debes pegar en la consola de Firebase.

**Importante:** no se usa Firebase Storage. Desde febrero de 2026, Firebase Storage exige el plan de pago Blaze (aunque no te cobre si no superas la cuota gratis). Para evitar pedirle tarjeta de crédito a tu cliente, las fotos comprimidas se guardan como texto (Base64) directamente en Firestore, que sigue siendo 100% gratis con el plan Spark.

---

## Paso 1: Crear el proyecto en Firebase

1. Ve a [console.firebase.google.com](https://console.firebase.google.com) e inicia sesión con una cuenta Google (idealmente la del negocio o una tuya que administres).
2. Clic en **"Crear un proyecto"**. Ponle un nombre, por ejemplo `tetera-de-greda`.
3. Puedes desactivar Google Analytics (no lo necesitas para esto).
4. Espera a que termine de crearse.

## Paso 2: Registrar una app web

1. En el panel del proyecto, clic en el ícono **`</>`** ("Web") para agregar una app web.
2. Ponle un apodo, ej. "Tetera Web". No necesitas activar Firebase Hosting (ya usas Vercel).
3. Firebase te mostrará un bloque de código con un objeto `firebaseConfig`. **Cópialo completo.**

## Paso 3: Pegar las credenciales en tu proyecto

1. Abre el archivo `firebase-config.js`.
2. Reemplaza los valores `PEGA_AQUI_...` por los que copiaste en el paso anterior. Debe quedar algo así:

```js
const firebaseConfig = {
  apiKey: "AIzaSyD...",
  authDomain: "tetera-de-greda.firebaseapp.com",
  projectId: "tetera-de-greda",
  storageBucket: "tetera-de-greda.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## Paso 4: Activar Authentication (para el login del dueño)

1. En el menú lateral de Firebase, ve a **Build > Authentication**.
2. Clic en **"Comenzar"**.
3. En la pestaña **"Sign-in method"**, habilita **"Correo electrónico/contraseña"** (Email/Password).
4. Ve a la pestaña **"Users"** y clic en **"Agregar usuario"**.
5. Crea el usuario que usará tu cliente: su correo y una contraseña segura. **Este es el login que le entregarás a él**, no necesita registrarse solo (así evitamos que cualquiera cree una cuenta).

## Paso 5: Activar Firestore Database

1. En el menú lateral, ve a **Build > Firestore Database**.
2. Clic en **"Crear base de datos"**.
3. Elige una ubicación cercana (por ejemplo `southamerica-east1` – São Paulo, la más cercana a Chile).
4. Elige **"Iniciar en modo de producción"** (no en modo de prueba).
5. Una vez creada, ve a la pestaña **"Reglas"** (Rules), borra lo que hay y pega el contenido completo del archivo `firestore.rules` que te entregué. Clic en **"Publicar"**.

## Paso 6: Subir los archivos a tu repositorio / Vercel

Sube estos archivos nuevos junto a los que ya tenías (`index.html`, `nosotros.html`, etc.):

- `carta.html` (reemplaza el que ya tenías)
- `admin.html`
- `admin.js`
- `firebase-config.js`
- `seed-data.js`

Haz `git add .`, `git commit -m "Agrega panel de administración con Firebase"`, `git push`. Vercel desplegará automáticamente.

## Paso 7: Importar la carta actual (una sola vez)

1. Abre `https://tu-dominio-en-vercel.app/admin.html`.
2. Inicia sesión con el correo/contraseña que creaste en el Paso 4.
3. Presiona el botón **"Importar carta actual (una sola vez)"**. Esto copiará todos los platos y bebidas que ya tenías escritos, para que no tengas que volver a tipearlos.
4. Ábrelo en tu navegador nuevamente para chequear que carta.html los muestre. Si haces esto dos veces, los platos quedarán duplicados — si eso pasa, simplemente bórralos manualmente desde el panel.

## Paso 8: Entregar el acceso a tu cliente

Dale a tu cliente:

- El link: `https://tu-dominio-en-vercel.app/admin.html`
- Su correo y contraseña (creados en el Paso 4)
- Indícale que desde ahí puede tomar una foto con el celular, escribir el nombre y precio del plato, elegir la categoría y presionar "Guardar Plato". La foto se comprime sola.

> Sugerencia: no enlaces `admin.html` desde el menú de navegación del sitio público — que solo se acceda escribiendo la URL directamente. Aun así, está protegido por login, así que nadie sin la contraseña puede modificar nada.

---

## Preguntas frecuentes

**¿Esto sigue siendo 100% gratis?**
Sí. Firestore tiene una cuota diaria gratuita (50.000 lecturas, 20.000 escrituras, 1 GiB de almacenamiento) más que suficiente para el menú de un restaurante. No necesitas tarjeta de crédito ni el plan Blaze.

**¿Qué pasa si en el futuro quiero fotos de mejor calidad o el negocio crece mucho?**
Puedes subir de plan a Blaze (pago por uso, con cuota gratis igual) y migrar a Firebase Storage para las imágenes, dejando Firestore solo con los datos. Avísame si llegas a ese punto y te ayudo a migrarlo.

**¿Puede el dueño usar esto desde el celular?**
Sí, `admin.html` es responsivo y funciona bien desde el navegador del celular (Chrome/Safari).

**¿Qué pasa si olvida la contraseña?**
Desde Firebase Console > Authentication > Users puedes restablecer la contraseña del usuario en cualquier momento.
