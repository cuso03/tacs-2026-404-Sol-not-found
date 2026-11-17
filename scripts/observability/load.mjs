import { randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

export function summarize(samples, seconds) {
  const sorted = samples.map(s => s.durationMs).sort((a, b) => a - b);
  const percentile = p => sorted.length ? sorted[Math.ceil(p * sorted.length) - 1] : null;
  const errors = samples.filter(s => !s.ok).length;
  return {
    requests: samples.length, errors,
    errorPercent: samples.length ? errors / samples.length * 100 : null,
    requestsPerSecond: seconds ? samples.length / seconds : null,
    p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99),
  };
}

/** Closed workload: each user waits for a response, then pauses. */
export async function runLoad({ url, users, durationSeconds, pauseMs, signal, onProgress, onSample, requestTimeoutMs = 15_000 }) {
  const samples = [];
  const start = Date.now();
  const deadline = performance.now() + durationSeconds * 1000;
  const timer = setInterval(() => onProgress?.(samples.length), 5000);
  try {
    await Promise.all(Array.from({ length: users }, async (_, user) => {
      let iteration = 0;
      while (performance.now() < deadline && !signal.aborted) {
        const traceId = randomBytes(16).toString('hex');
        // Sample 1 in 10 load requests; UI requests remain fully sampled.
        const sampled = iteration++ % 10 === 0;
        const traceparent = `00-${traceId}-${randomBytes(8).toString('hex')}-${sampled ? '01' : '00'}`;
        const began = performance.now();
        const timestamp = new Date().toISOString();
        let status = 0, ok = false, failure = null;
        try {
          const response = await fetch(url, {
            headers: { traceparent },
            signal: AbortSignal.any([signal, AbortSignal.timeout(requestTimeoutMs)]),
          });
          status = response.status;
          if (status !== 200) {
            await response.text();
            failure = 'http_error';
          } else {
            const body = await response.json();
            ok = Array.isArray(body.data) && body.data.length > 0 && body.meta?.total > 0;
            if (!ok) failure = 'unexpected_response';
          }
        } catch (error) {
          failure = error.name === 'TimeoutError' ? 'timeout' : signal.aborted ? 'aborted' : error instanceof SyntaxError ? 'unexpected_response' : 'network_or_abort';
        }
        const sample = { timestamp, user, durationMs: performance.now() - began, status, ok, failure, traceId: sampled ? traceId : null };
        samples.push(sample);
        onSample?.(sample);
        const remaining = deadline - performance.now();
        if (remaining > 0 && !signal.aborted) await sleep(Math.min(pauseMs, remaining), undefined, { signal }).catch(() => {});
      }
    }));
  } finally {
    clearInterval(timer);
  }
  const end = Date.now();
  return { start, end, users, durationSeconds, elapsedSeconds: (end - start) / 1000, ...summarize(samples, (end - start) / 1000), samples };
}
