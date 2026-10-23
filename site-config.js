// Configuración pública. Nunca añadir claves privadas o contraseñas aquí.
export const siteConfig = {
  publicOrigin: 'https://tetera-de-greda-web.vercel.app',
  galleryLimit: 15,
  trashDays: 5,
  legal: {
    published: false, // Cambiar a true SOLO al completar y validar los textos.
    responsible: '', rut: '', representative: '', address: '', email: '',
    retention: '', providersAndTransfers: ''
  },
  // Activar solo tras verificar TOTP en Identity Platform/Spark SIN facturación.
  totpEnabled: false,
  consentVersion: '2026-10-23.1',
  // No hay herramientas de analítica/publicidad identificadas ni instaladas por este cambio.
  // Añadir integraciones mediante privacy.js, nunca con scripts incondicionales.
  optionalCategories: { maps: true }
};
