import { mkdir, readdir, copyFile, unlink } from 'node:fs/promises';
import { build } from 'esbuild';
import sharp from 'sharp';
// Lista explícita: nunca publicar secretos, scripts, reglas o documentación privada.
const files = (await readdir('.')).filter(name => /\.(html|css|png|jpg|webp|ico)$/.test(name)
  || ['admin.js', 'admin-management.js', 'firebase-config.js', 'site-config.js', 'privacy.js','content-store.js','quota-errors.js','public-content.js','public-data-cache.js','public-data-model.js','content-client.js','image-editor.js','image-page-preview.js','content-tools.js','social-links.js','site-polish.js','featured.js'].includes(name));
await mkdir('dist', { recursive: true });
for(const name of ['_headers','_redirects'])await unlink(`dist/${name}`).catch(error=>{if(error.code!=='ENOENT')throw error;});
for (const name of files) await copyFile(name, `dist/${name}`);
await sharp('logo tetera.png').resize({width:480,withoutEnlargement:true}).webp({quality:85}).toFile('dist/logo-tetera.webp');
await sharp('logo tetera.png').resize(48,48).png().toFile('dist/favicon-tetera.png');
await build({entryPoints:['scripts/qr-entry.mjs'],outfile:'dist/qr-code.js',bundle:true,format:'esm',platform:'browser',minify:true});
console.log(`Preparados ${files.length} archivos públicos en dist/. Funciones de servidor según la plataforma elegida.`);
