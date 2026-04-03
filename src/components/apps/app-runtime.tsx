"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Loader2, AlertTriangle, X, CheckCircle } from "lucide-react";

interface AppRuntimeProps {
  appId: string;
  entrypointUrl: string;
  sandboxFlags: string;
  sessionId: string;
  capabilityToken: string;
  toolInvocation?: { toolName: string; args: Record<string, unknown> };
  onStateUpdate: (state: Record<string, unknown>) => void;
  onComplete: (result: Record<string, unknown>) => void;
  onError: (error: string) => void;
  onClose: () => void;
  appName?: string;
  appIcon?: string;
}

type Status = "loading" | "active" | "completed" | "error" | "timed_out";

export function AppRuntime({
  appId,
  entrypointUrl,
  sandboxFlags,
  sessionId,
  capabilityToken,
  toolInvocation,
  onStateUpdate,
  onComplete,
  onError,
  onClose,
  appName,
  appIcon,
}: AppRuntimeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const readyRef = useRef(false);
  const toolSentRef = useRef(false);

  const displayName = appName || appId;
  const displayIcon = appIcon || (
    appId === "chess" ? "♟" :
    appId === "tictactoe" ? "❌" :
    appId === "ludo" ? "🎲" :
    appId === "weather" ? "🌤" : "🎵"
  );

  // Send message to iframe — no origin restriction since same-origin in dev
  const sendToIframe = useCallback((msg: Record<string, unknown>) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    console.log("[Host→App]", msg.type, msg);
    win.postMessage(msg, "*"); // Same-origin in dev, use targetOrigin in prod
  }, []);

  // Listen for messages from iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data.type !== "string") return;
      // Only handle our protocol messages
      if (!data.type.startsWith("APP_")) return;

      console.log("[App→Host]", data.type, data);

      switch (data.type) {
        case "APP_READY": {
          readyRef.current = true;
          setStatus("active");

          // Send SESSION_INIT
          sendToIframe({
            type: "SESSION_INIT",
            payload: {
              appSessionId: sessionId,
              capabilityToken,
              config: toolInvocation?.args || {},
            },
          });

          // Send TOOL_INVOKE after a small delay to ensure app processed SESSION_INIT
          if (toolInvocation && !toolSentRef.current) {
            toolSentRef.current = true;
            setTimeout(() => {
              sendToIframe({
                type: "TOOL_INVOKE",
                payload: {
                  toolName: toolInvocation.toolName,
                  args: toolInvocation.args,
                  capabilityToken,
                },
              });
            }, 100);
          }
          break;
        }
        case "APP_STATE_UPDATE": {
          if (data.payload?.state) {
            onStateUpdate(data.payload.state);
          }
          break;
        }
        case "APP_COMPLETE": {
          setStatus("completed");
          if (data.payload?.result) {
            onComplete(data.payload.result);
          }
          break;
        }
        case "APP_ERROR": {
          setErrorMsg(data.payload?.error || "Unknown error");
          onError(data.payload?.error || "Unknown error");
          break;
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [sessionId, capabilityToken, toolInvocation, sendToIframe, onStateUpdate, onComplete, onError]);

  // Timeout for APP_READY
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!readyRef.current) {
        setStatus("timed_out");
        setErrorMsg("App did not respond in time");
        onError(`App "${appId}" timed out`);
      }
    }, 15000); // 15s timeout
    return () => clearTimeout(timer);
  }, [appId, onError]);

  // Cleanup: send SESSION_END
  useEffect(() => {
    return () => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          { type: "SESSION_END", payload: { reason: "closed" } },
          "*"
        );
      }
    };
  }, []);

  const handleRetry = () => {
    readyRef.current = false;
    toolSentRef.current = false;
    setStatus("loading");
    setErrorMsg("");
    if (iframeRef.current) {
      iframeRef.current.src = entrypointUrl;
    }
  };

  const statusBadge = {
    loading: { label: "Loading...", cls: "bg-zinc-700 text-zinc-400" },
    active: { label: "Active", cls: "bg-green-900/50 text-green-400" },
    completed: { label: "Done", cls: "bg-violet-900/50 text-violet-400" },
    error: { label: "Error", cls: "bg-red-900/50 text-red-400" },
    timed_out: { label: "Timed Out", cls: "bg-amber-900/50 text-amber-400" },
  }[status];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">{displayIcon}</span>
          <span className="text-sm font-medium text-zinc-200">{displayName}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge.cls}`}>
            {statusBadge.label}
          </span>
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Iframe area */}
      <div className="relative flex-1">
        {/* Loading overlay */}
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
              <span className="text-sm text-zinc-400">Loading {displayName}...</span>
            </div>
          </div>
        )}

        {/* Timeout overlay */}
        {status === "timed_out" && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 z-10">
            <div className="flex flex-col items-center gap-3 text-center px-6">
              <AlertTriangle className="h-8 w-8 text-amber-400" />
              <span className="text-sm font-medium text-zinc-200">App Not Responding</span>
              <span className="text-xs text-zinc-500">{errorMsg}</span>
              <button onClick={handleRetry}
                className="mt-2 rounded-lg bg-zinc-700 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-600">
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Completed badge */}
        {status === "completed" && (
          <div className="absolute top-2 right-2 z-10">
            <span className="flex items-center gap-1 rounded-full bg-violet-900/60 px-2 py-1 text-[10px] text-violet-300">
              <CheckCircle className="h-3 w-3" /> Done
            </span>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={entrypointUrl}
          sandbox={sandboxFlags}
          className="w-full h-full border-0"
          style={{ minHeight: "100%" }}
          title={displayName}
        />
      </div>
    </div>
  );
}
