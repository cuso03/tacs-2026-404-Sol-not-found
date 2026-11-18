// Vite incluye estos valores en el navegador; no deben contener secretos.
const required = [
  'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_PAGES_PROJECT', 'VITE_API_URL',
  'VITE_AUTH0_DOMAIN', 'VITE_AUTH0_CLIENT_ID', 'VITE_AUTH0_AUDIENCE',
];
const errors = required.filter((key) => !process.env[key]?.trim()).map((key) => `Falta ${key}`);
if (!/^[a-f0-9]{32}$/i.test(process.env.CLOUDFLARE_ACCOUNT_ID ?? '')) errors.push('Account ID inválido');
if (!/^[a-z0-9][a-z0-9-]*$/.test(process.env.CLOUDFLARE_PAGES_PROJECT ?? '')) errors.push('Nombre Pages inválido');
try {
  const url = new URL(process.env.VITE_API_URL);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.hostname.endsWith('.localhost')) {
    errors.push('VITE_API_URL debe ser una API HTTPS pública sin credenciales ni parámetros');
  }
} catch {
  errors.push('VITE_API_URL debe ser una URL absoluta de la API; Pages no utiliza el proxy de Vite');
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('Configuración pública de Pages validada (sin imprimir valores).');
