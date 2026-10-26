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

  it('en HALF_OPEN se cierra tras alcanzar el umbral de éxitos requerido', async () => {
    vi.useFakeTimers();
    try {
      const cb = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 1000,
        halfOpenSuccessThreshold: 2,
      });

      await expect(cb.execute(async () => { throw new Error('1'); })).rejects.toThrow();
      await expect(cb.execute(async () => { throw new Error('2'); })).rejects.toThrow();
      expect(cb.getState()).toBe('OPEN');

      vi.advanceTimersByTime(1100);
      expect(cb.getState()).toBe('HALF_OPEN');

      // Primer éxito: aún en HALF_OPEN
      await cb.execute(async () => 'OK 1');
      expect(cb.getState()).toBe('HALF_OPEN');

      // Segundo éxito: pasa a CLOSED
      await cb.execute(async () => 'OK 2');
      expect(cb.getState()).toBe('CLOSED');
    } finally {
      vi.useRealTimers();
    }
  });
});
