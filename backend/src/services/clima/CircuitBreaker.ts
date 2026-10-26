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

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private lastFailureTime = 0;
  private nextAttemptTime = 0;

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenSuccessThreshold: number;
  private readonly name: string;
  private readonly onStateChange?: (from: CircuitState, to: CircuitState) => void;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30000;
    this.halfOpenSuccessThreshold = options.halfOpenSuccessThreshold ?? 2;
    this.name = options.name ?? 'LegacyWeatherCircuitBreaker';
    this.onStateChange = options.onStateChange;
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
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  public recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.consecutiveSuccesses++;
      if (this.consecutiveSuccesses >= this.halfOpenSuccessThreshold) {
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
      // Si falla en HALF_OPEN vuelve inmediatamente a OPEN
      this.transitionTo('OPEN');
    } else if (this.state === 'CLOSED' && this.consecutiveFailures >= this.failureThreshold) {
      this.transitionTo('OPEN');
    }
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

  public getMetrics() {
    return {
      name: this.name,
      state: this.getState(),
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  /** Permite forzar estado (utilizado en testing) */
  public reset(): void {
    this.transitionTo('CLOSED');
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = 0;
    this.nextAttemptTime = 0;
  }
}
