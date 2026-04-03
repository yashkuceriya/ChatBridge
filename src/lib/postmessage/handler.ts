import { appToHostMessageSchema } from "@/types/postmessage";
import type { AppToHostMessage } from "@/types";

export interface PostMessageConfig {
  allowedOrigins: string[];
  onAppReady: (payload: AppToHostMessage & { type: "APP_READY" }) => void;
  onStateUpdate: (payload: AppToHostMessage & { type: "APP_STATE_UPDATE" }) => void;
  onAppComplete: (payload: AppToHostMessage & { type: "APP_COMPLETE" }) => void;
  onAppError: (payload: AppToHostMessage & { type: "APP_ERROR" }) => void;
}

/**
 * Create a secure postMessage listener with origin validation and schema checking.
 * Returns a cleanup function to remove the listener.
 */
export function createPostMessageHandler(config: PostMessageConfig): () => void {
  const handler = (event: MessageEvent) => {
    // Origin validation
    if (!config.allowedOrigins.includes(event.origin) && event.origin !== window.location.origin) {
      console.warn(`[PostMessage] Rejected message from untrusted origin: ${event.origin}`);
      return;
    }

    // Schema validation
    const parsed = appToHostMessageSchema.safeParse(event.data);
    if (!parsed.success) {
      console.warn(`[PostMessage] Invalid message schema:`, parsed.error.issues);
      return;
    }

    const message = parsed.data;

    switch (message.type) {
      case "APP_READY":
        config.onAppReady(message as AppToHostMessage & { type: "APP_READY" });
        break;
      case "APP_STATE_UPDATE":
        config.onStateUpdate(message as AppToHostMessage & { type: "APP_STATE_UPDATE" });
        break;
      case "APP_COMPLETE":
        config.onAppComplete(message as AppToHostMessage & { type: "APP_COMPLETE" });
        break;
      case "APP_ERROR":
        config.onAppError(message as AppToHostMessage & { type: "APP_ERROR" });
        break;
    }
  };

  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}

/**
 * Send a message to an app iframe with strict target origin.
 */
export function sendToApp(
  iframe: HTMLIFrameElement,
  message: Record<string, unknown>,
  targetOrigin: string
): void {
  if (!iframe.contentWindow) {
    console.error("[PostMessage] Iframe contentWindow not available");
    return;
  }
  iframe.contentWindow.postMessage(message, targetOrigin);
}
