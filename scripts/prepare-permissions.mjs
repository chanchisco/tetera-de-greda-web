// Preparación local a partir del inventario leído por el MCP oficial.
// Solo crea una propuesta JSON; no modifica Firebase.
import { readdir, readFile, writeFile } from 'node:fs/promises';
const dir = '.firebase-private';
const file = (await readdir(dir)).filter(name => name.startsWith('auth_get_users-')).sort().at(-1);
if (!file) throw new Error('Primero debe existir un inventario de Authentication.');
const snapshot = JSON.parse(await readFile(`${dir}/${file}`, 'utf8'));
const users = snapshot.structuredContent?.users;
if (!Array.isArray(users) || users.length !== 4 || users.some(u => !u.uid || !u.email)) throw new Error('El inventario no coincide con las cuatro cuentas revisadas.');
const parent = 'projects/latetera/databases/(default)/documents';
const operations = users.map(user => ({
  tool: 'firestore_add_document',
  arguments: { parent, collectionId: 'administradores', documentId: user.uid, document: { fields: {
    email: { stringValue: user.email }, rol: { stringValue: 'completo' },
    activo: { booleanValue: !user.disabled }, invitacionEnviada: { booleanValue: true },
    creado: { integerValue: String(Date.now()) }
  } } }
}));
operations.push({ tool: 'firestore_add_document', arguments: { parent, collectionId: 'sistema', documentId: 'migracionAdministradores', document: { fields: { cuentas: { integerValue: String(users.length) }, fecha: { integerValue: String(Date.now()) }, origen: { stringValue: 'firebase-mcp-inventario-revisado' } } } } });
operations.push({ tool: 'firestore_list_documents', arguments: { parent, collectionId: 'administradores', pageSize: 100 }, outputName: 'administradores-after' });
await writeFile(`${dir}/crear-permisos.json`, JSON.stringify(operations, null, 2));
console.log('Plan preparado: cuatro perfiles completos con su UID actual. No incluye ni cambia contraseñas.');
