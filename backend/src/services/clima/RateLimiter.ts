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
 * Limitador de tasa por usuario utilizando buckets acotados con expulsión LRU
 * para prevenir fugas de memoria (memory leaks).
 */
export class UserRateLimiter {
  private readonly buckets = new Map<string, { limiter: TokenBucketRateLimiter; lastAccess: number }>();
  private readonly options: RateLimiterOptions;
  private readonly maxBuckets: number;

  constructor(
    options: RateLimiterOptions = { tokensPerInterval: 30, intervalMs: 60000, maxTokens: 30 },
    maxBuckets = 1000,
  ) {
    this.options = options;
    this.maxBuckets = maxBuckets;
  }

  public check(userId: string): boolean {
    const now = Date.now();
    this.pruneStaleBuckets(now);

    let entry = this.buckets.get(userId);
    if (!entry) {
      // Si se alcanza la capacidad máxima, expulsar el bucket más antiguo (FIFO / LRU)
      if (this.buckets.size >= this.maxBuckets) {
        const oldestKey = this.buckets.keys().next().value;
        if (oldestKey) this.buckets.delete(oldestKey);
      }
      entry = {
        limiter: new TokenBucketRateLimiter(this.options),
        lastAccess: now,
      };
      this.buckets.set(userId, entry);
    } else {
      entry.lastAccess = now;
    }

    return entry.limiter.tryConsume(1);
  }

  /**
   * Expulsa buckets que no registran actividad desde hace más del doble del intervalo.
   */
  private pruneStaleBuckets(now: number): void {
    const maxIdleMs = this.options.intervalMs * 2;
    for (const [userId, entry] of this.buckets.entries()) {
      if (now - entry.lastAccess > maxIdleMs) {
        this.buckets.delete(userId);
      }
    }
  }

  public size(): number {
    return this.buckets.size;
  }

  public reset(): void {
    this.buckets.clear();
  }
}
