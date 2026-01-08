import { FastifyInstance } from 'fastify';
import { statsRoutes } from './routes/stats.js';
import { mediaRoutes } from './routes/media.js';
import { settingsRoutes } from './routes/settings.js';
import { healthRoutes } from './routes/health.js';
import { connectionRoutes } from './routes/connections.js';
import { exportRoutes } from './routes/export.js';
import { discordRoutes } from './routes/discord.js';

export async function registerRoutes(fastify: FastifyInstance) {
  // Health check
  await fastify.register(healthRoutes, { prefix: '/api/health' });

  // Connection management routes
  await fastify.register(connectionRoutes, { prefix: '/api/connections' });

  // Stats routes
  await fastify.register(statsRoutes, { prefix: '/api/stats' });

  // Media routes
  await fastify.register(mediaRoutes, { prefix: '/api/media' });

  // Settings routes
  await fastify.register(settingsRoutes, { prefix: '/api/settings' });

  // Export routes (CSV/JSON downloads)
  await fastify.register(exportRoutes, { prefix: '/api/export' });

  // Discord webhook management routes
  await fastify.register(discordRoutes, { prefix: '/api/discord' });
}
