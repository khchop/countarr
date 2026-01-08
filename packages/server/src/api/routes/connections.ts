import { FastifyInstance } from 'fastify';
import * as connectionService from '../../services/connections.js';
import type { ServiceType } from '../../services/connections.js';

interface CreateConnectionBody {
  name: string;
  type: ServiceType;
  url: string;
  apiKey: string;
  enabled?: boolean;
}

interface UpdateConnectionBody {
  name?: string;
  url?: string;
  apiKey?: string;
  enabled?: boolean;
}

interface TestConnectionBody {
  type: ServiceType;
  url: string;
  apiKey: string;
}

function safeParseInt(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function maskApiKey(apiKey: string | null | undefined): string {
  if (!apiKey || apiKey.length < 4) return '****';
  return apiKey.substring(0, Math.min(8, apiKey.length - 4)) + '...';
}

export async function connectionRoutes(fastify: FastifyInstance) {
  // List all connections
  fastify.get('/', async () => {
    const connections = await connectionService.getAllConnections();
    // Don't expose full API keys in list view
    return connections.map(conn => ({
      ...conn,
      apiKey: maskApiKey(conn.apiKey),
    }));
  });

  // Get connection types that are configured
  fastify.get('/types', async () => {
    const types = await connectionService.getConfiguredServiceTypes();
    return { types };
  });

  // Check if any connections exist (for setup flow)
  fastify.get('/status', async () => {
    const hasConnections = await connectionService.hasAnyConnections();
    const connections = await connectionService.getAllConnections();

    return {
      hasConnections,
      connectionCount: connections.length,
      enabledCount: connections.filter(c => c.enabled).length,
      byType: connections.reduce((acc, c) => {
        acc[c.type] = (acc[c.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  });

  // Get a single connection (with full details)
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const id = safeParseInt(request.params.id, 0);
    if (id <= 0) {
      return reply.status(400).send({ error: 'Invalid connection ID' });
    }

    const connection = await connectionService.getConnection(id);

    if (!connection) {
      return reply.status(404).send({ error: 'Connection not found' });
    }

    return {
      ...connection,
      apiKey: maskApiKey(connection.apiKey),
    };
  });

  // Create a new connection
  fastify.post<{ Body: CreateConnectionBody }>('/', async (request, reply) => {
    const { name, type, url, apiKey, enabled } = request.body;

    if (!name || !type || !url || !apiKey) {
      return reply.status(400).send({ error: 'Missing required fields: name, type, url, apiKey' });
    }

    const validTypes = ['radarr', 'sonarr', 'bazarr', 'prowlarr', 'jellyseerr', 'emby', 'jellyfin'];
    if (!validTypes.includes(type)) {
      return reply.status(400).send({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
    }

    try {
      const connection = await connectionService.createConnection({
        name,
        type,
        url,
        apiKey,
        enabled,
      });

      return {
        ...connection,
        apiKey: maskApiKey(connection.apiKey),
      };
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Failed to create connection' });
    }
  });

  // Update a connection
  fastify.patch<{ Params: { id: string }; Body: UpdateConnectionBody }>('/:id', async (request, reply) => {
    const id = safeParseInt(request.params.id, 0);
    if (id <= 0) {
      return reply.status(400).send({ error: 'Invalid connection ID' });
    }

    const updates = request.body;
    const connection = await connectionService.updateConnection(id, updates);

    if (!connection) {
      return reply.status(404).send({ error: 'Connection not found' });
    }

    return {
      ...connection,
      apiKey: maskApiKey(connection.apiKey),
    };
  });

  // Delete a connection
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const id = safeParseInt(request.params.id, 0);
    if (id <= 0) {
      return reply.status(400).send({ error: 'Invalid connection ID' });
    }

    const success = await connectionService.deleteConnection(id);

    if (!success) {
      return reply.status(404).send({ error: 'Connection not found' });
    }

    return { success: true };
  });

  // Test a specific connection
  fastify.post<{ Params: { id: string } }>('/:id/test', async (request, reply) => {
    const id = safeParseInt(request.params.id, 0);
    if (id <= 0) {
      return reply.status(400).send({ error: 'Invalid connection ID' });
    }

    const result = await connectionService.testExistingConnection(id);

    if (!result.success && result.error === 'Connection not found') {
      return reply.status(404).send({ error: 'Connection not found' });
    }

    return result;
  });

  // Test connection parameters (without saving)
  fastify.post<{ Body: TestConnectionBody }>('/test', async (request, reply) => {
    const { type, url, apiKey } = request.body;

    if (!type || !url || !apiKey) {
      return reply.status(400).send({ error: 'Missing required fields: type, url, apiKey' });
    }

    const result = await connectionService.testConnection(type, url, apiKey);
    return result;
  });

  // Test all connections
  fastify.post('/test-all', async () => {
    const results = await connectionService.testAllConnections();
    return { results };
  });
}
