export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function requireAdmin(profile, full = false) {
  if (!profile?.activo || !['completo', 'contenido'].includes(profile.rol) || (full && profile.rol !== 'completo')) throw new ApiError(403, 'Tu cuenta no tiene permiso para esta operación.');
}
export function validateChange(actorUid, targetUid, current, change, fullCount) {
  if (actorUid === targetUid) throw new ApiError(400, 'Otra persona con acceso completo debe modificar tu cuenta.');
  if (current.activo && current.rol === 'completo' && (change.eliminar || change.activo === false || change.rol === 'contenido') && fullCount <= 1) throw new ApiError(409, 'Debe quedar al menos un administrador completo habilitado.');
}
export function validateEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'Escribe un correo válido.');
  return email;
}
export function requireRecentLogin(token, now = Date.now()) {
  if (!Number.isFinite(token.auth_time) || now / 1000 - token.auth_time > 600) throw new ApiError(401, 'Por seguridad, cierra sesión e ingresa nuevamente para gestionar cuentas.');
}
