// ============================================
// ChatBridge Core Type Definitions
// ============================================

// --- Plugin / App Registry Types ---

export interface AppManifest {
  appId: string;
  name: string;
  version: string;
  description: string;
  ui: {
    entrypointUrl: string;
    sandboxProfile: string; // e.g. "allow-scripts"
  };
  tools: ToolDefinition[];
  permissions: string[];
  auth: "none" | "api_key" | "oauth2";
  reviewStatus: "unreviewed" | "reviewed" | "approved";
  icon?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
  returns?: Record<string, unknown>;
}

// --- Conversation / Message Types ---

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  appContext?: AppContext;
  createdAt: Date;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: "pending" | "executing" | "completed" | "failed";
  appId: string;
}

// --- App Session Types ---

export interface AppSession {
  id: string;
  conversationId: string;
  appId: string;
  status: "initializing" | "active" | "backgrounded" | "completed" | "error" | "timed_out";
  sharedContext: Record<string, unknown>;
  capabilityToken: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppContext {
  appId: string;
  sessionId: string;
  sharedContext: Record<string, unknown>;
  status: AppSession["status"];
}

// --- PostMessage Protocol Types ---

export type AppToHostMessage =
  | { type: "APP_READY"; payload: { version: string; capabilities: string[] } }
  | { type: "APP_STATE_UPDATE"; payload: { appSessionId: string; state: Record<string, unknown> } }
  | { type: "APP_COMPLETE"; payload: { appSessionId: string; result: Record<string, unknown> } }
  | { type: "APP_ERROR"; payload: { appSessionId: string; error: string; code: string } };

export type HostToAppMessage =
  | { type: "SESSION_INIT"; payload: { appSessionId: string; capabilityToken: string; config: Record<string, unknown> } }
  | { type: "TOOL_INVOKE"; payload: { toolName: string; args: Record<string, unknown>; capabilityToken: string } }
  | { type: "SESSION_END"; payload: { reason: string } };

// --- Audit Log Types ---

export interface AuditEvent {
  id: string;
  conversationId: string;
  appSessionId?: string;
  eventType: string;
  payload: Record<string, unknown>;
  userId: string;
  timestamp: Date;
}

// --- Auth Types ---

export interface OAuthToken {
  id: string;
  userId: string;
  appId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scope: string;
}

// --- Policy Types ---

export interface TeacherPolicy {
  userId: string;
  classId: string;
  enabledApps: string[];
  restrictions: Record<string, unknown>;
}
