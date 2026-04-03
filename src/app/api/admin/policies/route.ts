import { NextResponse } from "next/server";
import {
  getCurrentPolicy,
  setAppEnabled,
  setCurrentPolicy,
} from "@/lib/orchestrator/policy-engine";
import { getAllApps, registerBuiltinApps } from "@/lib/plugins/registry";
import { logAudit } from "@/lib/orchestrator/audit";

// Ensure apps are registered
registerBuiltinApps();

/**
 * GET /api/admin/policies
 *
 * Returns the current policy with all apps and their enabled/disabled status.
 */
export async function GET() {
  const policy = getCurrentPolicy();
  const allApps = getAllApps();

  const apps = allApps.map((app) => ({
    appId: app.appId,
    name: app.name,
    description: app.description,
    icon: app.icon,
    auth: app.auth,
    reviewStatus: app.reviewStatus,
    enabled: policy.enabledApps.includes(app.appId),
    permissions: app.permissions,
    version: app.version,
  }));

  return NextResponse.json({
    policy: {
      userId: policy.userId,
      role: policy.role,
      enabledApps: policy.enabledApps,
    },
    apps,
    securityPosture: "default-deny",
  });
}

/**
 * POST /api/admin/policies
 *
 * Update policy: enable or disable an app.
 * Body: { appId: string, enabled: boolean }
 *
 * Or bulk update:
 * Body: { enabledApps: string[] }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    let policy = getCurrentPolicy();

    // Bulk update
    if (Array.isArray(body.enabledApps)) {
      const allAppIds = getAllApps().map((a) => a.appId);
      const validIds = body.enabledApps.filter((id: string) =>
        allAppIds.includes(id)
      );

      policy = {
        ...policy,
        enabledApps: validIds,
      };
      setCurrentPolicy(policy);

      logAudit({
        eventType: "auth_event",
        userId: policy.userId,
        payload: {
          action: "bulk_policy_update",
          enabledApps: validIds,
        },
      });

      return NextResponse.json({
        success: true,
        policy: {
          userId: policy.userId,
          role: policy.role,
          enabledApps: policy.enabledApps,
        },
      });
    }

    // Single app toggle
    const { appId, enabled } = body;

    if (!appId || typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "Missing required fields: appId (string), enabled (boolean)" },
        { status: 400 }
      );
    }

    // Verify the app exists
    const allApps = getAllApps();
    const appExists = allApps.some((a) => a.appId === appId);
    if (!appExists) {
      return NextResponse.json(
        { error: `App "${appId}" not found in registry` },
        { status: 404 }
      );
    }

    const updatedPolicy = setAppEnabled(appId, enabled, policy);

    // Return updated state with full app list
    const apps = allApps.map((app) => ({
      appId: app.appId,
      name: app.name,
      description: app.description,
      icon: app.icon,
      auth: app.auth,
      reviewStatus: app.reviewStatus,
      enabled: updatedPolicy.enabledApps.includes(app.appId),
    }));

    return NextResponse.json({
      success: true,
      policy: {
        userId: updatedPolicy.userId,
        role: updatedPolicy.role,
        enabledApps: updatedPolicy.enabledApps,
      },
      apps,
    });
  } catch (error) {
    console.error("Policy update error:", error);
    return NextResponse.json(
      { error: "Failed to update policy" },
      { status: 500 }
    );
  }
}
