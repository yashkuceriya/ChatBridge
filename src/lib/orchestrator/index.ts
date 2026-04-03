import { findAppByToolName, getActiveApps } from "@/lib/plugins/registry";
import type { AppManifest, ToolCall, ToolDefinition } from "@/types";

/**
 * Core orchestrator - the policy + routing + audit authority.
 * Model suggests, platform decides.
 */

export interface OrchestratorContext {
  conversationId: string;
  userId: string;
  enabledApps?: string[];
  activeSessions: Map<string, { appId: string; sharedContext: Record<string, unknown> }>;
}

/**
 * Get tool definitions to inject into LLM context.
 * Only injects tools from enabled + active apps (retrieval-based injection).
 */
export function getToolsForContext(ctx: OrchestratorContext): ToolDefinition[] {
  const apps = getActiveApps(ctx.enabledApps);
  const tools: ToolDefinition[] = [];

  for (const app of apps) {
    tools.push(...app.tools);
  }

  return tools;
}

/**
 * Convert our tool definitions to OpenAI function calling format.
 */
export function toOpenAITools(tools: ToolDefinition[]) {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

/**
 * Validate a proposed tool call against the registry.
 * Returns the app manifest if valid, null if rejected.
 */
export function validateToolCall(
  toolName: string,
  args: Record<string, unknown>,
  ctx: OrchestratorContext
): { valid: true; app: AppManifest } | { valid: false; error: string } {
  const app = findAppByToolName(toolName);

  if (!app) {
    return { valid: false, error: `Unknown tool: ${toolName}` };
  }

  // Check if app is enabled
  if (ctx.enabledApps && !ctx.enabledApps.includes(app.appId)) {
    return { valid: false, error: `App ${app.appId} is not enabled for this context` };
  }

  // Check app is approved
  if (app.reviewStatus !== "approved") {
    return { valid: false, error: `App ${app.appId} is not approved` };
  }

  // TODO: JSON Schema validation of args against tool.parameters

  return { valid: true, app };
}

/**
 * Build shared context summary for LLM from active app sessions.
 */
export function buildAppContextSummary(
  activeSessions: Map<string, { appId: string; sharedContext: Record<string, unknown> }>
): string {
  if (activeSessions.size === 0) return "";

  const parts: string[] = [];
  for (const [sessionId, session] of activeSessions) {
    parts.push(
      `[Active App: ${session.appId}, Session: ${sessionId}] Context: ${JSON.stringify(session.sharedContext)}`
    );
  }
  return parts.join("\n");
}
