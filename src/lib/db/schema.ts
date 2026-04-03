import { pgTable, text, timestamp, jsonb, uuid, varchar, boolean } from "drizzle-orm/pg-core";

// --- Users ---
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  passwordHash: text("password_hash"),
  role: varchar("role", { length: 50 }).notNull().default("student"), // student | teacher | admin
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// --- Conversations ---
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: varchar("title", { length: 500 }).notNull().default("New Chat"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// --- Messages ---
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id),
  role: varchar("role", { length: 20 }).notNull(), // user | assistant | system | tool
  content: text("content").notNull(),
  toolCalls: jsonb("tool_calls"),
  toolCallId: varchar("tool_call_id", { length: 255 }),
  appContext: jsonb("app_context"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// --- App Registry ---
export const appRegistry = pgTable("app_registry", {
  appId: varchar("app_id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  version: varchar("version", { length: 50 }).notNull(),
  description: text("description").notNull(),
  manifest: jsonb("manifest").notNull(), // Full AppManifest JSON
  reviewStatus: varchar("review_status", { length: 50 }).notNull().default("unreviewed"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// --- App Sessions ---
export const appSessions = pgTable("app_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id),
  appId: varchar("app_id", { length: 255 }).notNull().references(() => appRegistry.appId),
  status: varchar("status", { length: 50 }).notNull().default("initializing"),
  sharedContext: jsonb("shared_context").notNull().default({}),
  capabilityToken: text("capability_token").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// --- Audit Log ---
// userId and sessionIds are varchar (not uuid) because audit entries can come
// from demo users, system processes, or other non-UUID identifiers
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: varchar("conversation_id", { length: 255 }),
  appSessionId: varchar("app_session_id", { length: 255 }),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  payload: jsonb("payload").notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// --- Tool Calls ---
export const toolCalls = pgTable("tool_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id),
  appSessionId: uuid("app_session_id"),
  toolName: varchar("tool_name", { length: 255 }).notNull(),
  appId: varchar("app_id", { length: 255 }).notNull(),
  args: jsonb("args").notNull(),
  result: jsonb("result"),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

// --- OAuth Tokens ---
export const oauthTokens = pgTable("oauth_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  appId: varchar("app_id", { length: 255 }).notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at").notNull(),
  scope: text("scope").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// --- Teacher Policies ---
export const teacherPolicies = pgTable("teacher_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  classId: varchar("class_id", { length: 255 }).notNull(),
  enabledApps: jsonb("enabled_apps").notNull().default([]),
  restrictions: jsonb("restrictions").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
