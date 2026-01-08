import { FastifyInstance } from 'fastify';
import { db, schema } from '../../db/index.js';
import { eq } from 'drizzle-orm';
import type { NewDiscordWebhook, NewDiscordScheduleEntry } from '../../db/schema.js';

interface CreateWebhookBody {
  name: string;
  webhookUrl: string;
  enabled?: boolean;
  sendDaily?: boolean;
  sendWeekly?: boolean;
  sendMonthly?: boolean;
  sendYearly?: boolean;
  includeMovies?: boolean;
  includeTVShows?: boolean;
  includeSubtitles?: boolean;
  includePlayback?: boolean;
  includeIndexers?: boolean;
  includeReleaseGroups?: boolean;
  includeGenres?: boolean;
  includeQuirkyStats?: boolean;
  mentionRoleId?: string;
  mentionUserId?: string;
  mentionOnlyYearly?: boolean;
}

interface UpdateWebhookBody extends Partial<CreateWebhookBody> {
  id: number;
}

interface UpdateScheduleBody {
  id: string; // 'daily' | 'weekly' | 'monthly' | 'yearly'
  enabled?: boolean;
  hour?: number;
  minute?: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  month?: number;
}

// Validate Discord webhook URL format
function isValidWebhookUrl(url: string): boolean {
  return /^https:\/\/discord(app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url);
}

export async function discordRoutes(fastify: FastifyInstance) {
  // ============================================
  // Webhook CRUD
  // ============================================

  // List all webhooks
  fastify.get('/webhooks', async () => {
    const webhooks = await db.query.discordWebhooks.findMany({
      orderBy: (webhooks, { desc }) => [desc(webhooks.createdAt)],
    });

    // Mask webhook URLs for security (show only last 8 chars)
    return webhooks.map(w => ({
      ...w,
      webhookUrl: w.webhookUrl.slice(0, 50) + '...' + w.webhookUrl.slice(-8),
    }));
  });

  // Get single webhook
  fastify.get('/webhooks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const webhook = await db.query.discordWebhooks.findFirst({
      where: eq(schema.discordWebhooks.id, parseInt(id, 10)),
    });

    if (!webhook) {
      return reply.status(404).send({ error: 'Webhook not found' });
    }

    return {
      ...webhook,
      webhookUrl: webhook.webhookUrl.slice(0, 50) + '...' + webhook.webhookUrl.slice(-8),
    };
  });

  // Create webhook
  fastify.post('/webhooks', async (request, reply) => {
    const body = request.body as CreateWebhookBody;

    if (!body.name || !body.webhookUrl) {
      return reply.status(400).send({ error: 'Name and webhookUrl are required' });
    }

    if (!isValidWebhookUrl(body.webhookUrl)) {
      return reply.status(400).send({ error: 'Invalid Discord webhook URL format' });
    }

    const now = new Date().toISOString();
    const newWebhook: NewDiscordWebhook = {
      name: body.name,
      webhookUrl: body.webhookUrl,
      enabled: body.enabled ?? true,
      sendDaily: body.sendDaily ?? true,
      sendWeekly: body.sendWeekly ?? true,
      sendMonthly: body.sendMonthly ?? true,
      sendYearly: body.sendYearly ?? true,
      includeMovies: body.includeMovies ?? true,
      includeTVShows: body.includeTVShows ?? true,
      includeSubtitles: body.includeSubtitles ?? true,
      includePlayback: body.includePlayback ?? true,
      includeIndexers: body.includeIndexers ?? true,
      includeReleaseGroups: body.includeReleaseGroups ?? true,
      includeGenres: body.includeGenres ?? true,
      includeQuirkyStats: body.includeQuirkyStats ?? true,
      mentionRoleId: body.mentionRoleId ?? null,
      mentionUserId: body.mentionUserId ?? null,
      mentionOnlyYearly: body.mentionOnlyYearly ?? false,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.insert(schema.discordWebhooks).values(newWebhook).returning();
    return result[0];
  });

  // Update webhook
  fastify.put('/webhooks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as UpdateWebhookBody;

    const existing = await db.query.discordWebhooks.findFirst({
      where: eq(schema.discordWebhooks.id, parseInt(id, 10)),
    });

    if (!existing) {
      return reply.status(404).send({ error: 'Webhook not found' });
    }

    if (body.webhookUrl && !isValidWebhookUrl(body.webhookUrl)) {
      return reply.status(400).send({ error: 'Invalid Discord webhook URL format' });
    }

    const updates: Partial<NewDiscordWebhook> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.name !== undefined) updates.name = body.name;
    if (body.webhookUrl !== undefined) updates.webhookUrl = body.webhookUrl;
    if (body.enabled !== undefined) updates.enabled = body.enabled;
    if (body.sendDaily !== undefined) updates.sendDaily = body.sendDaily;
    if (body.sendWeekly !== undefined) updates.sendWeekly = body.sendWeekly;
    if (body.sendMonthly !== undefined) updates.sendMonthly = body.sendMonthly;
    if (body.sendYearly !== undefined) updates.sendYearly = body.sendYearly;
    if (body.includeMovies !== undefined) updates.includeMovies = body.includeMovies;
    if (body.includeTVShows !== undefined) updates.includeTVShows = body.includeTVShows;
    if (body.includeSubtitles !== undefined) updates.includeSubtitles = body.includeSubtitles;
    if (body.includePlayback !== undefined) updates.includePlayback = body.includePlayback;
    if (body.includeIndexers !== undefined) updates.includeIndexers = body.includeIndexers;
    if (body.includeReleaseGroups !== undefined) updates.includeReleaseGroups = body.includeReleaseGroups;
    if (body.includeGenres !== undefined) updates.includeGenres = body.includeGenres;
    if (body.includeQuirkyStats !== undefined) updates.includeQuirkyStats = body.includeQuirkyStats;
    if (body.mentionRoleId !== undefined) updates.mentionRoleId = body.mentionRoleId;
    if (body.mentionUserId !== undefined) updates.mentionUserId = body.mentionUserId;
    if (body.mentionOnlyYearly !== undefined) updates.mentionOnlyYearly = body.mentionOnlyYearly;

    const result = await db
      .update(schema.discordWebhooks)
      .set(updates)
      .where(eq(schema.discordWebhooks.id, parseInt(id, 10)))
      .returning();

    return result[0];
  });

  // Delete webhook
  fastify.delete('/webhooks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await db.query.discordWebhooks.findFirst({
      where: eq(schema.discordWebhooks.id, parseInt(id, 10)),
    });

    if (!existing) {
      return reply.status(404).send({ error: 'Webhook not found' });
    }

    await db.delete(schema.discordWebhooks).where(eq(schema.discordWebhooks.id, parseInt(id, 10)));
    return { success: true };
  });

  // Test webhook
  fastify.post('/webhooks/:id/test', async (request, reply) => {
    const { id } = request.params as { id: string };

    const webhook = await db.query.discordWebhooks.findFirst({
      where: eq(schema.discordWebhooks.id, parseInt(id, 10)),
    });

    if (!webhook) {
      return reply.status(404).send({ error: 'Webhook not found' });
    }

    try {
      const response = await fetch(webhook.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: '🎉 Countarr Test Message',
            description: 'Your Discord webhook is working correctly!',
            color: 0x3498db, // Blue
            fields: [
              { name: 'Webhook Name', value: webhook.name, inline: true },
              { name: 'Status', value: '✅ Connected', inline: true },
            ],
            footer: { text: 'Countarr Statistics Dashboard' },
            timestamp: new Date().toISOString(),
          }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return reply.status(400).send({ 
          error: 'Discord API error', 
          details: errorText,
          status: response.status,
        });
      }

      return { success: true, message: 'Test message sent successfully' };
    } catch (error) {
      return reply.status(500).send({ 
        error: 'Failed to send test message',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ============================================
  // Schedule management
  // ============================================

  // Get all schedules
  fastify.get('/schedule', async () => {
    const schedules = await db.query.discordSchedule.findMany();

    // If no schedules exist, return defaults
    if (schedules.length === 0) {
      return [
        { id: 'daily', enabled: true, hour: 23, minute: 0, dayOfWeek: null, dayOfMonth: null, month: null },
        { id: 'weekly', enabled: true, hour: 12, minute: 0, dayOfWeek: 0, dayOfMonth: null, month: null },
        { id: 'monthly', enabled: true, hour: 12, minute: 0, dayOfWeek: null, dayOfMonth: 1, month: null },
        { id: 'yearly', enabled: true, hour: 12, minute: 0, dayOfWeek: null, dayOfMonth: 1, month: 1 },
      ];
    }

    return schedules;
  });

  // Update schedule
  fastify.put('/schedule/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as UpdateScheduleBody;

    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(id)) {
      return reply.status(400).send({ error: 'Invalid schedule ID. Must be: daily, weekly, monthly, or yearly' });
    }

    // Validate hour/minute
    if (body.hour !== undefined && (body.hour < 0 || body.hour > 23)) {
      return reply.status(400).send({ error: 'Hour must be between 0 and 23' });
    }
    if (body.minute !== undefined && (body.minute < 0 || body.minute > 59)) {
      return reply.status(400).send({ error: 'Minute must be between 0 and 59' });
    }
    if (body.dayOfWeek !== undefined && (body.dayOfWeek < 0 || body.dayOfWeek > 6)) {
      return reply.status(400).send({ error: 'Day of week must be between 0 (Sunday) and 6 (Saturday)' });
    }
    if (body.dayOfMonth !== undefined && (body.dayOfMonth < 1 || body.dayOfMonth > 31)) {
      return reply.status(400).send({ error: 'Day of month must be between 1 and 31' });
    }
    if (body.month !== undefined && (body.month < 1 || body.month > 12)) {
      return reply.status(400).send({ error: 'Month must be between 1 and 12' });
    }

    // Check if schedule exists
    const existing = await db.query.discordSchedule.findFirst({
      where: eq(schema.discordSchedule.id, id),
    });

    const scheduleData: NewDiscordScheduleEntry = {
      id,
      enabled: body.enabled ?? true,
      hour: body.hour ?? 12,
      minute: body.minute ?? 0,
      dayOfWeek: body.dayOfWeek ?? null,
      dayOfMonth: body.dayOfMonth ?? null,
      month: body.month ?? null,
    };

    if (existing) {
      const result = await db
        .update(schema.discordSchedule)
        .set(scheduleData)
        .where(eq(schema.discordSchedule.id, id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(schema.discordSchedule).values(scheduleData).returning();
      return result[0];
    }
  });

  // ============================================
  // Manual trigger endpoints
  // ============================================

  // Trigger daily summary now
  fastify.post('/trigger/daily', async (request, reply) => {
    // This will be implemented when we create the Discord notification service
    // For now, return a placeholder
    return { 
      success: true, 
      message: 'Daily summary triggered',
      note: 'Discord notification service not yet implemented',
    };
  });

  // Trigger weekly summary now
  fastify.post('/trigger/weekly', async (request, reply) => {
    return { 
      success: true, 
      message: 'Weekly summary triggered',
      note: 'Discord notification service not yet implemented',
    };
  });

  // Trigger monthly summary now
  fastify.post('/trigger/monthly', async (request, reply) => {
    return { 
      success: true, 
      message: 'Monthly summary triggered',
      note: 'Discord notification service not yet implemented',
    };
  });

  // Trigger yearly summary now
  fastify.post('/trigger/yearly', async (request, reply) => {
    return { 
      success: true, 
      message: 'Yearly summary triggered',
      note: 'Discord notification service not yet implemented',
    };
  });

  // ============================================
  // Preview endpoints (see what would be sent)
  // ============================================

  fastify.get('/preview/daily', async () => {
    // Return a preview of what the daily summary embed would look like
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const startDate = new Date(yesterday);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(yesterday);
    endDate.setHours(23, 59, 59, 999);

    return {
      type: 'daily',
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      note: 'Full preview will be available when Discord service is implemented',
    };
  });

  fastify.get('/preview/weekly', async () => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    return {
      type: 'weekly',
      period: {
        start: weekAgo.toISOString(),
        end: today.toISOString(),
      },
      note: 'Full preview will be available when Discord service is implemented',
    };
  });

  fastify.get('/preview/monthly', async () => {
    const today = new Date();
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    return {
      type: 'monthly',
      period: {
        start: monthAgo.toISOString(),
        end: today.toISOString(),
      },
      note: 'Full preview will be available when Discord service is implemented',
    };
  });

  fastify.get('/preview/yearly', async () => {
    const today = new Date();
    const yearAgo = new Date(today);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);

    return {
      type: 'yearly',
      period: {
        start: yearAgo.toISOString(),
        end: today.toISOString(),
      },
      note: 'Full preview will be available when Discord service is implemented',
    };
  });
}
