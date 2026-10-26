export interface RateLimiterOptions {
  tokensPerInterval: number; // Cantidad de tokens generados por intervalo
  intervalMs: number;        // Tamaño del intervalo en milisegundos
  maxTokens?: number;        // Capacidad máxima acumulable
}

export class RateLimitExceededError extends Error {
  constructor(message = 'Límite de peticiones excedido (Rate limit)') {
    super(message);
    this.name = 'RateLimitExceededError';
  }
}

/**
 * Limitador Token Bucket para controlar caudal saliente (upstream) y por usuario.
 */
export class TokenBucketRateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly tokensPerInterval: number;
  private readonly intervalMs: number;
  private lastRefillTimestamp: number;

  constructor(options: RateLimiterOptions) {
    this.tokensPerInterval = options.tokensPerInterval;
    this.intervalMs = options.intervalMs;
    this.maxTokens = options.maxTokens ?? options.tokensPerInterval;
    this.tokens = this.maxTokens;
    this.lastRefillTimestamp = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsedTime = now - this.lastRefillTimestamp;
    if (elapsedTime <= 0) return;

    const tokensToAdd = (elapsedTime / this.intervalMs) * this.tokensPerInterval;
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefillTimestamp = now;
  }

  public tryConsume(tokens = 1): boolean {
    this.refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }

  /**
   * Espera hasta que haya un token disponible o lanza timeout si supera maxWaitMs.
   */
  public async acquire(tokens = 1, maxWaitMs = 5000): Promise<void> {
    const start = Date.now();
    while (!this.tryConsume(tokens)) {
      if (Date.now() - start >= maxWaitMs) {
        throw new RateLimitExceededError('Tiempo de espera para adquirir token de rate limit agotado');
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  public getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }
}

/**
 * Limitador de tasa por usuario utilizando buckets independientes en memoria.
 */
export class UserRateLimiter {
  private readonly buckets = new Map<string, TokenBucketRateLimiter>();
  private readonly options: RateLimiterOptions;

  constructor(options: RateLimiterOptions = { tokensPerInterval: 30, intervalMs: 60000, maxTokens: 30 }) {
    this.options = options;
  }

  public check(userId: string): boolean {
    let bucket = this.buckets.get(userId);
    if (!bucket) {
      bucket = new TokenBucketRateLimiter(this.options);
      this.buckets.set(userId, bucket);
    }
    return bucket.tryConsume(1);
  }

  public reset(): void {
    this.buckets.clear();
  }
}
