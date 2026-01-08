import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';

/**
 * Authentication middleware for API routes.
 * When STATSARR_API_KEY is set, requires X-Api-Key header or ?apiKey query param.
 * Health check endpoint is always allowed without authentication.
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip auth if no API key is configured
  if (!config.apiKey) {
    return;
  }

  // Always allow health check without auth
  if (request.url.startsWith('/api/health')) {
    return;
  }

  // Check for API key in header or query string
  const headerKey = request.headers['x-api-key'] as string | undefined;
  const queryKey = (request.query as Record<string, string>)?.apiKey;
  const providedKey = headerKey || queryKey;

  if (!providedKey) {
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'API key required. Provide via X-Api-Key header or ?apiKey query parameter.',
    });
    return;
  }

  // Constant-time comparison to prevent timing attacks
  if (!secureCompare(providedKey, config.apiKey)) {
    reply.status(403).send({
      error: 'Forbidden',
      message: 'Invalid API key.',
    });
    return;
  }
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do comparison to maintain constant time
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i % b.length);
    }
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Register authentication hook on a Fastify instance.
 */
export function registerAuth(fastify: FastifyInstance): void {
  if (config.apiKey) {
    console.log('[Auth] API key authentication enabled');
    fastify.addHook('preHandler', authMiddleware);
  } else {
    console.log('[Auth] WARNING: No API key configured - API is open to all requests');
    console.log('[Auth] Set STATSARR_API_KEY environment variable to enable authentication');
  }
}
