import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { runLoad, summarize } from './load.mjs';

test('client percentile uses ordered observations and includes failed responses', () => {
  const samples = Array.from({ length: 20 }, (_, i) => ({ durationMs: 20 - i, ok: i !== 0 }));
  const result = summarize(samples, 10);
  assert.equal(result.p95Ms, 19);
  assert.equal(result.requestsPerSecond, 2);
  assert.equal(result.errorPercent, 5);
  assert.equal(summarize([], 0).p95Ms, null);
});

test('load validates the response body, not only HTTP 200, and propagates trace context', async () => {
  let requestCount = 0;
  const server = createServer((req, res) => {
    assert.match(req.headers.traceparent, /^00-[a-f0-9]{32}-[a-f0-9]{16}-(00|01)$/);
    res.setHeader('Content-Type', 'application/json');
    requestCount++;
    res.end(JSON.stringify(requestCount % 2 ? { data: [{}], meta: { total: 1 } } : { data: [], meta: { total: 0 } }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const result = await runLoad({ url: `http://127.0.0.1:${server.address().port}`, users: 2, durationSeconds: 0.15, pauseMs: 10, signal: new AbortController().signal });
    assert.equal(result.requests, requestCount);
    assert.ok(result.errors > 0 && result.errors < result.requests);
    assert.ok(result.samples.some(s => s.failure === 'unexpected_response'));
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('an already cancelled experiment sends no requests', async () => {
  const result = await runLoad({ url: 'http://127.0.0.1:1', users: 3, durationSeconds: 1, pauseMs: 0, signal: AbortSignal.abort() });
  assert.equal(result.requests, 0);
});
