import { describe, it, expect, vi } from 'vitest';
import { UserRateLimiter, TokenBucketRateLimiter } from '../../src/services/clima/RateLimiter';

describe('UserRateLimiter — Prevención de Memory Leaks', () => {
  it('limita la cantidad máxima de buckets activos en memoria (evicción FIFO/LRU)', () => {
    const limiter = new UserRateLimiter(
      { tokensPerInterval: 5, intervalMs: 1000, maxTokens: 5 },
      10, // max 10 buckets en memoria
    );

    // Creamos 25 usuarios distintos
    for (let i = 0; i < 25; i++) {
      limiter.check(`user-${i}`);
    }

    // El tamaño del mapa nunca puede superar maxBuckets (10)
    expect(limiter.size()).toBeLessThanOrEqual(10);
  });

  it('purga automáticamente buckets inactivos para liberar memoria', () => {
    vi.useFakeTimers();
    try {
      const intervalMs = 1000;
      const limiter = new UserRateLimiter(
        { tokensPerInterval: 5, intervalMs, maxTokens: 5 },
        100,
      );

      limiter.check('user-inactivo-1');
      limiter.check('user-inactivo-2');
      expect(limiter.size()).toBe(2);

      // Avanzamos el tiempo más allá del período de inactividad (2 * intervalMs)
      vi.advanceTimersByTime(2500);

      // La siguiente consulta dispara el prune
      limiter.check('user-activo-nuevo');

      // Los inactivos fueron eliminados del mapa
      expect(limiter.size()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
