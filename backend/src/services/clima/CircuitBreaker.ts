import OpossumBreaker from 'opossum';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number;     // Cantidad de fallos para abrir el circuito (default 5)
  resetTimeoutMs?: number;       // Tiempo de cooldown antes de pasar a HALF_OPEN (default 30000ms)
  halfOpenSuccessThreshold?: number; // Retrocompatibilidad
  name?: string;
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

export class CircuitBreakerOpenError extends Error {
  constructor(message = 'Circuit breaker está OPEN: peticiones bloqueadas hacia el servicio legacy') {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Circuit Breaker impulsado por la librería estándar Opossum (Red Hat).
 * Delega en Opossum el control de volumen, fallos, transiciones y métricas nativas.
 */
export class CircuitBreaker {
  public readonly breaker: OpossumBreaker;
  private lastFailureTime = 0;
  private consecutiveFailures = 0;
  private currentState: CircuitState = 'CLOSED';

  constructor(options: CircuitBreakerOptions = {}) {
    const failureThreshold = options.failureThreshold ?? 5;
    const resetTimeout = options.resetTimeoutMs ?? 30000;
    const name = options.name ?? 'LegacyWeatherCircuitBreaker';

    this.breaker = new OpossumBreaker(async <T>(action: () => Promise<T>): Promise<T> => action(), {
      name,
      resetTimeout,
      volumeThreshold: failureThreshold,
      errorThresholdPercentage: 1, // abre tan pronto como se alcanza el volumen de fallos
      rollingCountTimeout: 60000,
      timeout: false,
    });

    this.breaker.on('failure', () => {
      this.consecutiveFailures++;
      this.lastFailureTime = Date.now();
    });

    this.breaker.on('success', () => {
      this.consecutiveFailures = 0;
    });

    this.breaker.on('open', () => {
      this.lastFailureTime = Date.now();
      const prev = this.currentState;
      this.currentState = 'OPEN';
      options.onStateChange?.(prev, 'OPEN');
    });

    this.breaker.on('halfOpen', () => {
      const prev = this.currentState;
      this.currentState = 'HALF_OPEN';
      options.onStateChange?.(prev, 'HALF_OPEN');
    });

    this.breaker.on('close', () => {
      this.consecutiveFailures = 0;
      const prev = this.currentState;
      this.currentState = 'CLOSED';
      options.onStateChange?.(prev, 'CLOSED');
    });
  }

  public get failureThreshold(): number {
    return (this.breaker as any).volumeThreshold;
  }
  public set failureThreshold(val: number) {
    (this.breaker as any).options.volumeThreshold = val;
    const sym = Object.getOwnPropertySymbols(this.breaker).find((s) => s.description === 'volume-threshold');
    if (sym) {
      (this.breaker as any)[sym] = val;
    }
  }

  public get resetTimeoutMs(): number {
    return (this.breaker as any).options.resetTimeout;
  }
  public set resetTimeoutMs(val: number) {
    (this.breaker as any).options.resetTimeout = val;
  }

  public getState(): CircuitState {
    if (this.breaker.halfOpen) return 'HALF_OPEN';
    if (this.breaker.opened) return 'OPEN';
    return 'CLOSED';
  }

  public async execute<T>(action: () => Promise<T>): Promise<T> {
    try {
      return (await this.breaker.fire(action)) as T;
    } catch (error: any) {
      if (error?.code === 'EOPENBREAKER') {
        throw new CircuitBreakerOpenError();
      }
      this.lastFailureTime = Date.now();
      throw error;
    }
  }

  public trip(): void {
    this.breaker.open();
  }

  public reset(): void {
    this.breaker.close();
  }

  public getStats() {
    return {
      state: this.getState(),
      consecutiveFailures: this.consecutiveFailures,
      lastFailureTime: this.lastFailureTime,
      failureThreshold: this.failureThreshold,
      resetTimeoutMs: this.resetTimeoutMs,
      opossumStats: this.breaker.stats,
    };
  }

  public getMetrics() {
    return {
      state: this.getState(),
      consecutiveFailures: this.consecutiveFailures,
      lastFailureTime: this.lastFailureTime,
    };
  }

  public shutdown(): void {
    this.breaker.shutdown();
  }
}
