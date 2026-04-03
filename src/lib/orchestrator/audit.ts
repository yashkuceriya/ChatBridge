/**
 * Audit logger for K-12 compliance (FERPA).
 * Logs all tool calls, data disclosures, and policy events.
 * Persisted to PostgreSQL for compliance and teacher review.
 */

import { db, schema } from "@/lib/db";

export interface AuditEntry {
  eventType:
    | "tool_call_requested"
    | "tool_call_executed"
    | "tool_call_failed"
    | "app_state_update"
    | "app_completed"
    | "app_error"
    | "moderation_flagged"
    | "policy_denied"
    | "data_disclosed"
    | "auth_event";
  conversationId?: string;
  appSessionId?: string;
  userId: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

/**
 * Log an audit event to the database.
 * Non-blocking: fires and forgets so it never slows down the request.
 */
export function logAudit(entry: Omit<AuditEntry, "timestamp">): void {
  const fullEntry: AuditEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  // Console log in dev for visibility
  if (process.env.NODE_ENV !== "production") {
    console.log(`[AUDIT] ${fullEntry.eventType}`, JSON.stringify(fullEntry.payload));
  }

  // Write to database (fire-and-forget — don't block the request)
  db.insert(schema.auditLog)
    .values({
      eventType: fullEntry.eventType,
      userId: fullEntry.userId,
      conversationId: fullEntry.conversationId || null,
      appSessionId: fullEntry.appSessionId || null,
      payload: fullEntry.payload,
    })
    .then(() => {
      // Successfully persisted
    })
    .catch((err) => {
      // Log DB errors but never fail the request
      console.error("[AUDIT] Failed to persist audit entry:", err.message);
    });
}

/**
 * Query audit log from database.
 * Used by teacher dashboard and admin tools.
 */
export async function getAuditLog(filters?: {
  conversationId?: string;
  userId?: string;
  eventType?: string;
  limit?: number;
}): Promise<AuditEntry[]> {
  try {
    const rows = await db
      .select()
      .from(schema.auditLog)
      .orderBy(schema.auditLog.timestamp)
      .limit(filters?.limit || 100);

    return rows
      .filter((r) => !filters?.conversationId || r.conversationId === filters.conversationId)
      .filter((r) => !filters?.userId || r.userId === filters.userId)
      .filter((r) => !filters?.eventType || r.eventType === filters.eventType)
      .map((r) => ({
        eventType: r.eventType as AuditEntry["eventType"],
        conversationId: r.conversationId || undefined,
        appSessionId: r.appSessionId || undefined,
        userId: r.userId,
        payload: r.payload as Record<string, unknown>,
        timestamp: r.timestamp.toISOString(),
      }));
  } catch (err) {
    console.error("[AUDIT] Failed to query audit log:", err);
    return [];
  }
}
