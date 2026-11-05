import './build.mjs';
import { readFile,writeFile,stat } from 'node:fs/promises';
// Solo la copia compilada de Cloudflare usa el dominio desde el que se abre.
const source=await readFile('site-config.js','utf8');
await writeFile('dist/site-config.js',source.replace(/publicOrigin:\s*'[^']*'/,"publicOrigin: location.origin"));
await writeFile('dist/_headers',`/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Strict-Transport-Security: max-age=31536000
/admin.html
  X-Robots-Tag: noindex, nofollow
  Cache-Control: no-store
`);
await writeFile('dist/_redirects','');
for(const file of ['logo tetera.png','platocualquera.jpg'])if((await stat(`dist/${file}`)).size>25*1024*1024)throw new Error(`Recurso demasiado grande para Cloudflare: ${file}`);
console.log('Cloudflare: recursos preparados; API en cloudflare/worker.js.');
