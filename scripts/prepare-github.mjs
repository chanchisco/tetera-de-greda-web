import { mkdir, readdir, copyFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const destination = process.argv[2] || `PARA_SUBIR_GITHUB_${stamp}`;
if(!/^(PARA_SUBIR_GITHUB_|ENTREGA_)[a-zA-Z0-9_-]+$/.test(destination)) throw new Error('Nombre de carpeta no válido.');
const rootFiles = [
  'index.html','carta.html','nosotros.html','admin.html','admin.js','admin-management.js','admin-management.css',
  'firebase-config.js','site-config.js','privacy.js','privacy.css','privacidad.html','cookies.html','aviso-legal.html',
  'content-client.js','content-tools.js','content-tools.css','image-editor.js','image-page-preview.js','site-polish.js','site-polish.css','featured.js',
  'logo tetera.png','Google-Review-Emblem.png','platocualquera.jpg','seed-data.js',
  'package.json','package-lock.json','vercel.json','firebase.json','.firebaserc','firestore.rules','.gitignore','.env.example'
];
await mkdir(destination);
for (const file of rootFiles) await copyFile(file, join(destination, file));
async function copySources(directory) {
  await mkdir(join(destination, directory), { recursive: true });
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('No se copiarán enlaces simbólicos.');
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await copySources(path);
    else if (/\.(m?js)$/.test(entry.name)) await copyFile(path, join(destination, path));
  }
}
for (const directory of ['api','server','scripts','tests']) await copySources(directory);
console.log('Carpeta limpia creada: ' + destination);
console.log('Subir su contenido a la raíz de GitHub cuando se complete la configuración de Vercel.');
console.log('No contiene sesiones, respaldos privados, claves de servicio, .env real, node_modules, dist o capturas.');
