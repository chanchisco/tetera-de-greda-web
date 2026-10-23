// Cliente local del servidor MCP OFICIAL. No forma parte de dist/.
// Usa la sesión local de Firebase CLI; no lee ni imprime credenciales.
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
const child = process.env.FIREBASE_CLI_ENTRY
  ? spawn(process.execPath,[process.env.FIREBASE_CLI_ENTRY,'mcp','--dir','.','--only','core,auth,firestore'],{windowsHide:true,stdio:['pipe','pipe','pipe']})
  : spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npx.cmd -y firebase-tools@latest mcp --dir . --only core,auth,firestore'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
let buffer = '', nextId = 0;
const pending = new Map();
child.stdout.on('data', chunk => {
  buffer += chunk;
  let end;
  while ((end = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) { const { resolve, reject, timer } = pending.get(msg.id); clearTimeout(timer); pending.delete(msg.id); msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result); }
    } catch { /* mensajes informativos del lanzador */ }
  }
});
child.stderr.on('data', () => {}); // No volcar logs que pudieran contener datos de sesión.
child.on('error', error => { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(error); } pending.clear(); });
child.on('exit', () => { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('El servidor MCP terminó antes de responder.')); } pending.clear(); });
function request(method, params) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('El servidor MCP no respondió dentro del plazo.')); }, 60000);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}
function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !/password|hash|salt|token|private.?key|credential/i.test(key)).map(([key, val]) => [key, redact(val)]));
  if (typeof value === 'string') { try { return redact(JSON.parse(value)); } catch { return value; } }
  return value;
}
try {
  await request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'tetera-setup-local', version: '1.0.0' } });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const list = await request('tools/list', {});
  const name = process.argv[2];
  if (!name) console.log(JSON.stringify(list.tools.map(tool => ({ name: tool.name, description: tool.description?.slice(0, 220) })), null, 2));
  else if (name === '--schema') console.log(JSON.stringify(list.tools.filter(tool => process.argv[3].split(',').includes(tool.name)), null, 2));
  else if (name === '--batch') {
    const operations = JSON.parse(await readFile(process.argv[3], 'utf8'));
    await mkdir('.firebase-private', { recursive: true });
    for (const operation of operations) {
      if (!list.tools.some(tool => tool.name === operation.tool)) throw new Error('Herramienta desconocida: ' + operation.tool);
      const result = await request('tools/call', { name: operation.tool, arguments: operation.arguments });
      const safe = redact(result);
      if (operation.outputName && /^[a-z0-9_-]+$/.test(operation.outputName)) await writeFile(`.firebase-private/${operation.outputName}.json`, JSON.stringify(safe, null, 2));
      console.log(JSON.stringify(operation.quiet ? {tool:operation.tool,saved:!result.isError} : { tool: operation.tool, result: safe }));
      if (result.isError) throw new Error('La operación falló; se detiene el lote sin continuar.');
    }
  }
  else if (name === '--inspect') {
    await mkdir('.firebase-private', { recursive: true });
    const operations = [
      ['firebase_get_environment', {}],
      ['auth_get_users', { limit: 20 }],
      ['firebase_get_security_rules', { type: 'firestore' }]
    ];
    const results = await Promise.allSettled(operations.map(async ([tool, args]) => {
      const result = await request('tools/call', { name: tool, arguments: args });
      const safe = redact(result);
      if (result.isError) throw new Error(JSON.stringify(safe));
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      await writeFile(`.firebase-private/${tool}-${stamp}.json`, JSON.stringify(safe, null, 2), { flag: 'wx' });
      console.log(JSON.stringify({ tool, result: safe }));
      return tool;
    }));
    for (let i = 0; i < results.length; i++) if (results[i].status === 'rejected') { console.error(operations[i][0] + ': ' + results[i].reason.message); process.exitCode = 1; }
    for (const tool of list.tools.filter(tool => ['firestore_get_database','firestore_add_document','firestore_list_documents','firestore_get_document','firebase_validate_security_rules'].includes(tool.name))) console.log(JSON.stringify({ schema: tool.name, inputSchema: tool.inputSchema }));
  }
  else {
    if (!list.tools.some(tool => tool.name === name)) throw new Error('Herramienta no disponible en el servidor MCP oficial.');
    const result = await request('tools/call', { name, arguments: JSON.parse(process.argv[3] || '{}') });
    console.log(JSON.stringify(redact(result), null, 2));
    if (result.isError) process.exitCode = 1;
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { child.stdin.end(); child.kill(); }
