import { getAllApps } from "@/lib/plugins/registry";
import { logAudit } from "./audit";

/**
 * Policy engine for K-12 teacher controls.
 * Default-deny: only apps explicitly enabled by a teacher are available to students.
 * Admins and teachers bypass app-level restrictions but still go through moderation.
 */

export interface PolicyContext {
  userId: string;
  role: "student" | "teacher" | "admin";
  enabledApps: string[]; // apps enabled by teacher for this class
}

// In-memory policy store for development; replace with DB in production
let currentPolicy: PolicyContext = {
  userId: "system",
  role: "admin",
  enabledApps: getAllAppsIds(),
};

function getAllAppsIds(): string[] {
  // Lazy: return all registered app IDs as default-enabled for demo
  return getAllApps().map((a) => a.appId);
}

/**
 * Check if a tool call is allowed by policy.
 * Teachers and admins can use any approved app.
 * Students can only use apps explicitly enabled by their teacher.
 */
export function checkPolicy(
  toolName: string,
  appId: string,
  ctx: PolicyContext
): { allowed: boolean; reason?: string } {
  // Admins bypass app restrictions
  if (ctx.role === "admin") {
    return { allowed: true };
  }

  // Teachers can use any approved app
  if (ctx.role === "teacher") {
    return { allowed: true };
  }

  // Students: default-deny -- must be in the enabled list
  if (!ctx.enabledApps.includes(appId)) {
    logAudit({
      eventType: "policy_denied",
      userId: ctx.userId,
      payload: {
        toolName,
        appId,
        reason: `App "${appId}" is not enabled for this class`,
        role: ctx.role,
      },
    });
    return {
      allowed: false,
      reason: `App "${appId}" is not enabled for this class. Ask your teacher to enable it.`,
    };
  }

  return { allowed: true };
}

/**
 * Get the current policy.
 * For demo: all registered apps are enabled by default.
 */
export function getDefaultPolicy(): PolicyContext {
  // Re-resolve app IDs each call so newly registered apps appear
  return {
    userId: "system",
    role: "admin",
    enabledApps: getAllAppsIds(),
  };
}

/**
 * Get the stored policy (or default if none set).
 */
export function getCurrentPolicy(): PolicyContext {
  // Ensure newly registered apps are reflected if using the default
  if (currentPolicy.userId === "system") {
    currentPolicy.enabledApps = getAllAppsIds();
  }
  return { ...currentPolicy, enabledApps: [...currentPolicy.enabledApps] };
}

/**
 * Teacher can enable/disable apps for students.
 * Returns the updated policy context.
 */
export function setAppEnabled(
  appId: string,
  enabled: boolean,
  policy: PolicyContext
): PolicyContext {
  const apps = new Set(policy.enabledApps);

  if (enabled) {
    apps.add(appId);
  } else {
    apps.delete(appId);
  }

  const updated: PolicyContext = {
    ...policy,
    enabledApps: Array.from(apps),
  };

  // Persist in memory
  currentPolicy = updated;

  logAudit({
    eventType: "auth_event",
    userId: policy.userId,
    payload: {
      action: enabled ? "app_enabled" : "app_disabled",
      appId,
      enabledApps: updated.enabledApps,
    },
  });

  return updated;
}

/**
 * Replace the entire policy (used by admin API).
 */
export function setCurrentPolicy(policy: PolicyContext): void {
  currentPolicy = { ...policy, enabledApps: [...policy.enabledApps] };
}
