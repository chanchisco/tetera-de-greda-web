import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { qaResponse } from './qa-fixtures.mjs';
const root = resolve('dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };
createServer(async (req, res) => {
  if (await qaResponse(req, res)) return;
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  // Visor de QA local: el iframe fija un viewport real sin tocar las páginas.
  if (name === '/__preview') {
    const url = new URL(req.url, 'http://localhost');
    const width = url.searchParams.get('width') === '390' ? 390 : 1440;
    const page = ['index.html','carta.html','nosotros.html','admin.html','privacidad.html','__qa/admin.html'].includes(url.searchParams.get('page')) ? url.searchParams.get('page') : 'index.html';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!doctype html><html lang="es"><title>Verificación local ${width}px</title><body style="margin:0;background:#eee"><p>Verificación local: ${width}px · <a href="/__preview?width=390&page=${page}">390px</a> · <a href="/__preview?width=1440&page=${page}">1440px</a></p><iframe title="Vista ${width}px" width="${width}" height="${width === 390 ? 844 : 900}" style="border:0;transform:scale(${width === 390 ? '.75' : '.7'});transform-origin:top left" src="/${page}"></iframe></body></html>`); return;
  }
  const path = resolve(root, '.' + (name === '/' ? '/index.html' : name));
  if (!path.startsWith(root + '\\') && !path.startsWith(root + '/')) { res.writeHead(403).end(); return; }
  try { res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream'); res.end(await readFile(path)); }
  catch { res.writeHead(404).end('No encontrado. Este servidor solo prueba archivos estáticos; la API necesita Vercel.'); }
}).listen(4173, '127.0.0.1', () => console.log('Vista local: http://127.0.0.1:4173'));
