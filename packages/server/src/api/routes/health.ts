import { FastifyInstance } from 'fastify';
import { scheduler } from '../../scheduler/index.js';
import { db } from '../../db/index.js';
import { sql } from 'drizzle-orm';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    // Check database
    let dbStatus = 'ok';
    try {
      await db.run(sql`SELECT 1`);
    } catch {
      dbStatus = 'error';
    }

    const schedulerStatus = await scheduler.getStatus();

    return {
      status: dbStatus === 'ok' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      scheduler: schedulerStatus.isRunning ? 'running' : 'stopped',
      configuredApps: schedulerStatus.configuredServices,
    };
  });
}
