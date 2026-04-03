import { NextResponse } from "next/server";
import { z } from "zod";
import { registerApp, getApp } from "@/lib/plugins/registry";
import type { AppManifest } from "@/types";

const manifestSchema = z.object({
  appId: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  version: z.string(),
  description: z.string(),
  ui: z.object({
    entrypointUrl: z.string().url(),
    sandboxProfile: z.string(),
  }),
  tools: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      parameters: z.record(z.string(), z.unknown()),
      returns: z.record(z.string(), z.unknown()).optional(),
    })
  ),
  permissions: z.array(z.string()),
  auth: z.enum(["none", "api_key", "oauth2"]),
  reviewStatus: z.enum(["unreviewed", "reviewed", "approved"]).default("unreviewed"),
  icon: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = manifestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid manifest", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const manifest = parsed.data as AppManifest;

    // Check for duplicate
    if (getApp(manifest.appId)) {
      return NextResponse.json(
        { error: `App ${manifest.appId} is already registered` },
        { status: 409 }
      );
    }

    registerApp(manifest);

    return NextResponse.json({ success: true, appId: manifest.appId }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  const { getAllApps } = await import("@/lib/plugins/registry");
  return NextResponse.json(getAllApps());
}
