// Database schema for Replit Auth and VideoHub
// Reference: blueprint:javascript_log_in_with_replit, blueprint:javascript_database
import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
} from "drizzle-orm/pg-core";

// Session storage table
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Application logs table for centralized error logging and debugging
export const logs = pgTable(
  "logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
    level: varchar("level", { length: 20 }).notNull(), // info, warn, error, fatal
    message: text("message").notNull(),
    context: jsonb("context"), // Additional context data (user, endpoint, error stack, etc.)
    requestId: varchar("request_id"), // Unique request identifier for tracing
    userId: varchar("user_id"), // User who triggered the log (if applicable)
    endpoint: varchar("endpoint"), // API endpoint that generated the log
    statusCode: integer("status_code"), // HTTP status code (if applicable)
    errorStack: text("error_stack"), // Full error stack trace for errors
  },
  (table) => [
    index("IDX_logs_timestamp").on(table.timestamp),
    index("IDX_logs_level").on(table.level),
    index("IDX_logs_request_id").on(table.requestId),
    index("IDX_logs_user_id").on(table.userId),
  ],
);

export type InsertLog = typeof logs.$inferInsert;
export type Log = typeof logs.$inferSelect;

// Webhooks table for managing external integrations
export const webhooks = pgTable(
  "webhooks",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 255 }).notNull(),
    url: text("url").notNull(),
    secret: varchar("secret", { length: 255 }), // Optional HMAC secret for signing payloads
    events: jsonb("events").notNull(), // Array of event types to trigger this webhook
    active: integer("active").notNull().default(1), // 1 = active, 0 = inactive
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }), // Webhook owner
    description: text("description"),
    headers: jsonb("headers"), // Optional custom headers
    retryCount: integer("retry_count").default(3), // Number of retries for failed deliveries
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("IDX_webhooks_user_id").on(table.userId),
    index("IDX_webhooks_active").on(table.active),
  ],
);

export type InsertWebhook = typeof webhooks.$inferInsert;
export type Webhook = typeof webhooks.$inferSelect;

// Webhook deliveries table for tracking webhook executions
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    webhookId: varchar("webhook_id").references(() => webhooks.id, { onDelete: "cascade" }).notNull(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    payload: jsonb("payload").notNull(),
    responseStatus: integer("response_status"),
    responseBody: text("response_body"),
    responseHeaders: jsonb("response_headers"),
    duration: integer("duration"), // Milliseconds
    success: integer("success").notNull(), // 1 = success, 0 = failed
    attempt: integer("attempt").default(1).notNull(),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("IDX_webhook_deliveries_webhook_id").on(table.webhookId),
    index("IDX_webhook_deliveries_event_type").on(table.eventType),
    index("IDX_webhook_deliveries_created_at").on(table.createdAt),
    index("IDX_webhook_deliveries_success").on(table.success),
  ],
);

export type InsertWebhookDelivery = typeof webhookDeliveries.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
