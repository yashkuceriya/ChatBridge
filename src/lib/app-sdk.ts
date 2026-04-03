/**
 * ChatBridge App SDK
 *
 * A simple library for third-party app developers to integrate with ChatBridge.
 * Instead of using raw postMessage, developers can use:
 *
 *   const sdk = new ChatBridgeSDK();
 *   sdk.ready();
 *   sdk.updateState({ fen: "...", turn: "white" });
 *   sdk.complete({ winner: "white", moves: 24 });
 *   sdk.onToolInvoke((toolName, args) => { ... });
 */

type MessageHandler = (toolName: string, args: Record<string, unknown>) => void;
type SessionHandler = (sessionId: string, token: string, config: Record<string, unknown>) => void;

export class ChatBridgeSDK {
  private sessionId: string | null = null;
  private capabilityToken: string | null = null;
  private toolHandlers: MessageHandler[] = [];
  private sessionHandlers: SessionHandler[] = [];
  private version: string;

  constructor(options?: { version?: string }) {
    this.version = options?.version || "1.0.0";
    this.setupListener();
  }

  /** Signal that the app is loaded and ready. */
  ready(capabilities: string[] = []): void {
    this.send({
      type: "APP_READY",
      payload: { version: this.version, capabilities },
    });
  }

  /** Update shared context visible to the chatbot. */
  updateState(state: Record<string, unknown>): void {
    if (!this.sessionId) {
      console.warn("[ChatBridge SDK] Cannot update state: no session initialized");
      return;
    }
    this.send({
      type: "APP_STATE_UPDATE",
      payload: { appSessionId: this.sessionId, state },
    });
  }

  /** Signal that the app's task is complete. */
  complete(result: Record<string, unknown>): void {
    if (!this.sessionId) {
      console.warn("[ChatBridge SDK] Cannot complete: no session initialized");
      return;
    }
    this.send({
      type: "APP_COMPLETE",
      payload: { appSessionId: this.sessionId, result },
    });
  }

  /** Signal an error. */
  error(errorMessage: string, code: string = "APP_ERROR"): void {
    this.send({
      type: "APP_ERROR",
      payload: {
        appSessionId: this.sessionId,
        error: errorMessage,
        code,
      },
    });
  }

  /** Register a handler for tool invocations from the orchestrator. */
  onToolInvoke(handler: MessageHandler): () => void {
    this.toolHandlers.push(handler);
    return () => {
      this.toolHandlers = this.toolHandlers.filter((h) => h !== handler);
    };
  }

  /** Register a handler for session initialization. */
  onSessionInit(handler: SessionHandler): () => void {
    this.sessionHandlers.push(handler);
    return () => {
      this.sessionHandlers = this.sessionHandlers.filter((h) => h !== handler);
    };
  }

  /** Get the current session ID. */
  getSessionId(): string | null {
    return this.sessionId;
  }

  private send(message: Record<string, unknown>): void {
    window.parent.postMessage(message, "*");
  }

  private setupListener(): void {
    window.addEventListener("message", (event: MessageEvent) => {
      const { type, payload } = event.data || {};

      switch (type) {
        case "SESSION_INIT":
          this.sessionId = payload.appSessionId;
          this.capabilityToken = payload.capabilityToken;
          for (const handler of this.sessionHandlers) {
            handler(payload.appSessionId, payload.capabilityToken, payload.config || {});
          }
          break;

        case "TOOL_INVOKE":
          for (const handler of this.toolHandlers) {
            handler(payload.toolName, payload.args || {});
          }
          break;

        case "SESSION_END":
          this.sessionId = null;
          this.capabilityToken = null;
          break;
      }
    });
  }
}
