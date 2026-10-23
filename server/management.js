import { randomBytes, randomUUID } from 'node:crypto';
import { ApiError, requireAdmin, requireRecentLogin, validateChange, validateEmail } from './policy.js';
const actions = new Set(['crear', 'permiso', 'estado', 'eliminar', 'recuperar']);
export function createManagementHandler({ getServices, sendRecovery, origin, now = Date.now }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); throw new ApiError(405, 'Método no permitido.'); }
      if (!origin || new URL(origin).protocol !== 'https:') throw new ApiError(503, 'Configura APP_ORIGIN con la dirección HTTPS del sitio.');
      if (req.method === 'POST' && req.headers.origin !== origin) throw new ApiError(403, 'Origen no autorizado.');
      const bearer = /^Bearer (\S+)$/.exec(req.headers.authorization || '');
      if (!bearer) throw new ApiError(401, 'Inicia sesión para continuar.');
      const { auth, db } = getServices();
      let token;
      try { token = await auth.verifyIdToken(bearer[1], true); } catch { throw new ApiError(401, 'Tu sesión terminó. Ingresa nuevamente.'); }
      const actorRef = db.doc(`administradores/${token.uid}`);
      requireAdmin((await actorRef.get()).data(), true);
      const security = (await db.doc('sistema/seguridad').get()).data();
      if (security?.requireMfa === true && token.firebase?.sign_in_second_factor !== 'totp') throw new ApiError(403, 'Ingresa con Google Authenticator para gestionar cuentas.');
      const limitRef = db.doc(`limitesGestion/${token.uid}`);
      await db.runTransaction(async tx => {
        const previous = (await tx.get(limitRef)).data();
        const minute = Math.floor(now() / 60000);
        const count = previous?.minute === minute ? previous.count + 1 : 1;
        if (count > 30) throw new ApiError(429, 'Demasiadas solicitudes. Espera un minuto e intenta otra vez.');
        tx.set(limitRef, { minute, count });
      });
      if (req.method === 'GET') {
        const snapshot = await db.collection('administradores').orderBy('email').limit(501).get();
        if (snapshot.size > 500) throw new ApiError(409, 'La lista supera 500 cuentas. Contacta al responsable técnico.');
        return res.status(200).json({ users: snapshot.docs.map(d => ({ uid: d.id, email: d.data().email, rol: d.data().rol, activo: d.data().activo, invitacionEnviada: d.data().invitacionEnviada, eliminando: d.data().eliminando === true })) });
      }
      requireRecentLogin(token, now());
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new ApiError(415, 'Envía los datos en JSON.');
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { throw new ApiError(400, 'Datos no válidos.'); } }
      if (!body || JSON.stringify(body).length > 4096 || !actions.has(body.action)) throw new ApiError(400, 'Operación no válida.');
      const action = body.action;
      const auditRef = db.doc(`auditoriaGestion/${randomUUID()}`);
      const audit = { actor: token.uid, accion: action, fecha: now(), expiresAt: new Date(now() + 90 * 86400000) };
      if (action === 'crear') {
        const email = validateEmail(body.email);
        if (!['completo', 'contenido'].includes(body.rol)) throw new ApiError(400, 'Selecciona un permiso válido.');
        const user = await auth.createUser({ email, password: randomBytes(48).toString('base64url'), emailVerified: false });
        try {
          await db.runTransaction(async tx => {
            requireAdmin((await tx.get(actorRef)).data(), true);
            const lockRef = db.doc('sistema/gestion');
            const lock = (await tx.get(lockRef)).data();
            tx.set(db.doc(`administradores/${user.uid}`), { email, rol: body.rol, activo: true, creado: now(), invitacionEnviada: false });
            tx.set(lockRef, { revision: (lock?.revision || 0) + 1 });
            tx.set(auditRef, { ...audit, objetivo: user.uid, resultado: 'cuenta-creada' });
          });
        } catch (error) { await auth.deleteUser(user.uid).catch(() => {}); throw error; }
        try { await sendRecovery(email); await db.doc(`administradores/${user.uid}`).update({ invitacionEnviada: true }); }
        catch { return res.status(201).json({ message: 'Cuenta creada, pero no se pudo enviar el correo. Usa “Enviar acceso” para reintentar.', partial: true }); }
        return res.status(201).json({ message: 'Cuenta creada. Se envió un enlace para elegir contraseña.' });
      }
      if (typeof body.uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(body.uid)) throw new ApiError(400, 'Cuenta no válida.');
      const targetRef = db.doc(`administradores/${body.uid}`);
      if (action === 'recuperar') {
        const target = (await targetRef.get()).data();
        if (!target?.activo || target.eliminando) throw new ApiError(409, 'Habilita la cuenta antes de enviar acceso.');
        requireAdmin((await actorRef.get()).data(), true);
        await sendRecovery(target.email);
        await targetRef.update({ invitacionEnviada: true });
        await auditRef.set({ ...audit, objetivo: body.uid, resultado: 'correo-enviado' });
        return res.status(200).json({ message: 'Se envió el correo para establecer o recuperar la contraseña.' });
      }
      const change = action === 'eliminar' ? { activo: false, eliminando: true, eliminar: true } : action === 'permiso' ? { rol: body.rol } : { activo: body.activo };
      if (action === 'permiso' && !['completo', 'contenido'].includes(body.rol)) throw new ApiError(400, 'Permiso no válido.');
      if (action === 'estado' && typeof body.activo !== 'boolean') throw new ApiError(400, 'Estado no válido.');
      // Al habilitar, sincronizar Auth antes de contar la cuenta como activa.
      // Si falla, no se puede perder el último administrador por un rollback tardío.
      if (action === 'estado' && body.activo) {
        const target = (await targetRef.get()).data();
        if (!target || target.eliminando) throw new ApiError(409, 'Esta cuenta no se puede habilitar.');
        validateChange(token.uid, body.uid, target, change, 2);
        await auth.updateUser(body.uid, { disabled: false });
      }
      await db.runTransaction(async tx => {
        requireAdmin((await tx.get(actorRef)).data(), true);
        const lockRef = db.doc('sistema/gestion');
        const lock = (await tx.get(lockRef)).data();
        const target = (await tx.get(targetRef)).data();
        if (!target) throw new ApiError(404, 'La cuenta ya no existe.');
        if (target.eliminando && action !== 'eliminar') throw new ApiError(409, 'La eliminación está pendiente. Reintenta eliminar esta cuenta.');
        const full = await tx.get(db.collection('administradores').where('activo', '==', true));
        validateChange(token.uid, body.uid, target, change, full.docs.filter(d => d.data().rol === 'completo').length);
        const { eliminar, ...saved } = change;
        tx.update(targetRef, { ...saved, actualizado: now() });
        tx.set(lockRef, { revision: (lock?.revision || 0) + 1 });
        tx.set(auditRef, { ...audit, objetivo: body.uid, resultado: 'permiso-aplicado' });
      });
      try {
        if (action === 'eliminar') {
          try { await auth.deleteUser(body.uid); } catch (e) { if (e.code !== 'auth/user-not-found') throw e; }
          await targetRef.delete();
        } else if (action === 'estado' && !body.activo) {
          await auth.updateUser(body.uid, { disabled: true });
          await auth.revokeRefreshTokens(body.uid);
        } else if (body.rol === 'contenido') await auth.revokeRefreshTokens(body.uid);
      } catch {
        return res.status(200).json({ partial: true, message: 'El permiso quedó actualizado, pero falta sincronizar Authentication. Reintenta la misma acción.' });
      }
      await auditRef.update({ resultado: 'completado' });
      return res.status(200).json({ message: action === 'eliminar' ? 'Cuenta eliminada.' : 'Permisos actualizados.' });
    } catch (error) {
      const known = { 'auth/email-already-exists': 'Ese correo ya existe. Revisa la lista o el inventario de migración.', 'auth/invalid-email': 'El correo no es válido.' };
      return res.status(error.status || (known[error.code] ? 409 : 500)).json({ message: known[error.code] || (error.status ? error.message : 'No se pudo completar la operación. Reintenta; si persiste, revisa la configuración del servidor.') });
    }
  };
}
