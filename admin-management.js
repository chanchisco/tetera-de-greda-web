import { auth, db } from './firebase-config.js';
import { doc, onSnapshot, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { sendPasswordResetEmail, getMultiFactorResolver, TotpMultiFactorGenerator, multiFactor, EmailAuthProvider, reauthenticateWithCredential, sendEmailVerification, reload } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { siteConfig } from './site-config.js';

const $ = id => document.getElementById(id);
let currentProfile = null, users = [], busy = false, stopProfile, accessEpoch = 0, profileRevision = 0;
let dialogResolve = null, lastFocus;
const dialog = $('management-dialog');
function feedback(id, message, error = false) { $(id).textContent = message; $(id).dataset.error = String(error); }
export function ask({ title, text, submit = 'Confirmar', fields = [], secret = '' }) {
  if (dialog.open) return Promise.resolve(null);
  lastFocus = document.activeElement;
  $('management-dialog-title').textContent = title;
  $('management-dialog-text').textContent = text;
  $('management-dialog-submit').textContent = submit;
  $('management-dialog-error').textContent = '';
  const container = $('management-dialog-fields'); container.replaceChildren();
  if (secret) { const code = document.createElement('code'); code.textContent = secret; container.append(code); }
  for (const field of fields) {
    const label = document.createElement('label'); label.htmlFor = `dialog-${field.name}`; label.textContent = field.label;
    const input = document.createElement('input'); input.id = label.htmlFor; input.name = field.name; input.type = field.type || 'text'; input.required = true;
    input.autocomplete = field.type === 'password' ? 'current-password' : 'one-time-code';
    if (field.code) { input.inputMode = 'numeric'; input.pattern = '[0-9]{6}'; input.maxLength = 6; }
    container.append(label, input);
  }
  dialog.showModal();
  (fields.length ? container.querySelector('input') : $('management-dialog-cancel')).focus();
  return new Promise(resolve => { dialogResolve = resolve; });
}
function finishDialog(value) {
  const resolve = dialogResolve; dialogResolve = null;
  $('management-dialog-fields').replaceChildren(); dialog.close(); resolve?.(value); lastFocus?.focus();
}
$('management-dialog-form').addEventListener('submit', e => { e.preventDefault(); finishDialog(Object.fromEntries(new FormData(e.target))); });
$('management-dialog-cancel').onclick = () => finishDialog(null);
dialog.addEventListener('cancel', e => { e.preventDefault(); finishDialog(null); });

export async function completeMfa(error) {
  if (error.code !== 'auth/multi-factor-auth-required') throw error;
  const resolver = getMultiFactorResolver(auth, error);
  const hints = resolver.hints.map((hint, index) => ({ hint, index })).filter(({ hint }) => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID);
  if (!hints.length) throw new Error('Esta cuenta usa otro segundo factor. Contacta al responsable.');
  // Permite elegir cuando una cuenta tiene más de un autenticador inscrito.
  let index = hints[0].index;
  if (hints.length > 1) {
    const selection = await ask({ title: 'Elegir autenticador', text: hints.map(({ hint, index }) => `${index + 1}: ${hint.displayName || 'Autenticador'}`).join('\n'), fields: [{ name: 'factor', label: 'Número de autenticador', type: 'number' }] });
    if (!selection) return null;
    index = Number(selection.factor) - 1;
    if (!hints.some(item => item.index === index)) throw new Error('Selecciona un autenticador de la lista.');
  }
  const result = await ask({ title: 'Verificación en dos pasos', text: 'Escribe el código de Google Authenticator. Si perdiste el dispositivo, contacta al responsable técnico para recuperar el factor.', submit: 'Verificar', fields: [{ name: 'code', label: 'Código de seis dígitos', code: true }] });
  if (!result) return null;
  return resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(resolver.hints[index].uid, result.code));
}

export function watchAccess(user, start) {
  stopProfile?.(); const epoch = ++accessEpoch; currentProfile = null;
  $('gestion-nav').classList.add('hidden'); $('management-users').replaceChildren(); users = [];
  if (dialog.open) finishDialog(null);
  if (!user) return;
  $('login-error').textContent = 'Comprobando permisos…';
  let started = false;
  stopProfile = onSnapshot(doc(db, 'administradores', user.uid), async snap => {
    const revision = ++profileRevision;
    if (epoch !== accessEpoch) return;
    const profile = snap.data();
    if (!profile?.activo || !['completo', 'contenido'].includes(profile.rol)) {
      $('panel-root').classList.add('hidden'); $('login-page').style.display = 'flex';
      $('login-error').textContent = 'Esta cuenta no tiene acceso habilitado. Solicita ayuda al administrador completo.';
      $('gestion-nav').classList.add('hidden'); currentProfile = null;
      $('management-users').replaceChildren(); users = [];
      if (dialog.open) finishDialog(null);
      return;
    }
    try {
      const security = (await getDoc(doc(db, 'sistema', 'seguridad'))).data();
      if (epoch !== accessEpoch || revision !== profileRevision) return;
      if (security?.requireMfa) {
        const token = await user.getIdTokenResult();
        if (epoch !== accessEpoch || revision !== profileRevision) return;
        if (token.claims.firebase?.sign_in_second_factor !== 'totp') throw new Error('Ingresa con Google Authenticator. Si todavía no lo configuraste, contacta al responsable técnico.');
      }
      currentProfile = profile;
      $('gestion-nav').classList.toggle('hidden', profile.rol !== 'completo');
      if (profile.rol !== 'completo') {
        $('management-users').replaceChildren(); users = [];
        if ($('page-gestion').classList.contains('active')) document.querySelector('[data-page="inicio"]').click();
      }
      $('login-page').style.display = 'none'; $('panel-root').classList.remove('hidden'); $('login-error').textContent = '';
      if (!started) { started = true; start(); }
      renderSecurity();
    } catch (e) {
      if (epoch !== accessEpoch || revision !== profileRevision) return;
      currentProfile = null; $('gestion-nav').classList.add('hidden'); users = []; $('management-users').replaceChildren();
      $('panel-root').classList.add('hidden'); $('login-page').style.display = 'flex';
      $('login-error').textContent = e.message || 'No se pudo comprobar la seguridad. Reintenta.';
    }
  }, () => {
    if (epoch !== accessEpoch) return;
    ++profileRevision; currentProfile = null; users = [];
    $('gestion-nav').classList.add('hidden'); $('management-users').replaceChildren();
    if (dialog.open) finishDialog(null);
    $('panel-root').classList.add('hidden'); $('login-page').style.display = 'flex';
    $('login-error').textContent = 'No se pudieron comprobar permisos. Verifica la conexión y la configuración de Firebase; luego reintenta.';
  });
}

async function recovery(email, id) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { feedback(id, 'Escribe un correo válido en el campo Correo electrónico.', true); $('login-email').focus(); return; }
  feedback(id, 'Solicitando correo…');
  try { auth.languageCode = 'es'; await sendPasswordResetEmail(auth, email); }
  catch (e) {
    // No revela si una dirección está registrada.
    if (!['auth/user-not-found', 'auth/invalid-email'].includes(e.code)) { feedback(id, 'No se pudo solicitar el correo. Espera un momento, revisa la conexión y reintenta.', true); return; }
  }
  feedback(id, 'Si el correo corresponde a una cuenta, recibirás un enlace. Revisa también spam.');
}
$('forgot-password').onclick = async e => { e.target.disabled = true; await recovery($('login-email').value.trim(), 'recovery-status'); e.target.disabled = false; };
$('own-recovery').onclick = async e => { e.target.disabled = true; await recovery(auth.currentUser?.email, 'security-feedback'); e.target.disabled = false; };

async function request(body) {
  if (!auth.currentUser || currentProfile?.rol !== 'completo') throw new Error('No tienes permiso para gestionar cuentas.');
  const token = await auth.currentUser.getIdToken();
  let response;
  try { response = await fetch('/api/gestion', { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) }); }
  catch { throw new Error('No se recibió confirmación. Actualiza la lista antes de repetir la acción; podría haberse completado.'); }
  let result;
  try { result = await response.json(); } catch { throw new Error('La API de Gestión no está disponible. Revisa la configuración de Vercel.'); }
  if (!response.ok) throw new Error(result.message || 'No se pudo completar la operación.');
  return result;
}
export async function loadUsers() {
  if (busy || currentProfile?.rol !== 'completo') return;
  const uid = auth.currentUser?.uid;
  $('management-users').setAttribute('aria-busy', 'true');
  try {
    const result = await request();
    if (auth.currentUser?.uid !== uid || currentProfile?.rol !== 'completo') return;
    users = result.users; renderUsers();
  } catch (e) { feedback('management-status', e.message, true); }
  finally { $('management-users').setAttribute('aria-busy', 'false'); }
}
function setBusy(value) {
  busy = value;
  $('invite-form').querySelectorAll('button,input,select').forEach(el => { el.disabled = value; });
  $('refresh-users').disabled = value;
  renderUsers();
}
function renderUsers() {
  const list = $('management-users'); list.replaceChildren();
  if (!users.length) { list.textContent = 'No hay cuentas en la lista. Pulsa Actualizar lista para volver a comprobar.'; return; }
  for (const user of users) {
    const row = document.createElement('article'); row.className = 'management-user';
    const title = document.createElement('h3'); title.textContent = user.email;
    const state = document.createElement('p'); state.textContent = `${user.activo ? 'Habilitada' : 'Desactivada'} · ${user.rol === 'completo' ? 'Administrador completo' : 'Administrador de contenido'}${user.invitacionEnviada === false ? ' · Invitación pendiente de envío' : ''}${user.eliminando ? ' · Eliminación pendiente' : ''}`;
    row.append(title, state);
    const own = user.uid === auth.currentUser?.uid;
    for (const control of [{ name: 'Acceso completo', checked: user.rol === 'completo', action: 'permiso' }, { name: 'Cuenta habilitada', checked: user.activo, action: 'estado' }]) {
      const label = document.createElement('label'), input = document.createElement('input'); input.type = 'checkbox'; input.setAttribute('role', 'switch'); input.checked = control.checked; input.disabled = busy || own || user.eliminando;
      input.setAttribute('aria-label', `${control.name}: ${user.email}`);
      input.onchange = () => { const desired = input.checked; input.checked = control.checked; manage(user, control.action, desired); };
      label.append(input, document.createTextNode(control.name)); row.append(label);
    }
    const actions = document.createElement('div'); actions.className = 'management-actions';
    for (const [action, label] of [['recuperar', 'Enviar acceso'], ['eliminar', user.eliminando ? 'Reintentar eliminación' : 'Eliminar cuenta']]) {
      const button = document.createElement('button'); button.type = 'button'; button.className = `management-button${action === 'eliminar' ? ' danger' : ''}`; button.textContent = label;
      button.disabled = busy || (action === 'eliminar' ? own : !user.activo || user.eliminando); button.onclick = () => manage(user, action); actions.append(button);
    }
    row.append(actions);
    if (own) { const note = document.createElement('p'); note.textContent = 'Tu cuenta: otro administrador completo debe cambiar tus permisos.'; row.append(note); }
    list.append(row);
  }
}
async function manage(user, action, value) {
  if (busy) return;
  const descriptions = { recuperar: 'Se enviará un enlace para elegir una contraseña. No cambia su permiso.', eliminar: 'Se eliminará la cuenta y perderá acceso al panel. Esta acción no se puede deshacer.', permiso: value ? 'Podrá invitar personas, cambiar permisos y eliminar cuentas.' : 'Podrá seguir editando contenido, pero no podrá gestionar cuentas.', estado: value ? 'Esta cuenta podrá volver a administrar el contenido.' : 'Esta cuenta perderá acceso al panel.' };
  if (!await ask({ title: action === 'eliminar' ? 'Eliminar cuenta' : 'Confirmar cambio', text: `${user.email}\n${descriptions[action]}`, submit: action === 'eliminar' ? 'Eliminar cuenta' : 'Confirmar' })) return;
  setBusy(true); feedback('management-status', 'Aplicando cambio…');
  try {
    const body = { action, uid: user.uid };
    if (action === 'permiso') body.rol = value ? 'completo' : 'contenido';
    if (action === 'estado') body.activo = value;
    const result = await request(body); feedback('management-status', result.message, result.partial);
  } catch (e) { feedback('management-status', e.message, true); }
  finally { setBusy(false); await loadUsers(); }
}
$('refresh-users').onclick = () => loadUsers();
$('gestion-nav').addEventListener('click', () => loadUsers());
$('invite-form').addEventListener('submit', async e => {
  e.preventDefault(); if (busy) return;
  const email = $('invite-email').value.trim(), rol = $('invite-role').value;
  if (!await ask({ title: 'Invitar administrador', text: `${email}\n${rol === 'completo' ? 'Tendrá acceso completo, incluida la gestión de otras cuentas.' : 'Podrá administrar contenido sin gestionar cuentas.'}`, submit: 'Crear y enviar' })) return;
  setBusy(true); feedback('management-status', 'Creando cuenta y enviando enlace…');
  try { const result = await request({ action: 'crear', email, rol }); $('invite-form').reset(); feedback('management-status', result.message, result.partial); }
  catch (e) { feedback('management-status', e.message, true); }
  finally { setBusy(false); await loadUsers(); }
});

function renderSecurity() {
  const user = auth.currentUser; if (!user) return;
  const enrolled = multiFactor(user).enrolledFactors.some(f => f.factorId === TotpMultiFactorGenerator.FACTOR_ID);
  $('security-status').textContent = `${user.email} · ${enrolled ? 'Google Authenticator configurado.' : siteConfig.totpEnabled ? 'Puedes proteger tu acceso con Google Authenticator.' : 'Google Authenticator pendiente de verificar y habilitar en el plan gratuito.'}`;
  $('verify-email').hidden = !siteConfig.totpEnabled || user.emailVerified;
  $('totp-enroll').hidden = !siteConfig.totpEnabled || !user.emailVerified || enrolled;
}
$('verify-email').onclick = async e => {
  e.target.disabled = true;
  try { auth.languageCode = 'es'; await sendEmailVerification(auth.currentUser); feedback('security-feedback', 'Revisa tu correo. Después de verificarlo, cierra sesión y vuelve a ingresar.'); }
  catch { feedback('security-feedback', 'No se pudo enviar la verificación. Espera y reintenta.', true); }
  finally { e.target.disabled = false; }
};
$('totp-enroll').onclick = async e => {
  e.target.disabled = true;
  try {
    const user = auth.currentUser;
    const credentials = await ask({ title: 'Confirmar identidad', text: 'Confirma tu contraseña para configurar el segundo factor. No se guarda ni se envía a Gestión.', fields: [{ name: 'password', label: 'Contraseña actual', type: 'password' }] });
    if (!credentials) return;
    try { await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, credentials.password)); } catch (error) { if (!await completeMfa(error)) return; }
    credentials.password = '';
    await reload(user);
    const secret = await TotpMultiFactorGenerator.generateSecret(await multiFactor(user).getSession());
    const code = await ask({ title: 'Configurar Google Authenticator', text: 'En Google Authenticator pulsa + y “Introducir clave de configuración”. Usa tu correo como nombre y “Basada en tiempo”. Guarda esta clave de forma segura; no la compartas. Luego introduce el código generado.', secret: secret.secretKey, submit: 'Activar segundo factor', fields: [{ name: 'code', label: 'Código de seis dígitos', code: true }] });
    if (!code) return;
    await multiFactor(user).enroll(TotpMultiFactorGenerator.assertionForEnrollment(secret, code.code), 'Google Authenticator');
    feedback('security-feedback', 'Google Authenticator configurado. Cierra sesión e ingresa para comprobarlo.'); renderSecurity();
  } catch { feedback('security-feedback', 'No se pudo configurar el autenticador. Comprueba el código, la hora del teléfono y la habilitación de TOTP en Firebase. Reintenta.', true); }
  finally { e.target.disabled = false; }
};
