import { readFile,writeFile,copyFile,unlink } from 'node:fs/promises';
import { join } from 'node:path';
const destination=process.argv[2]||'ENTREGA_CLOUDFLARE_2026_11_06';
process.argv[2]=destination;
await import('./prepare-github.mjs');
const pkg=JSON.parse(await readFile('package.json','utf8'));
pkg.name='tetera-de-greda-cloudflare';
pkg.scripts={...pkg.scripts,build:'node scripts/build-cloudflare.mjs',dev:'wrangler dev','cf:check':'wrangler deploy --dry-run','cf:deploy':'wrangler deploy'};
pkg.devDependencies={...pkg.devDependencies,wrangler:'4.158.0'};
await writeFile(join(destination,'package.json'),JSON.stringify(pkg,null,2)+'\n');
// npm actualizará la copia del lock conservando las versiones ya verificadas.

await unlink(join(destination,'vercel.json'));
const config=JSON.parse(await readFile('cloudflare/wrangler.jsonc','utf8'));
config.main='cloudflare/worker.js';config.assets.directory='./dist';
await writeFile(join(destination,'wrangler.jsonc'),JSON.stringify(config,null,2)+'\n');
await writeFile(join(destination,'.node-version'),'22\n');
await writeFile(join(destination,'.env.example'),'# Configurar en Cloudflare > Settings > Variables and Secrets. Este archivo no activa variables.\nFIREBASE_PROJECT_ID=latetera\nFIREBASE_CLIENT_EMAIL=\nFIREBASE_PRIVATE_KEY=\nFIREBASE_WEB_API_KEY=\nAPP_ORIGIN=\n');
for(const name of ['GUIA_CLOUDFLARE_PASO_A_PASO.md','ENTREGA_CARTA_FACEBOOK_CLOUDFLARE.md'])await copyFile(name,join(destination,name));
await copyFile('GUIA_CLOUDFLARE_PASO_A_PASO.md',join(destination,'README.md'));
console.log('Cloudflare: configuración y copia independientes preparadas. Generar su lock con npm install --package-lock-only --ignore-scripts.');
