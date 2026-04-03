"use client";

import { useAppIframe } from "@/hooks/use-app-iframe";
import { Loader2, AlertTriangle, X } from "lucide-react";
import type { AppSession, AppManifest } from "@/types";

interface AppIframeProps {
  app: AppManifest;
  session: AppSession;
  onStateUpdate?: (state: Record<string, unknown>) => void;
  onComplete?: (result: Record<string, unknown>) => void;
  onClose?: () => void;
}

export function AppIframe({ app, session, onStateUpdate, onComplete, onClose }: AppIframeProps) {
  const { iframeRef, isReady, isLoading } = useAppIframe({
    session,
    onStateUpdate,
    onComplete,
  });

  return (
    <div className="flex flex-col rounded-xl border border-zinc-700 bg-zinc-900 overflow-hidden">
      {/* App Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{app.icon}</span>
          <span className="text-sm font-medium text-zinc-200">{app.name}</span>
          {isReady && (
            <span className="rounded-full bg-green-900/50 px-2 py-0.5 text-[10px] text-green-400">
              Active
            </span>
          )}
          {session.status === "timed_out" && (
            <span className="rounded-full bg-red-900/50 px-2 py-0.5 text-[10px] text-red-400">
              Timed Out
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* App Content */}
      <div className="relative min-h-[400px]">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 z-10">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
              <span className="text-xs text-zinc-500">Loading {app.name}...</span>
            </div>
          </div>
        )}

        {session.status === "timed_out" && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 z-10">
            <div className="flex flex-col items-center gap-2 text-center">
              <AlertTriangle className="h-6 w-6 text-amber-400" />
              <span className="text-sm text-zinc-300">App stopped responding</span>
              <span className="text-xs text-zinc-500">The app didn&apos;t load in time.</span>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={app.ui.entrypointUrl}
          sandbox={app.ui.sandboxProfile}
          className="h-full w-full min-h-[400px] border-0"
          title={app.name}
        />
      </div>
    </div>
  );
}
