import { FastifyRequest, FastifyReply } from 'fastify';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Simple in-memory rate limiter.
 * In production with multiple instances, use Redis or similar.
 */
class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs = 60000, maxRequests = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Cleanup old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if request should be rate limited.
   * Returns remaining requests or -1 if limited.
   */
  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    let entry = this.limits.get(key);

    // Create new entry or reset expired one
    if (!entry || now >= entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + this.windowMs,
      };
      this.limits.set(key, entry);
    }

    entry.count++;

    if (entry.count > this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
      };
    }

    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits) {
      if (now >= entry.resetAt) {
        this.limits.delete(key);
      }
    }
  }
}

// Global rate limiter instance
// 600 requests/minute is generous for a local dashboard app with many panels and prefetching
const rateLimiter = new RateLimiter(60000, 600);

/**
 * Rate limiting middleware.
 * Limits requests based on IP address.
 */
export async function rateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Get client IP (handle proxies)
  const ip = request.headers['x-forwarded-for'] as string || request.ip || 'unknown';
  const clientIp = ip.split(',')[0].trim();

  const result = rateLimiter.check(clientIp);

  // Add rate limit headers
  reply.header('X-RateLimit-Limit', '600');
  reply.header('X-RateLimit-Remaining', String(Math.max(0, result.remaining)));
  reply.header('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    reply.header('Retry-After', String(retryAfter));
    reply.status(429).send({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      retryAfter,
    });
    return;
  }
}

/**
 * Stricter rate limiter for sensitive endpoints (connection testing, sync triggers).
 */
const strictRateLimiter = new RateLimiter(60000, 10); // 10 requests per minute

export async function strictRateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const ip = request.headers['x-forwarded-for'] as string || request.ip || 'unknown';
  const clientIp = ip.split(',')[0].trim();

  const result = strictRateLimiter.check(`strict:${clientIp}`);

  reply.header('X-RateLimit-Limit', '10');
  reply.header('X-RateLimit-Remaining', String(Math.max(0, result.remaining)));
  reply.header('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    reply.header('Retry-After', String(retryAfter));
    reply.status(429).send({
      error: 'Too Many Requests',
      message: `Rate limit exceeded for this endpoint. Try again in ${retryAfter} seconds.`,
      retryAfter,
    });
    return;
  }
}
