import Bottleneck from 'bottleneck';
import { LRUCache } from 'lru-cache';

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
 * Limitador Token Bucket implementado sobre Bottleneck (estándar industrial de rate limiting).
 */
export class TokenBucketRateLimiter {
  public readonly bottleneck: Bottleneck;
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

    const minTime = Math.max(0, Math.floor(this.intervalMs / this.tokensPerInterval));
    this.bottleneck = new Bottleneck({
      minTime,
      reservoir: this.maxTokens,
      reservoirRefreshAmount: this.tokensPerInterval,
      reservoirRefreshInterval: this.intervalMs,
      maxConcurrent: this.maxTokens,
    });
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
 * Limitador de tasa por usuario implementado con LRUCache y Bottleneck
 * para garantizar desalojo estricto (LRU/TTL) y prevenir fugas de memoria.
 */
export class UserRateLimiter {
  private readonly buckets: LRUCache<string, { limiter: TokenBucketRateLimiter; lastAccess: number }>;
  private readonly options: RateLimiterOptions;

  constructor(
    options: RateLimiterOptions = { tokensPerInterval: 30, intervalMs: 60000, maxTokens: 30 },
    maxBuckets = 1000,
  ) {
    this.options = options;
    this.buckets = new LRUCache<string, { limiter: TokenBucketRateLimiter; lastAccess: number }>({
      max: maxBuckets,
      ttl: options.intervalMs * 2,
    });
  }

  public check(userId: string): boolean {
    const now = Date.now();
    this.pruneStaleBuckets(now);

    let entry = this.buckets.get(userId);
    if (!entry) {
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

  private pruneStaleBuckets(now: number): void {
    const maxIdleMs = this.options.intervalMs * 2;
    for (const [userId, entry] of this.buckets.entries()) {
      if (now - entry.lastAccess > maxIdleMs) {
        this.buckets.delete(userId);
      }
    }
  }

  public size(): number {
    this.pruneStaleBuckets(Date.now());
    return this.buckets.size;
  }

  public reset(): void {
    this.buckets.clear();
  }
}
