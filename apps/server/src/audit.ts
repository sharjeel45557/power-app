import type { User } from "@power-app/core";
import type { Db } from "./db/client.js";
import { auditLog, type AuditEntry } from "./db/schema.js";

export interface AuditInput {
  action: string;
  entity: string;
  entityId?: string | null;
  summary?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Writes an audit record. Failures are swallowed (logged) so auditing can never
 * break the primary operation — but every mutation path should call this.
 * Never pass PHI in `summary`/`metadata`.
 */
export async function writeAudit(
  db: Db,
  actor: User | null,
  input: AuditInput,
  onError?: (err: unknown) => void,
): Promise<void> {
  const entry: AuditEntry = {
    actorEmail: actor?.email ?? null,
    actorId: actor?.id ?? null,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    summary: input.summary ?? null,
    metadata: input.metadata ?? null,
  };
  try {
    await db.insert(auditLog).values(entry);
  } catch (err) {
    onError?.(err);
  }
}
