# La Tetera de Greda — ajustes del 6 de noviembre de 2026

## Estado de Cloudflare: carga recuperada

Dirección: https://tetera-de-greda-cf.francisco-jeldes90.workers.dev/

Se corrigió el adaptador REST exclusivo de Cloudflare. Codificaba el separador de métodos de Google (por ejemplo documents:runQuery) como %3A, lo que Google respondía con HTTP 404. El servidor ocultaba ese error tras un 503 genérico. Se conservan literales los sufijos RPC y se siguen codificando los identificadores de los documentos. Esto afecta a consultas, imágenes, transacciones y guardados del adaptador. El backend de Vercel no fue modificado.

Se publicó en el repositorio chanchisco/tetera-de-greda-cloudflare:
- 5da45b82b93fb2f389d996b97416fa518468b756: corrección de rutas RPC.
- c6cd51b2a0e3b2305354afde185c98722668aa47: normalización segura de APP_ORIGIN. Se admite la misma dirección con barra final, pero se rechazan protocolo no HTTPS, rutas, usuario/contraseña o parámetros. La recuperación utiliza también el origen normalizado.

Se comprobó en la URL pública: API de catálogo HTTP 200, 59 platos, 79 bebidas, 4 fotos de galería; imagen JPEG HTTP 200 de 319.149 bytes. En el navegador se observaron platos y nueve fotos descargadas en el primer recorrido; las restantes usan carga diferida. No se modificaron documentos de Firebase, cuentas, claves, facturación ni DNS. Los archivos remotos coinciden con los locales, salvo saltos de línea finales.

## Ajustes comunes para Vercel y Cloudflare

1. Mapa: código de inserción obtenido desde Compartir → Incorporar un mapa de la ficha exacta proporcionada por el usuario. Identificador 0x9689d7007ab7985f:0x89c21f3d29fd6004, La tetera de greda, Sta. Ana 98, Villa Alemana. Sustituye la búsqueda genérica de una dirección en Inicio, Carta y Nosotros. El marcador del negocio queda visible en celular. La alternativa sin mapa abre https://maps.app.goo.gl/k2JwBPExN58o6hmK7.
2. Privacidad del mapa: se conserva autorización previa. Guardar otra vez las mismas preferencias no recarga innecesariamente el iframe. Retirar autorización elimina su src y vuelve a mostrar la alternativa.
3. Redes: menos separación entre los botones del contacto (8 px y sin margen duplicado al pasar a dos filas); bloque de Instagram/Facebook del Inicio limitado a 1120 px para aproximar ambas columnas.
4. Reseñas: tarjetas blancas ligeramente transparentes, texto oscuro y estrellas legibles. Se conservan textos, autores y valoraciones anteriores. Se indica que es una selección manual y se enlaza a la ficha completa. No se presentan como opiniones sincronizadas ni se inventan datos o fechas.
5. Nosotros: historia y galería esperan su configuración antes de mostrarse. Solo se muestran bloques configurados y habilitados. Se informa de carga/error sin exhibir los textos de muestra. Se eliminó la lectura de la caché antigua de portada en esta página; portada e historia usan el catálogo validado común. Se refrescan las posiciones de animación al terminar. La carga de datos no depende de que AOS esté disponible.
6. Documentos: privacidad, cookies y aviso legal ampliados con inventario real, categorías de datos, finalidades, proveedores, transferencias pendientes de validación, conservación técnica, derechos, enlaces, contenido comercial y condiciones del acceso privado. Incluyen fecha de revisión, navegación y tablas desplazables en celular. Se corrigió también el tamaño del diálogo/aviso en páginas legales para evitar desbordamiento.

## Reseñas automáticas: decisión tomada

No se activó una integración de reseñas. Places API exige facturación y devuelve hasta cinco opiniones seleccionadas por relevancia; no equivale a las últimas cuatro. Business Profile permite listar y ordenar opiniones de una ubicación verificada, pero requiere proyecto aprobado y OAuth del titular. La autorización de Firebase no autoriza el Perfil de Empresa. El usuario indicó conservar lo actual si no era viable; se mantiene la selección manual con el estilo solicitado. No se agregó scraping, un widget publicitario ni servicios de pago.

Referencias oficiales:
- https://developers.google.com/maps/documentation/places/web-service/place-details
- https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
- https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list
- https://developers.google.com/my-business/content/basic-setup

## Qué subir ahora: pasos simples

La reparación de carga de Cloudflare YA está publicada. Los ajustes visuales y legales están en los archivos de esta entrega y todavía requieren subirlos.

### Vercel
1. Extrae ENTREGA_VERCEL_2026_11_06.zip.
2. En GitHub abre chanchisco/tetera-de-greda-web.
3. Sube el contenido de la carpeta extraída a la raíz, reemplazando los archivos del mismo nombre. Conserva las subcarpetas. No subas el ZIP cerrado ni la carpeta exterior.
4. Guarda con Commit changes y espera la publicación de Vercel.
5. No cambies las variables de Vercel: este ajuste conserva su configuración.

### Cloudflare
1. Extrae ENTREGA_CLOUDFLARE_2026_11_06.zip.
2. En GitHub abre chanchisco/tetera-de-greda-cloudflare.
3. Sube el contenido de la carpeta extraída a la raíz y guarda. Es importante conservar cloudflare/firestore-rest.js y cloudflare/app.js de ESTA versión para no volver al error anterior.
4. Espera la compilación y publicación del Worker. Se conserva el arreglo de la portada / y keep_vars:true. Las cinco variables existentes no necesitan reemplazarse.
5. Usa la dirección workers.dev hasta configurar tú el dominio final. La GUIA_CLOUDFLARE_PASO_A_PASO.md acompaña esa parte.

Para subir solo lo modificado, estos nueve archivos de la raíz son comunes: index.html, carta.html, nosotros.html, menu-social.css, privacy.js, privacy.css, privacidad.html, cookies.html, aviso-legal.html. En Cloudflare también se incluyen los dos archivos corregidos dentro de cloudflare y la prueba tests/cloudflare.test.js. Las entregas completas evitan tener que seleccionar archivos uno a uno.

## Comprobaciones y límites

- 43 pruebas automatizadas correctas, incluidas dos regresiones nuevas: URLs RPC y normalización segura del origen.
- Compilación Vercel y Cloudflare correctas; empaquetado Wrangler verificado sin desplegarlo desde la terminal (1388,53 KiB / gzip 262,21 KiB).
- Prueba de lectura real dentro de Workers, sin mostrar credenciales ni modificar datos; antes del arreglo 404, después 200.
- Verificación visual local a 1440 y 390 px: reseñas, redes, mapa y páginas legales. Sin desbordamiento horizontal de las páginas; la tabla de cookies se desplaza dentro de su región.
- Preferencias: mapa ausente antes de autorizarlo, correcto al autorizarlo, retirado al desautorizarlo; diálogo cerrable con Escape.
- Nosotros: bloques 2 y 3 ausentes cuando solo existe el bloque 1; sin mostrar primero los textos predeterminados.
- La prueba de publicación no inició sesión con una cuenta del restaurante ni guardó cambios en datos reales. Conviene comprobar un guardado habitual con la cuenta propia después de actualizar.

## Pendientes que no se pueden inventar

Nombre/razón social, RUT, representante, domicilio formal y correo de privacidad siguen sin definir por petición del usuario. También deben validarse plazos del negocio, contratos/transferencias y fidelidad/autorización de las reseñas e imágenes. siteConfig.legal.published permanece false. Los documentos no acreditan por sí solos cumplimiento legal.

La revisión cita la normativa oficial consultada (Ley 19.628 y Ley 21.719) y distingue el régimen aplicable; debe comprobarse su vigencia antes de aprobar el texto definitivo. No se afirma que 2FA esté activo: sigue desactivado y no se habilitó Identity Platform con facturación.

Vercel y Cloudflare comparten el mismo Firebase. Separar repositorios y alojamiento no duplica ni respalda automáticamente los datos. Las cachés pueden demorar unos diez minutos en reflejar actualizaciones.
