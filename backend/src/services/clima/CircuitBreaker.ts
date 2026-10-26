import OpossumBreaker from 'opossum';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number;     // Cantidad de fallos consecutivos para abrir el circuito (default 5)
  resetTimeoutMs?: number;       // Tiempo que permanece OPEN antes de pasar a HALF_OPEN (default 30000ms)
  halfOpenSuccessThreshold?: number; // Éxitos necesarios en HALF_OPEN para volver a CLOSED (default 2)
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
 * Expone compatibilidad total con máquina de estados y métricas operativas.
 */
export class CircuitBreaker {
  public readonly opossum: OpossumBreaker;
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private lastFailureTime = 0;
  private nextAttemptTime = 0;

  public readonly failureThreshold: number;
  public readonly resetTimeoutMs: number;
  public readonly halfOpenSuccessThreshold: number;
  public readonly name: string;
  private readonly onStateChange?: (from: CircuitState, to: CircuitState) => void;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30000;
    this.halfOpenSuccessThreshold = options.halfOpenSuccessThreshold ?? 2;
    this.name = options.name ?? 'LegacyWeatherCircuitBreaker';
    this.onStateChange = options.onStateChange;

    this.opossum = new OpossumBreaker(async <T>(action: () => Promise<T>): Promise<T> => action(), {
      name: this.name,
      resetTimeout: this.resetTimeoutMs,
      volumeThreshold: this.failureThreshold,
      errorThresholdPercentage: 1,
      rollingCountTimeout: 60000,
      timeout: false,
    });
  }

  public getState(): CircuitState {
    if (this.state === 'OPEN' && Date.now() >= this.nextAttemptTime) {
      this.transitionTo('HALF_OPEN');
    }
    return this.state;
  }

  public async execute<T>(action: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      throw new CircuitBreakerOpenError();
    }

    try {
      const result = await action();
      this.recordSuccess();
      return result;
    } catch (error: any) {
      this.recordFailure();
      throw error;
    }
  }

  public recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.consecutiveSuccesses++;
      if (this.consecutiveSuccesses >= this.halfOpenSuccessThreshold) {
        this.opossum.close();
        this.transitionTo('CLOSED');
      }
    } else if (this.state === 'CLOSED') {
      this.consecutiveFailures = 0;
    }
  }

  public recordFailure(): void {
    this.lastFailureTime = Date.now();
    this.consecutiveFailures++;

    if (this.state === 'HALF_OPEN') {
      this.opossum.open();
      this.transitionTo('OPEN');
    } else if (this.state === 'CLOSED' && this.consecutiveFailures >= this.failureThreshold) {
      this.opossum.open();
      this.transitionTo('OPEN');
    }
  }

  public trip(): void {
    this.opossum.open();
    this.transitionTo('OPEN');
  }

  public reset(): void {
    this.opossum.close();
    this.transitionTo('CLOSED');
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    if (oldState === newState) return;

    this.state = newState;
    if (newState === 'OPEN') {
      this.nextAttemptTime = Date.now() + this.resetTimeoutMs;
      this.consecutiveSuccesses = 0;
    } else if (newState === 'HALF_OPEN') {
      this.consecutiveSuccesses = 0;
    } else if (newState === 'CLOSED') {
      this.consecutiveFailures = 0;
      this.consecutiveSuccesses = 0;
    }

    if (this.onStateChange) {
      this.onStateChange(oldState, newState);
    }
  }

  public getStats() {
    return {
      state: this.getState(),
      consecutiveFailures: this.consecutiveFailures,
      lastFailureTime: this.lastFailureTime,
      failureThreshold: this.failureThreshold,
      resetTimeoutMs: this.resetTimeoutMs,
      opossumStats: this.opossum.stats,
    };
  }

  public shutdown(): void {
    this.opossum.shutdown();
  }
}
