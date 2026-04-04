import { NextResponse } from "next/server";
import { findAppByToolName, registerBuiltinApps } from "@/lib/plugins/registry";
import { validateToolCall, type OrchestratorContext } from "@/lib/orchestrator";
import { checkPolicy, getCurrentPolicy } from "@/lib/orchestrator/policy-engine";
import { logAudit } from "@/lib/orchestrator/audit";
import { moderateContent, k12ContentCheck } from "@/lib/moderation";
import { createCapabilityToken } from "@/lib/security/capability-token";
import { checkRateLimit, TOOL_RATE_LIMIT } from "@/lib/security/rate-limiter";
import { withCircuitBreaker } from "@/lib/orchestrator/circuit-breaker";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Ensure apps are registered
registerBuiltinApps();

/**
 * POST /api/orchestrator/invoke
 *
 * Server-side tool execution endpoint. When the LLM proposes a tool call,
 * the frontend sends it here for validation and execution.
 *
 * Pipeline:
 *   1. Validate tool exists in registry
 *   2. Check policy (is this app enabled for this user?)
 *   3. Validate args against the tool's JSON Schema
 *   4. Check rate limits
 *   5. Run moderation on the args (K-12 safety)
 *   6. Log the tool call to the audit log
 *   7. Create/update an app session
 *   8. Generate a capability token for the app session
 *   9. Return result
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      toolName,
      args,
      conversationId = "default",
      appSessionId: requestedSessionId,
      userId: bodyUserId,
    } = body;

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ allowed: false, reason: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as any).id as string;

    if (!toolName || typeof toolName !== "string") {
      return NextResponse.json(
        { allowed: false, reason: "Missing required field: toolName" },
        { status: 400 }
      );
    }

    // --- Step 1: Validate tool exists ---
    const app = findAppByToolName(toolName);
    if (!app) {
      logAudit({
        eventType: "tool_call_failed",
        userId,
        conversationId,
        payload: { toolName, reason: "Unknown tool" },
      });
      return NextResponse.json(
        { allowed: false, reason: `Unknown tool: "${toolName}"` },
        { status: 404 }
      );
    }

    // --- Step 2: Check policy ---
    const policy = getCurrentPolicy();
    const policyCtx = {
      userId,
      role: policy.role,
      enabledApps: policy.enabledApps,
    };
    const policyResult = checkPolicy(toolName, app.appId, policyCtx);
    if (!policyResult.allowed) {
      logAudit({
        eventType: "policy_denied",
        userId,
        conversationId,
        payload: { toolName, appId: app.appId, reason: policyResult.reason },
      });
      return NextResponse.json(
        { allowed: false, reason: policyResult.reason },
        { status: 403 }
      );
    }

    // --- Step 3: Validate args against registry ---
    const orchCtx: OrchestratorContext = {
      conversationId,
      userId,
      enabledApps: policy.enabledApps,
      activeSessions: new Map(),
    };
    const validation = validateToolCall(toolName, args ?? {}, orchCtx);
    if (!validation.valid) {
      logAudit({
        eventType: "tool_call_failed",
        userId,
        conversationId,
        payload: { toolName, reason: validation.error },
      });
      return NextResponse.json(
        { allowed: false, reason: validation.error },
        { status: 400 }
      );
    }

    // --- Step 4: Check rate limits ---
    const rateKey = `tool:${userId}:${app.appId}`;
    const rateResult = checkRateLimit(rateKey, TOOL_RATE_LIMIT);
    if (!rateResult.allowed) {
      logAudit({
        eventType: "tool_call_failed",
        userId,
        conversationId,
        payload: { toolName, appId: app.appId, reason: "Rate limit exceeded" },
      });
      return NextResponse.json(
        {
          allowed: false,
          reason: "Too many requests. Please wait a moment before trying again.",
          retryAfter: Math.ceil((rateResult.resetAt - Date.now()) / 1000),
        },
        { status: 429 }
      );
    }

    // --- Step 5: Run moderation on args (K-12 safety) ---
    // Wrapped in circuit breaker: if OpenAI moderation is down, fail open in dev, closed in prod
    const argsText = JSON.stringify(args ?? {});
    const moderationFallback = { flagged: process.env.NODE_ENV === "production", categories: ["circuit_open"] as string[], message: "Safety check temporarily unavailable." };
    const { result: moderationResult } = await withCircuitBreaker(
      "moderation",
      () => moderateContent(argsText),
      moderationFallback
    );
    const k12Result = k12ContentCheck(argsText);

    if (moderationResult.flagged || k12Result.flagged) {
      const flagResult = moderationResult.flagged ? moderationResult : k12Result;
      logAudit({
        eventType: "moderation_flagged",
        userId,
        conversationId,
        payload: {
          toolName,
          appId: app.appId,
          categories: flagResult.categories,
          source: "tool_args",
        },
      });
      return NextResponse.json(
        {
          allowed: false,
          reason:
            flagResult.message ||
            "This request contains content that is not appropriate for a K-12 environment.",
        },
        { status: 403 }
      );
    }

    // --- Step 6: Log the tool call ---
    const appSessionId =
      requestedSessionId || `session_${app.appId}_${Date.now()}`;

    logAudit({
      eventType: "tool_call_requested",
      userId,
      conversationId,
      appSessionId,
      payload: {
        toolName,
        appId: app.appId,
        args: args ?? {},
      },
    });

    // --- Step 7: Create/update app session (in-memory for dev) ---
    // In production this would be a DB upsert via src/lib/db/queries.ts
    logAudit({
      eventType: "app_state_update",
      userId,
      conversationId,
      appSessionId,
      payload: {
        appId: app.appId,
        status: "active",
        toolName,
      },
    });

    // --- Step 8: Generate capability token ---
    const toolDef = app.tools.find((t) => t.name === toolName);
    const capabilityToken = await createCapabilityToken({
      appSessionId,
      appId: app.appId,
      userId,
      permissions: app.permissions,
    });

    // --- Step 9: Return success ---
    logAudit({
      eventType: "tool_call_executed",
      userId,
      conversationId,
      appSessionId,
      payload: { toolName, appId: app.appId },
    });

    return NextResponse.json({
      allowed: true,
      appId: app.appId,
      appName: app.name,
      appIcon: app.icon,
      appSessionId,
      capabilityToken,
      entrypointUrl: app.ui.entrypointUrl,
      sandboxFlags: app.ui.sandboxProfile,
      tool: {
        name: toolName,
        description: toolDef?.description,
      },
    });
  } catch (error) {
    console.error("Orchestrator invoke error:", error);
    return NextResponse.json(
      {
        allowed: false,
        reason: "Internal server error during tool invocation.",
      },
      { status: 500 }
    );
  }
}
