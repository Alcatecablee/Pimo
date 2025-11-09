import { Router, Request, Response } from "express";
import { db } from "../db";
import { webhooks, webhookDeliveries } from "../../shared/schema";
import { WebhookService } from "../utils/webhook-service";
import { eq, desc, sql } from "drizzle-orm";
import crypto from "crypto";
import { logger } from "../utils/logger";

const router = Router();

/**
 * GET /api/admin/webhooks
 * Get all webhooks for the authenticated user
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userWebhooks = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.userId, userId))
      .orderBy(desc(webhooks.createdAt));

    res.json({
      webhooks: userWebhooks.map((w) => ({
        ...w,
        events: w.events as string[],
        headers: w.headers as Record<string, string> | undefined,
        active: w.active === 1,
      })),
      total: userWebhooks.length,
    });
  } catch (error) {
    logger.error({
      message: "Failed to fetch webhooks",
      context: { error: error instanceof Error ? error.message : String(error) },
    });
    res.status(500).json({ error: "Failed to fetch webhooks" });
  }
});

/**
 * POST /api/admin/webhooks
 * Create a new webhook
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { name, url, secret, events, description, headers, retryCount } = req.body;

    if (!name || !url || !events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        error: "Missing required fields: name, url, and events are required",
      });
    }

    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    const generatedSecret = secret || crypto.randomBytes(32).toString("hex");

    const [newWebhook] = await db
      .insert(webhooks)
      .values({
        name,
        url,
        secret: generatedSecret,
        events: events as any,
        active: 1,
        userId,
        description,
        headers: headers as any,
        retryCount: retryCount || 3,
      })
      .returning();

    logger.info({
      message: "Webhook created",
      context: { webhookId: newWebhook.id, userId, name },
    });

    res.status(201).json({
      ...newWebhook,
      events: newWebhook.events as string[],
      headers: newWebhook.headers as Record<string, string> | undefined,
      active: newWebhook.active === 1,
    });
  } catch (error) {
    logger.error({
      message: "Failed to create webhook",
      context: { error: error instanceof Error ? error.message : String(error) },
    });
    res.status(500).json({ error: "Failed to create webhook" });
  }
});

/**
 * GET /api/admin/webhooks/:id
 * Get a specific webhook
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [webhook] = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, id))
      .limit(1);

    if (!webhook) {
      return res.status(404).json({ error: "Webhook not found" });
    }

    if (webhook.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const stats = await WebhookService.getDeliveryStats(id);

    res.json({
      ...webhook,
      events: webhook.events as string[],
      headers: webhook.headers as Record<string, string> | undefined,
      active: webhook.active === 1,
      stats,
    });
  } catch (error) {
    logger.error({
      message: "Failed to fetch webhook",
      context: { error: error instanceof Error ? error.message : String(error) },
    });
    res.status(500).json({ error: "Failed to fetch webhook" });
  }
});

/**
 * PATCH /api/admin/webhooks/:id
 * Update a webhook
 */
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub;
    const { id } = req.params;
    const { name, url, secret, events, active, description, headers, retryCount } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [existingWebhook] = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, id))
      .limit(1);

    if (!existingWebhook) {
      return res.status(404).json({ error: "Webhook not found" });
    }

    if (existingWebhook.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (url) {
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: "Invalid URL format" });
      }
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (url !== undefined) updateData.url = url;
    if (secret !== undefined) updateData.secret = secret;
    if (events !== undefined) updateData.events = events as any;
    if (active !== undefined) updateData.active = active ? 1 : 0;
    if (description !== undefined) updateData.description = description;
    if (headers !== undefined) updateData.headers = headers as any;
    if (retryCount !== undefined) updateData.retryCount = retryCount;

    const [updatedWebhook] = await db
      .update(webhooks)
      .set(updateData)
      .where(eq(webhooks.id, id))
      .returning();

    logger.info({
      message: "Webhook updated",
      context: { webhookId: id, userId },
    });

    res.json({
      ...updatedWebhook,
      events: updatedWebhook.events as string[],
      headers: updatedWebhook.headers as Record<string, string> | undefined,
      active: updatedWebhook.active === 1,
    });
  } catch (error) {
    logger.error({
      message: "Failed to update webhook",
      context: { error: error instanceof Error ? error.message : String(error) },
    });
    res.status(500).json({ error: "Failed to update webhook" });
  }
});

/**
 * DELETE /api/admin/webhooks/:id
 * Delete a webhook
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [webhook] = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, id))
      .limit(1);

    if (!webhook) {
      return res.status(404).json({ error: "Webhook not found" });
    }

    if (webhook.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await db.delete(webhooks).where(eq(webhooks.id, id));

    logger.info({
      message: "Webhook deleted",
      context: { webhookId: id, userId },
    });

    res.status(204).send();
  } catch (error) {
    logger.error({
      message: "Failed to delete webhook",
      context: { error: error instanceof Error ? error.message : String(error) },
    });
    res.status(500).json({ error: "Failed to delete webhook" });
  }
});

/**
 * POST /api/admin/webhooks/:id/test
 * Test a webhook delivery
 */
router.post("/:id/test", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [webhook] = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, id))
      .limit(1);

    if (!webhook) {
      return res.status(404).json({ error: "Webhook not found" });
    }

    if (webhook.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const result = await WebhookService.testWebhook(id);

    res.json(result);
  } catch (error) {
    logger.error({
      message: "Failed to test webhook",
      context: { error: error instanceof Error ? error.message : String(error) },
    });
    res.status(500).json({ error: "Failed to test webhook" });
  }
});

/**
 * GET /api/admin/webhooks/:id/deliveries
 * Get delivery history for a webhook
 */
router.get("/:id/deliveries", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub;
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [webhook] = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, id))
      .limit(1);

    if (!webhook) {
      return res.status(404).json({ error: "Webhook not found" });
    }

    if (webhook.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const deliveries = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, id))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, id));

    const total = countResult?.count || 0;
    const successful = deliveries.filter((d) => d.success === 1).length;
    const successRate = deliveries.length > 0 ? (successful / deliveries.length) * 100 : 0;

    res.json({
      deliveries: deliveries.map((d) => ({
        ...d,
        success: d.success === 1,
        payload: d.payload as any,
        responseHeaders: d.responseHeaders as Record<string, string> | undefined,
      })),
      total,
      successRate: Math.round(successRate * 100) / 100,
    });
  } catch (error) {
    logger.error({
      message: "Failed to fetch webhook deliveries",
      context: { error: error instanceof Error ? error.message : String(error) },
    });
    res.status(500).json({ error: "Failed to fetch webhook deliveries" });
  }
});

export default router;
