import { readFile, writeFile } from 'node:fs/promises';
import { services } from '../server/firebase.js';
const { auth, db } = services();
const apply = process.argv.includes('--apply');
if (!apply) {
  const users = []; let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users.map(u => ({ uid: u.uid, email: u.email || '', activo: !u.disabled, rol: 'completo' })));
    pageToken = page.pageToken;
  } while (pageToken);
  await writeFile('admin-migration.json', JSON.stringify({ generatedAt: new Date().toISOString(), users }, null, 2));
  console.log('Inventario privado creado: admin-migration.json. Revisa sus cuentas antes de importar. No se cambió Firebase.');
} else {
  const inventory = JSON.parse(await readFile('admin-migration.json', 'utf8'));
  if (!inventory.users?.some(u => u.activo && u.rol === 'completo')) throw new Error('Debe haber al menos una cuenta completa activa.');
  const marker = db.doc('sistema/migracionAdministradores');
  // Verifica identidades antes de escribir; no cambia contraseñas ni el estado de Auth.
  for (const u of inventory.users) {
    const actual = await auth.getUser(u.uid);
    if (!actual.email || actual.email.toLowerCase() !== u.email.toLowerCase() || !['completo', 'contenido'].includes(u.rol) || u.activo !== !actual.disabled) throw new Error('Inventario desactualizado o inválido; vuelve a generarlo.');
  }
  await db.runTransaction(async tx => {
    if ((await tx.get(marker)).exists) throw new Error('La migración ya fue aplicada. Usa Gestión para cambios posteriores.');
    for (const u of inventory.users) {
      if ((await tx.get(db.doc(`administradores/${u.uid}`))).exists) throw new Error('Ya existen permisos; no se sobrescribirán.');
    }
    if (inventory.users.length > 400) throw new Error('Más de 400 cuentas: necesita migración por lotes revisada.');
    for (const u of inventory.users) tx.create(db.doc(`administradores/${u.uid}`), { ...u, creado: Date.now(), invitacionEnviada: true });
    tx.create(marker, { fecha: Date.now(), cuentas: inventory.users.length });
  });
  console.log('Migración completada una sola vez. Contraseñas y contenido conservados.');
}
