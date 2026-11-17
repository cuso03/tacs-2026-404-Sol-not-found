import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

export async function startBrowserServer({ root, port, backendUrl, collectorUrl, host = '127.0.0.1' }) {
  const requireFrontend = createRequire(path.join(root, 'frontend/package.json'));
  const { createServer } = await import(pathToFileURL(requireFrontend.resolve('vite')).href);
  const { default: react } = await import(pathToFileURL(requireFrontend.resolve('@vitejs/plugin-react')).href);
  const server = await createServer({
    root: path.join(root, 'frontend'), configFile: false,
    // Do not invalidate/share the running app's dependency optimization cache.
    cacheDir: path.join(root, 'frontend/node_modules/.vite-observability'),
    optimizeDeps: { entries: [path.join(root, 'frontend/tests/observability/browser.tsx')] },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify('/api'),
      'import.meta.env.VITE_OTEL_ENABLED': JSON.stringify('true'),
      'import.meta.env.VITE_OTEL_SERVICE_NAME': JSON.stringify('sol-frontend-pruebas'),
      'import.meta.env.VITE_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT': JSON.stringify('/otel/v1/traces'),
    },
    plugins: [react(), {
      name: 'isolated-observability-page',
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          if (req.url?.split('?')[0] !== '/__observability.html') return next();
          try {
            const html = await vite.transformIndexHtml(req.url, '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Prueba de búsqueda</title></head><body><div id="root"></div><script type="module" src="/tests/observability/browser.tsx"></script></body></html>');
            res.setHeader('Content-Type', 'text/html'); res.end(html);
          } catch (error) { next(error); }
        });
      },
    }],
    server: {
      host, port, strictPort: true,
      proxy: {
        '/api': { target: backendUrl, changeOrigin: true },
        '/otel': {
          target: collectorUrl, changeOrigin: true, rewrite: p => p.replace(/^\/otel/, ''),
          // Same-origin local proxy: no cross-origin browser request is forwarded.
          configure(proxy) { proxy.on('proxyReq', request => request.removeHeader('origin')); },
        },
      },
    },
  });
  await server.listen();
  return server;
}

export async function probeBrowser({ browser, url, name, directory, fail = false }) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const traceIds = new Set();
  const errors = [];
  const networkErrors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', req => networkErrors.push({ path: new URL(req.url()).pathname, error: req.failure()?.errorText }));
  page.on('response', response => {
    if (response.status() >= 500) networkErrors.push({ path: new URL(response.url()).pathname, status: response.status() });
  });
  const headerReads = [];
  page.on('request', req => {
    if (new URL(req.url()).pathname === '/api/actividades') {
      headerReads.push(req.allHeaders().then(headers => {
        const id = headers.traceparent?.split('-')[1];
        if (id) traceIds.add(id);
      }).catch(() => {}));
    }
  });
  if (fail) await page.route('**/api/actividades?*', async route => {
    // A real invalid request reaches the real backend; no mocked response.
    const target = new URL(route.request().url()); target.searchParams.set('limit', '0');
    await route.continue({ url: target.href });
  });
  const started = performance.now();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.getByRole('heading', { name: 'Buscar actividades', exact: true }).waitFor();
    if (fail) {
      await page.getByText('No pudimos cargar las actividades', { exact: true }).waitFor({ timeout: 30_000 });
      await page.getByRole('button', { name: 'Reintentar', exact: true }).waitFor();
    } else {
      await page.getByText('Observabilidad 00000', { exact: true }).waitFor({ timeout: 30_000 });
      await page.getByLabel('Tipo', { exact: true }).selectOption('aire_libre');
      // Wait for the filtered count in the DOM, not only an HTTP response.
      await page.waitForFunction(() => {
        const links = [...document.querySelectorAll('a')].filter(a => a.textContent.includes('Ver actividad'));
        const summary = document.querySelector('#activity-list-title')?.parentElement?.textContent ?? '';
        return links.length > 0 && !summary.includes('Actualizando') && document.querySelector('#type-filter')?.value === 'aire_libre';
      });
      const response = page.waitForResponse(r => {
        const u = new URL(r.url()); return u.pathname === '/api/actividades' && u.searchParams.get('ubicacion') === 'Cordoba';
      }, { timeout: 30_000 });
      const filterStart = performance.now();
      await page.getByLabel('Ubicación', { exact: true }).fill('Cordoba');
      const result = await response;
      assert.equal(result.status(), 200);
      const body = await result.json();
      assert.ok(body.data.length > 0);
      const expected = body.data[0].titulo;
      await page.getByText(expected, { exact: true }).waitFor();
      await page.waitForFunction(total => document.querySelector('#activity-list-title')?.parentElement?.textContent.includes(`${total} actividades con cupos`), body.meta.total);
      page.__filterDuration = performance.now() - filterStart;
    }
    const readyMs = performance.now() - started;
    const screenshot = `${name}.png`;
    await page.screenshot({ path: path.join(directory, screenshot), fullPage: true });
    assert.equal(errors.length, 0, `Errores de JavaScript: ${errors.join('; ')}`);
    await Promise.all(headerReads);
    assert.ok(traceIds.size > 0, 'El navegador no propagó traceparent');
    // BatchSpanProcessor exports every 5 s. Keep the page alive for the batch.
    await page.waitForTimeout(6000);
    return { name, ok: true, expectedFailure: fail, readyMs, filterToDomMs: page.__filterDuration ?? null, traceIds: [...traceIds], screenshot };
  } catch (error) {
    await page.screenshot({ path: path.join(directory, `${name}-failure.png`), fullPage: true }).catch(() => {});
    return { name, ok: false, expectedFailure: fail, error: error.message, javascriptErrors: errors, networkErrors, traceIds: [...traceIds], screenshot: `${name}-failure.png` };
  } finally { await page.close(); }
}
