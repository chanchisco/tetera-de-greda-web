import { mkdir, readdir, copyFile } from 'node:fs/promises';
// Lista explícita: nunca publicar secretos, scripts, reglas o documentación privada.
const files = (await readdir('.')).filter(name => /\.(html|css|png|jpg|webp|ico)$/.test(name)
  || ['admin.js', 'admin-management.js', 'firebase-config.js', 'site-config.js', 'privacy.js'].includes(name));
await mkdir('dist', { recursive: true });
for (const name of files) await copyFile(name, `dist/${name}`);
console.log(`Preparados ${files.length} archivos públicos en dist/. API desplegada por Vercel.`);
