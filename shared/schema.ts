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
