import { describe, it, expect, vi } from 'vitest';
import { CircuitBreaker, CircuitBreakerOpenError } from '../../src/services/clima/CircuitBreaker';

describe('CircuitBreaker', () => {
  it('inicia en estado CLOSED y permite llamadas exitosas', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 });
    expect(cb.getState()).toBe('CLOSED');

    const result = await cb.execute(async () => 'OK');
    expect(result).toBe('OK');
    expect(cb.getState()).toBe('CLOSED');
  });

  it('permanece CLOSED ante fallos por debajo del umbral', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 });

    await expect(cb.execute(async () => { throw new Error('Fallo 1'); })).rejects.toThrow('Fallo 1');
    expect(cb.getState()).toBe('CLOSED');

    await expect(cb.execute(async () => { throw new Error('Fallo 2'); })).rejects.toThrow('Fallo 2');
    expect(cb.getState()).toBe('CLOSED');

    // Un éxito resetea los fallos consecutivos
    await cb.execute(async () => 'OK');
    expect(cb.getState()).toBe('CLOSED');
  });

  it('hace transición a OPEN al alcanzar el umbral de fallos consecutivos', async () => {
    const onStateChange = vi.fn();
    const cb = new CircuitBreaker({ failureThreshold: 3, onStateChange });

    await expect(cb.execute(async () => { throw new Error('Fallo 1'); })).rejects.toThrow();
    await expect(cb.execute(async () => { throw new Error('Fallo 2'); })).rejects.toThrow();
    await expect(cb.execute(async () => { throw new Error('Fallo 3'); })).rejects.toThrow();

    expect(cb.getState()).toBe('OPEN');
    expect(onStateChange).toHaveBeenCalledWith('CLOSED', 'OPEN');

    // Bloquea llamadas inmediatamente en OPEN sin ejecutar la función
    const action = vi.fn();
    await expect(cb.execute(action)).rejects.toThrow(CircuitBreakerOpenError);
    expect(action).not.toHaveBeenCalled();
  });

  it('pasa a HALF_OPEN una vez transcurrido el tiempo de cooldown', async () => {
    vi.useFakeTimers();
    try {
      const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 5000 });

      await expect(cb.execute(async () => { throw new Error('Fallo 1'); })).rejects.toThrow();
      await expect(cb.execute(async () => { throw new Error('Fallo 2'); })).rejects.toThrow();
      expect(cb.getState()).toBe('OPEN');

      // Avanzamos 4.9 segundos: sigue OPEN
      vi.advanceTimersByTime(4900);
      expect(cb.getState()).toBe('OPEN');

      // Avanzamos 200ms adicionales: supera los 5000ms -> HALF_OPEN
      vi.advanceTimersByTime(200);
      expect(cb.getState()).toBe('HALF_OPEN');
    } finally {
      vi.useRealTimers();
    }
  });

  it('en HALF_OPEN si la prueba falla vuelve inmediatamente a OPEN', async () => {
    vi.useFakeTimers();
    try {
      const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 1000 });

      await expect(cb.execute(async () => { throw new Error('1'); })).rejects.toThrow();
      await expect(cb.execute(async () => { throw new Error('2'); })).rejects.toThrow();
      expect(cb.getState()).toBe('OPEN');

      vi.advanceTimersByTime(1100);
      expect(cb.getState()).toBe('HALF_OPEN');

      // Prueba en HALF_OPEN falla
      await expect(cb.execute(async () => { throw new Error('Fallo sonda'); })).rejects.toThrow('Fallo sonda');
      expect(cb.getState()).toBe('OPEN');
    } finally {
      vi.useRealTimers();
    }
  });

  it('en HALF_OPEN se cierra tras una llamada exitosa de prueba', async () => {
    vi.useFakeTimers();
    try {
      const cb = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 1000,
      });

      await expect(cb.execute(async () => { throw new Error('1'); })).rejects.toThrow();
      await expect(cb.execute(async () => { throw new Error('2'); })).rejects.toThrow();
      expect(cb.getState()).toBe('OPEN');

      vi.advanceTimersByTime(1100);
      expect(cb.getState()).toBe('HALF_OPEN');

      // Éxito de prueba: Opossum restablece el circuito a CLOSED
      await cb.execute(async () => 'OK');
      expect(cb.getState()).toBe('CLOSED');
    } finally {
      vi.useRealTimers();
    }
  });

  it('expone métricas y estadísticas operativas precisas (getStats y getMetrics)', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 5000,
      name: 'StatsTestBreaker',
    });

    // 1. Estado inicial
    const initialStats = cb.getStats();
    expect(initialStats.state).toBe('CLOSED');
    expect(initialStats.consecutiveFailures).toBe(0);
    expect(initialStats.lastFailureTime).toBe(0);
    expect(initialStats.failureThreshold).toBe(2);
    expect(initialStats.resetTimeoutMs).toBe(5000);
    expect(initialStats.opossumStats.successes).toBe(0);
    expect(initialStats.opossumStats.failures).toBe(0);

    // 2. Fallo 1: el circuito permanece CLOSED
    const beforeFail = Date.now();
    await expect(cb.execute(async () => { throw new Error('fallo 1'); })).rejects.toThrow('fallo 1');
    const stats1 = cb.getStats();
    expect(stats1.state).toBe('CLOSED');
    expect(stats1.consecutiveFailures).toBe(1);
    expect(stats1.lastFailureTime).toBeGreaterThanOrEqual(beforeFail);
    expect(stats1.opossumStats.failures).toBe(1);

    // 3. Fallo 2: alcanza failureThreshold (2) -> se abre (OPEN)
    await expect(cb.execute(async () => { throw new Error('fallo 2'); })).rejects.toThrow('fallo 2');
    const statsOpen = cb.getStats();
    expect(statsOpen.state).toBe('OPEN');
    expect(statsOpen.consecutiveFailures).toBe(2);
    expect(statsOpen.opossumStats.failures).toBe(2);

    // 4. Petición bloqueada mientras está OPEN incrementa rechazos en Opossum
    await expect(cb.execute(async () => 'bloqueado')).rejects.toThrow(CircuitBreakerOpenError);
    expect(cb.getStats().opossumStats.rejects).toBe(1);

    // 5. Reset manual restablece fallos consecutivos y devuelve a CLOSED
    cb.reset();
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getMetrics().consecutiveFailures).toBe(0);

    // 6. Éxito incrementa contador de successes
    await cb.execute(async () => 'success');
    expect(cb.getMetrics().consecutiveFailures).toBe(0);
    expect(cb.getStats().opossumStats.successes).toBe(1);

    cb.shutdown();
  });
});
