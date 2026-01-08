import { eq, and } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import {
  RadarrClient,
  SonarrClient,
  BazarrClient,
  ProwlarrClient,
  JellyseerrClient,
  EmbyClient,
} from '../clients/index.js';

export type ServiceType = 'radarr' | 'sonarr' | 'bazarr' | 'prowlarr' | 'jellyseerr' | 'emby' | 'jellyfin';

export interface ConnectionConfig {
  id: number;
  name: string;
  type: ServiceType;
  url: string;
  apiKey: string;
  enabled: boolean;
  isDefault: boolean;
}

export interface TestConnectionResult {
  success: boolean;
  error?: string;
  version?: string;
}

// Test connection without saving
export async function testConnection(
  type: ServiceType,
  url: string,
  apiKey: string
): Promise<TestConnectionResult> {
  try {
    const client = createClient(type, url, apiKey);
    if (!client) {
      return { success: false, error: 'Unknown service type' };
    }
    return await client.testConnection();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// Create the appropriate client for a service type
function createClient(type: ServiceType, url: string, apiKey: string) {
  const config = { baseUrl: url, apiKey };

  switch (type) {
    case 'radarr':
      return new RadarrClient(config);
    case 'sonarr':
      return new SonarrClient(config);
    case 'bazarr':
      return new BazarrClient(config);
    case 'prowlarr':
      return new ProwlarrClient(config);
    case 'jellyseerr':
      return new JellyseerrClient(config);
    case 'emby':
      return new EmbyClient({ ...config, isJellyfin: false });
    case 'jellyfin':
      return new EmbyClient({ ...config, isJellyfin: true });
    default:
      return null;
  }
}

// Get all connections
export async function getAllConnections(): Promise<schema.ServiceConnection[]> {
  return db.query.serviceConnections.findMany({
    orderBy: [schema.serviceConnections.type, schema.serviceConnections.name],
  });
}

// Get enabled connections
export async function getEnabledConnections(): Promise<schema.ServiceConnection[]> {
  return db.query.serviceConnections.findMany({
    where: eq(schema.serviceConnections.enabled, true),
    orderBy: [schema.serviceConnections.type, schema.serviceConnections.name],
  });
}

// Get connections by type
export async function getConnectionsByType(type: ServiceType): Promise<schema.ServiceConnection[]> {
  return db.query.serviceConnections.findMany({
    where: and(
      eq(schema.serviceConnections.type, type),
      eq(schema.serviceConnections.enabled, true)
    ),
  });
}

// Get a single connection
export async function getConnection(id: number): Promise<schema.ServiceConnection | undefined> {
  return db.query.serviceConnections.findFirst({
    where: eq(schema.serviceConnections.id, id),
  });
}

// Create a new connection
export async function createConnection(data: {
  name: string;
  type: ServiceType;
  url: string;
  apiKey: string;
  enabled?: boolean;
}): Promise<schema.ServiceConnection> {
  const now = new Date().toISOString();

  // Test the connection first
  const testResult = await testConnection(data.type, data.url, data.apiKey);

  // Check if this should be the default (first of its type)
  const existingOfType = await getConnectionsByType(data.type);
  const isDefault = existingOfType.length === 0;

  const result = await db.insert(schema.serviceConnections).values({
    name: data.name,
    type: data.type,
    url: data.url.replace(/\/$/, ''), // Remove trailing slash
    apiKey: data.apiKey,
    enabled: data.enabled ?? true,
    isDefault,
    lastTestAt: now,
    lastTestSuccess: testResult.success,
    lastTestError: testResult.error ?? null,
    createdAt: now,
    updatedAt: now,
  }).returning();

  return result[0];
}

// Update a connection
export async function updateConnection(
  id: number,
  data: Partial<{
    name: string;
    url: string;
    apiKey: string;
    enabled: boolean;
  }>
): Promise<schema.ServiceConnection | null> {
  const existing = await getConnection(id);
  if (!existing) return null;

  const now = new Date().toISOString();

  // If URL or API key changed, test the connection
  let testResult: TestConnectionResult | null = null;
  if (data.url || data.apiKey) {
    testResult = await testConnection(
      existing.type as ServiceType,
      data.url ?? existing.url,
      data.apiKey ?? existing.apiKey
    );
  }

  const updateData: Record<string, unknown> = {
    ...data,
    updatedAt: now,
  };

  if (data.url) {
    updateData.url = data.url.replace(/\/$/, '');
  }

  if (testResult) {
    updateData.lastTestAt = now;
    updateData.lastTestSuccess = testResult.success;
    updateData.lastTestError = testResult.error ?? null;
  }

  const result = await db.update(schema.serviceConnections)
    .set(updateData)
    .where(eq(schema.serviceConnections.id, id))
    .returning();

  return result[0] ?? null;
}

// Delete a connection
export async function deleteConnection(id: number): Promise<boolean> {
  const result = await db.delete(schema.serviceConnections)
    .where(eq(schema.serviceConnections.id, id))
    .returning();

  return result.length > 0;
}

// Test an existing connection and update its status
export async function testExistingConnection(id: number): Promise<TestConnectionResult> {
  const connection = await getConnection(id);
  if (!connection) {
    return { success: false, error: 'Connection not found' };
  }

  const result = await testConnection(
    connection.type as ServiceType,
    connection.url,
    connection.apiKey
  );

  const now = new Date().toISOString();
  await db.update(schema.serviceConnections)
    .set({
      lastTestAt: now,
      lastTestSuccess: result.success,
      lastTestError: result.error ?? null,
      updatedAt: now,
    })
    .where(eq(schema.serviceConnections.id, id));

  return result;
}

// Test all connections
export async function testAllConnections(): Promise<Record<number, TestConnectionResult>> {
  const connections = await getAllConnections();
  const results: Record<number, TestConnectionResult> = {};

  await Promise.all(
    connections.map(async (conn) => {
      results[conn.id] = await testExistingConnection(conn.id);
    })
  );

  return results;
}

// Get client for a connection
export function getClientForConnection(connection: schema.ServiceConnection) {
  return createClient(
    connection.type as ServiceType,
    connection.url,
    connection.apiKey
  );
}

// Check if any services are configured
export async function hasAnyConnections(): Promise<boolean> {
  const connections = await getAllConnections();
  return connections.length > 0;
}

// Get configured service types
export async function getConfiguredServiceTypes(): Promise<ServiceType[]> {
  const connections = await getEnabledConnections();
  const types = new Set<ServiceType>();
  for (const conn of connections) {
    types.add(conn.type as ServiceType);
  }
  return Array.from(types);
}
