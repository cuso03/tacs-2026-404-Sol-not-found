import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../src/app';

describe('CORS — allowlist de origenes', () => {
  const ORIGINAL = process.env.CORS_ORIGINS;
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.CORS_ORIGINS = 'http://localhost:5173,https://app.solnotfound.app';
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = ORIGINAL;
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  it('refleja el origen cuando esta en la allowlist', async () => {
    const app = createApp();

    const response = await request(app).get('/openapi.json').set('Origin', 'https://app.solnotfound.app');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('https://app.solnotfound.app');
  });

  it('no devuelve Access-Control-Allow-Origin para un origen no permitido', async () => {
    const app = createApp();

    const response = await request(app).get('/openapi.json').set('Origin', 'https://sitio-malicioso.example');

    // La respuesta llega, pero sin el header: el navegador la bloquea.
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('el preflight solo acepta los metodos y headers permitidos', async () => {
    const app = createApp();

    const response = await request(app)
      .options('/api/actividades')
      .set('Origin', 'https://app.solnotfound.app')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Authorization');

    expect(response.status).toBeLessThan(300);
    expect(response.headers['access-control-allow-origin']).toBe('https://app.solnotfound.app');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(response.headers['access-control-allow-headers']).toContain('Authorization');
  });

  it('sin CORS_ORIGINS configurado solo se permite el origen de Vite en local', async () => {
    delete process.env.CORS_ORIGINS;
    const app = createApp();

    const permitido = await request(app).get('/openapi.json').set('Origin', 'http://localhost:5173');
    const rechazado = await request(app).get('/openapi.json').set('Origin', 'https://otro.example');

    expect(permitido.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(rechazado.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('Documentacion — habilitada por entorno', () => {
  const ORIGINAL = process.env.ENABLE_SWAGGER;
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.ENABLE_SWAGGER;
    else process.env.ENABLE_SWAGGER = ORIGINAL;
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  it('sirve /openapi.json y /api-docs cuando no se restringe', async () => {
    delete process.env.ENABLE_SWAGGER;
    process.env.NODE_ENV = 'test';
    const app = createApp();

    expect((await request(app).get('/openapi.json')).status).toBe(200);
    expect((await request(app).get('/api-docs/')).status).toBe(200);
  });

  it('ENABLE_SWAGGER=false apaga la documentacion aunque no sea produccion', async () => {
    process.env.ENABLE_SWAGGER = 'false';
    process.env.NODE_ENV = 'test';
    const app = createApp();

    expect((await request(app).get('/openapi.json')).status).toBe(404);
    expect((await request(app).get('/api-docs/')).status).toBe(404);
  });

  it('en produccion queda apagada salvo que se habilite explicitamente', async () => {
    delete process.env.ENABLE_SWAGGER;
    process.env.NODE_ENV = 'production';
    const app = createApp();

    expect((await request(app).get('/openapi.json')).status).toBe(404);

    process.env.ENABLE_SWAGGER = 'true';
    const appConDocs = createApp();
    expect((await request(appConDocs).get('/openapi.json')).status).toBe(200);
  });
});
