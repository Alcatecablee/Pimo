import crypto from "crypto";
import { db } from "../db";
import { webhooks, webhookDeliveries, type Webhook } from "../../shared/schema";
import { WebhookPayload, type WebhookConfig } from "../../shared/api";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Webhook service for triggering and managing webhooks
 * 
 * Usage example:
 * ```typescript
 * // When a video is deleted
 * await WebhookService.triggerEvent('video.deleted', { videoId: '123', title: 'My Video' }, userId);
 * 
 * // When a folder is created
 * await WebhookService.triggerEvent('folder.created', { folderId: 'abc', name: 'New Folder' }, userId);
 * ```
 * 
 * IMPORTANT: Always pass the userId to ensure tenant isolation and prevent data leaks
 */
export class WebhookService {
  /**
   * Trigger all active webhooks for a specific event and user
   * 
   * @param eventType - The webhook event type (e.g., 'video.deleted', 'folder.created')
   * @param data - The payload data to send in the webhook
   * @param userId - The user ID who owns the webhooks (REQUIRED for tenant isolation)
   */
  static async triggerEvent(eventType: string, data: any, userId: string): Promise<void> {
    try {
      const activeWebhooks = await db
        .select()
        .from(webhooks)
        .where(and(eq(webhooks.active, 1), eq(webhooks.userId, userId)));

      const matchingWebhooks = activeWebhooks.filter((webhook) => {
        const events = webhook.events as string[];
        return events.includes(eventType);
      });

      logger.info({
        message: `Triggering ${matchingWebhooks.length} webhooks for event: ${eventType}`,
        context: { eventType, webhookCount: matchingWebhooks.length },
      });

      const deliveryPromises = matchingWebhooks.map((webhook) =>
        this.deliverWebhook(webhook, eventType, data)
      );

      await Promise.allSettled(deliveryPromises);
    } catch (error) {
      logger.error({
        message: "Failed to trigger webhooks",
        context: { eventType, error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  /**
   * Deliver a single webhook with retry logic
   */
  private static async deliverWebhook(
    webhook: Webhook,
    eventType: string,
    data: any,
    attempt: number = 1
  ): Promise<void> {
    const startTime = Date.now();
    const payload: WebhookPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data,
      webhookId: webhook.id,
    };

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "VideoHub-Webhook/1.0",
        "X-Webhook-Event": eventType,
        "X-Webhook-Delivery-ID": crypto.randomUUID(),
        ...(webhook.headers as Record<string, string> | null | undefined) || {},
      };

      if (webhook.secret) {
        const signature = this.generateSignature(payload, webhook.secret);
        headers["X-Webhook-Signature"] = signature;
      }

      const response = await fetch(webhook.url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      });

      const duration = Date.now() - startTime;
      const responseBody = await response.text().catch(() => "");
      const success = response.ok;

      await db.insert(webhookDeliveries).values({
        webhookId: webhook.id,
        eventType,
        payload: payload as any,
        responseStatus: response.status,
        responseBody: responseBody.slice(0, 5000),
        responseHeaders: Object.fromEntries(response.headers.entries()),
        duration,
        success: success ? 1 : 0,
        attempt,
        error: success ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      });

      if (!success && attempt < (webhook.retryCount || 3)) {
        logger.warn({
          message: `Webhook delivery failed, retrying (${attempt}/${webhook.retryCount || 3})`,
          context: { webhookId: webhook.id, eventType, attempt },
        });

        setTimeout(() => {
          this.deliverWebhook(webhook, eventType, data, attempt + 1);
        }, Math.pow(2, attempt) * 1000);
      }

      logger.info({
        message: `Webhook delivered successfully`,
        context: {
          webhookId: webhook.id,
          eventType,
          status: response.status,
          duration,
          attempt,
        },
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      await db.insert(webhookDeliveries).values({
        webhookId: webhook.id,
        eventType,
        payload: payload as any,
        duration,
        success: 0,
        attempt,
        error: errorMessage.slice(0, 5000),
      });

      if (attempt < (webhook.retryCount || 3)) {
        logger.warn({
          message: `Webhook delivery error, retrying (${attempt}/${webhook.retryCount || 3})`,
          context: { webhookId: webhook.id, eventType, attempt, error: errorMessage },
        });

        setTimeout(() => {
          this.deliverWebhook(webhook, eventType, data, attempt + 1);
        }, Math.pow(2, attempt) * 1000);
      } else {
        logger.error({
          message: "Webhook delivery failed after all retries",
          context: { webhookId: webhook.id, eventType, error: errorMessage },
        });
      }
    }
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private static generateSignature(payload: any, secret: string): string {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest("hex")}`;
  }

  /**
   * Test a webhook delivery
   */
  static async testWebhook(webhookId: string): Promise<{ success: boolean; message: string }> {
    try {
      const webhook = await db
        .select()
        .from(webhooks)
        .where(eq(webhooks.id, webhookId))
        .limit(1);

      if (!webhook[0]) {
        return { success: false, message: "Webhook not found" };
      }

      await this.deliverWebhook(webhook[0], "webhook.test", {
        message: "This is a test webhook delivery",
        timestamp: new Date().toISOString(),
      });

      return { success: true, message: "Test webhook delivered successfully" };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Test webhook delivery failed",
      };
    }
  }

  /**
   * Get webhook delivery statistics
   */
  static async getDeliveryStats(webhookId: string): Promise<{
    total: number;
    successful: number;
    failed: number;
    successRate: number;
    avgDuration: number;
  }> {
    const deliveries = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, webhookId))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(1000);

    const total = deliveries.length;
    const successful = deliveries.filter((d) => d.success === 1).length;
    const failed = total - successful;
    const successRate = total > 0 ? (successful / total) * 100 : 0;
    const avgDuration =
      deliveries.reduce((sum, d) => sum + (d.duration || 0), 0) / (total || 1);

    return {
      total,
      successful,
      failed,
      successRate: Math.round(successRate * 100) / 100,
      avgDuration: Math.round(avgDuration),
    };
  }
}

export default WebhookService;
