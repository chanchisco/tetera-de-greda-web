import test from 'node:test';
import assert from 'node:assert/strict';
import { createManagementHandler } from '../server/management.js';
import { validateChange, requireAdmin, requireRecentLogin } from '../server/policy.js';

// Doble de Firestore con transacciones serializadas. No toca servicios reales.
function setup(initial = {}, options = {}) {
  const state = new Map(Object.entries(initial)); let queue = Promise.resolve(), counter = 0;
  const effects = [];
  function snapshot(path) { const value = state.get(path); return { id: path.split('/').at(-1), exists: !!value, data: () => value && structuredClone(value) }; }
  const db = {
    doc(path) { return { path, get: async () => snapshot(path), set: async data => state.set(path, data), update: async data => state.set(path, { ...state.get(path), ...data }), delete: async () => state.delete(path) }; },
    collection(path) {
      const q = { path, filters: [], max: Infinity, where(key, op, value) { this.filters.push([key, value]); return this; }, orderBy() { return this; }, limit(max) { this.max = max; return this; }, async get() {
        const docs = [...state.keys()].filter(k => k.startsWith(path + '/') && k.split('/').length === 2).map(snapshot).filter(d => q.filters.every(([key, value]) => d.data()[key] === value)).slice(0, q.max);
        return { docs, size: docs.length };
      } }; return q;
    },
    runTransaction(callback) {
      const work = queue.then(async () => {
        const writes = [];
        const result = await callback({ get: ref => ref.get(), set: (ref, data) => writes.push(() => state.set(ref.path, data)), update: (ref, data) => writes.push(() => state.set(ref.path, { ...state.get(ref.path), ...data })) });
        writes.forEach(f => f()); return result;
      }); queue = work.catch(() => {}); return work;
    }
  };
  const auth = {
    async verifyIdToken(id, revoked) { assert.equal(revoked, true); if (id === 'invalid') throw new Error(); return { uid: id, auth_time: options.old ? 1 : 1000, firebase: options.mfa ? { sign_in_second_factor: 'totp' } : {} }; },
    async createUser(data) { effects.push(['create', data]); return { uid: `new${++counter}` }; },
    async deleteUser(uid) { effects.push(['delete', uid]); if (options.authFails) throw new Error(); },
    async updateUser(uid, data) { effects.push(['update', uid, data]); if (options.authFails) throw new Error(); },
    async revokeRefreshTokens(uid) { effects.push(['revoke', uid]); }
  };
  const handler = createManagementHandler({ getServices: () => ({ db, auth }), origin: 'https://example.test', now: () => 1000_000, sendRecovery: async email => { effects.push(['email', email]); if (options.mailFails) throw new Error(); } });
  async function request(uid = 'owner', body, headers = {}) {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await handler({ method: body ? 'POST' : 'GET', headers: { origin: 'https://example.test', authorization: uid ? `Bearer ${uid}` : '', 'content-type': 'application/json', ...headers }, body }, res);
    return res;
  }
  return { request, state, effects };
}
const full = { email: 'owner@example.test', activo: true, rol: 'completo' };
const editor = { email: 'editor@example.test', activo: true, rol: 'contenido' };

test('API deniega visitante, token inválido, editor y cuenta desactivada sin efectos', async () => {
  const app = setup({ 'administradores/editor': editor, 'administradores/off': { ...full, activo: false } });
  for (const [uid, status] of [[null, 401], ['invalid', 401], ['editor', 403], ['off', 403], ['unknown', 403]]) {
    assert.equal((await app.request(uid, { action: 'crear', email: 'a@example.test', rol: 'completo' })).code, status);
  }
  assert.deepEqual(app.effects, []);
});
test('un editor no puede elevarse enviando una petición directa', async () => {
  const app = setup({ 'administradores/editor': editor });
  assert.equal((await app.request('editor', { action: 'permiso', uid: 'editor', rol: 'completo' })).code, 403);
  assert.equal(app.state.get('administradores/editor').rol, 'contenido');
});
test('se rechazan origen ajeno, sesión antigua y datos inválidos', async () => {
  const app = setup({ 'administradores/owner': full });
  assert.equal((await app.request('owner', { action: 'crear' }, { origin: 'https://evil.test' })).code, 403);
  assert.equal((await setup({ 'administradores/owner': full }, { old: true }).request('owner', { action: 'crear' })).code, 401);
  assert.equal((await app.request('owner', { action: 'crear', email: '<bad>', rol: 'completo' })).code, 400);
  assert.equal((await app.request('owner', { action: 'permiso', uid: '../x', rol: 'completo' })).code, 400);
  assert.deepEqual(app.effects, []);
});
test('se crean perfil y correo sin guardar contraseña ni exponerla en respuesta', async () => {
  const app = setup({ 'administradores/owner': full });
  const res = await app.request('owner', { action: 'crear', email: ' New@Example.test ', rol: 'contenido' });
  assert.equal(res.code, 201);
  assert.equal(app.state.get('administradores/new1').rol, 'contenido');
  assert.equal(app.state.get('administradores/new1').email, 'new@example.test');
  assert.ok(!JSON.stringify([...app.state.values()]).includes('password'));
  assert.ok(!JSON.stringify(res.body).includes('password'));
  assert.equal(app.effects.find(e => e[0] === 'email')[1], 'new@example.test');
});
test('fallo de envío deja cuenta recuperable, sin declarar invitación enviada', async () => {
  const app = setup({ 'administradores/owner': full }, { mailFails: true });
  const result = await app.request('owner', { action: 'crear', email: 'a@example.test', rol: 'contenido' });
  assert.equal(result.code, 201); assert.equal(result.body.partial, true);
  assert.equal(app.state.get('administradores/new1').invitacionEnviada, false);
});
test('no se permite modificar la propia cuenta ni retirar al último completo', async () => {
  const app = setup({ 'administradores/owner': full });
  for (const action of ['eliminar', 'estado', 'permiso']) assert.equal((await app.request('owner', { action, uid: 'owner', activo: false, rol: 'contenido' })).code, 400);
  assert.throws(() => validateChange('other', 'owner', full, { activo: false }, 1), { status: 409 });
  assert.throws(() => validateChange('other', 'owner', full, { rol: 'contenido' }, 1), { status: 409 });
  assert.throws(() => requireAdmin({ activo: true, rol: 'inventado' }), { status: 403 });
  assert.throws(() => requireRecentLogin({}), { status: 401 });
});
test('dos administradores no pueden quitarse mutuamente y dejar cero completos', async () => {
  const app = setup({ 'administradores/owner': full, 'administradores/second': { ...full, email: 'second@example.test' } });
  const results = await Promise.all([
    app.request('owner', { action: 'permiso', uid: 'second', rol: 'contenido' }),
    app.request('second', { action: 'permiso', uid: 'owner', rol: 'contenido' })
  ]);
  assert.equal(results.filter(r => r.code === 200).length, 1);
  assert.equal([...app.state.entries()].filter(([k, v]) => k.startsWith('administradores/') && v.activo && v.rol === 'completo').length, 1);
});
test('desactivar bloquea permisos aunque Authentication falle y permite reintentar', async () => {
  const app = setup({ 'administradores/owner': full, 'administradores/editor': editor }, { authFails: true });
  const result = await app.request('owner', { action: 'estado', uid: 'editor', activo: false });
  assert.equal(result.body.partial, true); assert.equal(app.state.get('administradores/editor').activo, false);
});
test('fallo al habilitar no hace contar una cuenta inoperativa como administrador completo', async () => {
  const app = setup({ 'administradores/owner': full, 'administradores/off': { ...full, activo: false } }, { authFails: true });
  assert.equal((await app.request('owner', { action: 'estado', uid: 'off', activo: true })).code, 500);
  assert.equal(app.state.get('administradores/off').activo, false);
});
test('exigencia global de TOTP se aplica también al backend', async () => {
  const data = { 'administradores/owner': full, 'sistema/seguridad': { requireMfa: true } };
  assert.equal((await setup(data).request()).code, 403);
  assert.equal((await setup(data, { mfa: true }).request()).code, 200);
});
test('límite por cuenta persistente devuelve 429 al excederlo', async () => {
  const app = setup({ 'administradores/owner': full, 'limitesGestion/owner': { minute: 16, count: 30 } });
  assert.equal((await app.request()).code, 429);
});
test('listar cuentas solo devuelve campos permitidos', async () => {
  const app = setup({ 'administradores/owner': { ...full, internal: 'secret' } });
  const result = await app.request();
  assert.equal(result.code, 200); assert.equal(result.body.users[0].internal, undefined);
  assert.equal(result.headers['Cache-Control'], 'no-store');
});
