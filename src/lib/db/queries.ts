import { eq, desc, asc } from "drizzle-orm";
import { db } from "./index";
import { conversations, messages, auditLog } from "./schema";

// --- Conversations ---

export async function createConversation(userId: string, title?: string) {
  const [conversation] = await db
    .insert(conversations)
    .values({
      userId,
      title: title ?? "New Chat",
    })
    .returning();
  return conversation;
}

export async function getConversations(userId: string) {
  return db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt));
}

export async function getConversation(id: string) {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id));
  return conversation ?? null;
}

export async function updateConversationTitle(id: string, title: string) {
  const [updated] = await db
    .update(conversations)
    .set({ title, updatedAt: new Date() })
    .where(eq(conversations.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteConversation(id: string) {
  // Delete messages first due to foreign key constraint
  await db.delete(messages).where(eq(messages.conversationId, id));
  const [deleted] = await db
    .delete(conversations)
    .where(eq(conversations.id, id))
    .returning();
  return deleted ?? null;
}

// --- Messages ---

export async function addMessage(
  conversationId: string,
  role: string,
  content: string,
  toolCalls?: unknown,
  appContext?: unknown
) {
  const [message] = await db
    .insert(messages)
    .values({
      conversationId,
      role,
      content,
      toolCalls: toolCalls ?? null,
      appContext: appContext ?? null,
    })
    .returning();

  // Touch the conversation's updatedAt
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  return message;
}

export async function getMessages(conversationId: string) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));
}

// --- Audit Log ---

export async function logAuditEvent(event: {
  conversationId?: string;
  appSessionId?: string;
  eventType: string;
  payload: unknown;
  userId: string;
}) {
  const [entry] = await db
    .insert(auditLog)
    .values({
      conversationId: event.conversationId ?? null,
      appSessionId: event.appSessionId ?? null,
      eventType: event.eventType,
      payload: event.payload,
      userId: event.userId,
    })
    .returning();
  return entry;
}
