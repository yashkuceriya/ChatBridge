"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { createPostMessageHandler, sendToApp } from "@/lib/postmessage/handler";
import { useChatStore } from "@/store/chat-store";
import type { AppSession, HostToAppMessage } from "@/types";

interface UseAppIframeOptions {
  session: AppSession;
  onStateUpdate?: (state: Record<string, unknown>) => void;
  onComplete?: (result: Record<string, unknown>) => void;
  onError?: (error: string) => void;
}

export function useAppIframe(options: UseAppIframeOptions) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { setAppSession, removeAppSession } = useChatStore();

  const sendMessage = useCallback(
    (message: HostToAppMessage) => {
      if (iframeRef.current) {
        sendToApp(
          iframeRef.current,
          message,
          new URL(iframeRef.current.src).origin
        );
      }
    },
    []
  );

  useEffect(() => {
    const cleanup = createPostMessageHandler({
      allowedOrigins: [window.location.origin],
      onAppReady: () => {
        setIsReady(true);
        setIsLoading(false);
        // Send session init
        sendMessage({
          type: "SESSION_INIT",
          payload: {
            appSessionId: options.session.id,
            capabilityToken: options.session.capabilityToken,
            config: {},
          },
        });
        setAppSession({ ...options.session, status: "active" });
      },
      onStateUpdate: (msg) => {
        if (msg.payload.appSessionId === options.session.id) {
          options.onStateUpdate?.(msg.payload.state);
          setAppSession({
            ...options.session,
            sharedContext: msg.payload.state,
          });
        }
      },
      onAppComplete: (msg) => {
        if (msg.payload.appSessionId === options.session.id) {
          options.onComplete?.(msg.payload.result);
          setAppSession({ ...options.session, status: "completed" });
        }
      },
      onAppError: (msg) => {
        if (msg.payload.appSessionId === options.session.id) {
          options.onError?.(msg.payload.error);
          setAppSession({ ...options.session, status: "error" });
        }
      },
    });

    // Timeout: if app doesn't send APP_READY within 10s, mark as error
    const timeout = setTimeout(() => {
      if (!isReady) {
        setIsLoading(false);
        setAppSession({ ...options.session, status: "timed_out" });
      }
    }, 10000);

    return () => {
      cleanup();
      clearTimeout(timeout);
    };
  }, [options.session.id]);

  return { iframeRef, isReady, isLoading, sendMessage };
}
