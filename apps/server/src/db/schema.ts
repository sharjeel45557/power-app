import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Append-only audit trail. Every data mutation and auth event is recorded here.
 * Designed for HIPAA-style accountability: who did what, to which record, when.
 * Never store PHI in `summary`/`metadata`.
 */
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  actorEmail: text("actor_email"),
  actorId: text("actor_id"),
  // create | update | delete | login | logout
  action: text("action").notNull(),
  // entity name (e.g. "requests") or "auth"
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  summary: text("summary"),
  metadata: jsonb("metadata"),
});

/**
 * Example line-of-business entity — a "Service Request". Demonstrates the four
 * v1 patterns: data-entry form, list/table, status workflow (Phase 2), and a
 * relational store that replaces SharePoint Lists.
 */
export const requests = pgTable("requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("submitted"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Request = typeof requests.$inferSelect;
export type NewRequest = typeof requests.$inferInsert;
export type AuditEntry = typeof auditLog.$inferInsert;
