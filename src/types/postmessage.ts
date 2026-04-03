import { z } from "zod";

// Strict schemas for postMessage validation

export const appReadySchema = z.object({
  type: z.literal("APP_READY"),
  payload: z.object({
    version: z.string(),
    capabilities: z.array(z.string()),
  }),
});

export const appStateUpdateSchema = z.object({
  type: z.literal("APP_STATE_UPDATE"),
  payload: z.object({
    appSessionId: z.string(),
    state: z.record(z.string(), z.unknown()),
  }),
});

export const appCompleteSchema = z.object({
  type: z.literal("APP_COMPLETE"),
  payload: z.object({
    appSessionId: z.string(),
    result: z.record(z.string(), z.unknown()),
  }),
});

export const appErrorSchema = z.object({
  type: z.literal("APP_ERROR"),
  payload: z.object({
    appSessionId: z.string(),
    error: z.string(),
    code: z.string(),
  }),
});

export const appToHostMessageSchema = z.discriminatedUnion("type", [
  appReadySchema,
  appStateUpdateSchema,
  appCompleteSchema,
  appErrorSchema,
]);

export const sessionInitSchema = z.object({
  type: z.literal("SESSION_INIT"),
  payload: z.object({
    appSessionId: z.string(),
    capabilityToken: z.string(),
    config: z.record(z.string(), z.unknown()),
  }),
});

export const toolInvokeSchema = z.object({
  type: z.literal("TOOL_INVOKE"),
  payload: z.object({
    toolName: z.string(),
    args: z.record(z.string(), z.unknown()),
    capabilityToken: z.string(),
  }),
});

export const sessionEndSchema = z.object({
  type: z.literal("SESSION_END"),
  payload: z.object({
    reason: z.string(),
  }),
});
