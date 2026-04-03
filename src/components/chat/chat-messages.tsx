"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "./message-bubble";
import type { UIMessage } from "ai";
import { Puzzle, Sparkles, Cloud, Music, BookOpen, Grid3x3, Dice6 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ChatMessagesProps {
  messages: UIMessage[];
  isLoading: boolean;
  activeApp?: string | null;
  onSuggestionClick?: (text: string) => void;
}

function getTextContent(message: UIMessage): string {
  return (
    message.parts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("") || ""
  );
}

interface ToolCallInfo {
  toolName: string;
  state: string;
}

function getToolCalls(message: UIMessage): ToolCallInfo[] {
  if (!message.parts) return [];
  const results: ToolCallInfo[] = [];
  for (const p of message.parts) {
    if (p == null || typeof p !== "object") continue;
    const partType = (p as any).type;
    if (typeof partType === "string" && partType.startsWith("tool-")) {
      results.push({
        toolName: partType.replace("tool-", ""),
        state: String((p as any).state ?? "unknown"),
      });
    }
  }
  return results;
}

const SUGGESTIONS = [
  {
    text: "Let's play chess",
    icon: Sparkles,
    gradient: "from-amber-500/20 to-orange-500/20",
    border: "border-amber-500/20 hover:border-amber-500/40",
  },
  {
    text: "Let's play tic tac toe!",
    icon: Grid3x3,
    gradient: "from-rose-500/20 to-pink-500/20",
    border: "border-rose-500/20 hover:border-rose-500/40",
  },
  {
    text: "Let's play ludo!",
    icon: Dice6,
    gradient: "from-cyan-500/20 to-teal-500/20",
    border: "border-cyan-500/20 hover:border-cyan-500/40",
  },
  {
    text: "What's the weather in NYC?",
    icon: Cloud,
    gradient: "from-sky-500/20 to-cyan-500/20",
    border: "border-sky-500/20 hover:border-sky-500/40",
  },
  {
    text: "Search for music by Queen",
    icon: Music,
    gradient: "from-green-500/20 to-emerald-500/20",
    border: "border-green-500/20 hover:border-green-500/40",
  },
  {
    text: "Help me with math homework",
    icon: BookOpen,
    gradient: "from-violet-500/20 to-purple-500/20",
    border: "border-violet-500/20 hover:border-violet-500/40",
  },
];

export function ChatMessages({
  messages,
  isLoading,
  activeApp,
  onSuggestionClick,
}: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl py-4">
        <AnimatePresence mode="wait">
          {messages.length === 0 && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="flex flex-col items-center justify-center py-24"
            >
              {/* Gradient background glow */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-[400px] w-[400px] rounded-full bg-violet-600/5 blur-[100px]" />
              </div>

              {/* Logo */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.5, type: "spring", stiffness: 200 }}
                className="relative mb-6"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-600/20">
                  <span className="text-4xl">🌉</span>
                </div>
                <div className="absolute -inset-1 -z-10 rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-600 opacity-20 blur-lg" />
              </motion.div>

              {/* Title */}
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="mb-3 text-2xl font-bold text-gradient-brand"
              >
                Welcome to ChatBridge
              </motion.h2>

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="mb-8 max-w-md text-center text-sm leading-relaxed text-zinc-500"
              >
                Your AI learning assistant with third-party app integration.
                <br />
                <span className="text-zinc-600">Try one of these to get started.</span>
              </motion.p>

              {/* Suggestion cards */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.4 }}
                className="grid w-full max-w-lg grid-cols-3 gap-3"
              >
                {SUGGESTIONS.map((s, i) => (
                  <motion.button
                    key={s.text}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 + i * 0.08, duration: 0.3 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onSuggestionClick?.(s.text)}
                    className={`group relative flex items-start gap-3 rounded-2xl border bg-zinc-900/50 p-4 text-left text-sm transition-all duration-300 hover:bg-zinc-900 hover:shadow-lg ${s.border}`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${s.gradient}`}>
                      <s.icon className="h-4 w-4 text-zinc-300" />
                    </div>
                    <span className="mt-1 text-zinc-400 transition-colors group-hover:text-zinc-200">
                      {s.text}
                    </span>
                    {/* Subtle hover glow */}
                    <div className={`pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br ${s.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-30`} />
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {messages.map((message, idx) => {
            const text = getTextContent(message);
            const toolCalls = getToolCalls(message);

            return (
              <motion.div
                key={`${message.id}-${idx}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                {text && (
                  <MessageBubble
                    role={message.role as "user" | "assistant"}
                    content={text}
                  />
                )}

                {toolCalls.map((tc, i) => (
                  <div key={`${message.id}-tool-${i}`} className="flex gap-3 px-4 py-1.5">
                    <div className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs text-violet-300 backdrop-blur-sm">
                      <Puzzle className="h-3 w-3" />
                      <span className="font-medium">
                        {tc.state === "output-available"
                          ? formatToolName(tc.toolName)
                          : `${formatToolName(tc.toolName)}...`}
                      </span>
                      {tc.state === "output-available" && (
                        <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-green-400" />
                      )}
                    </div>
                  </div>
                ))}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Shimmer skeleton loading */}
        {isLoading && messages.at(-1)?.role === "user" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="px-4 py-4"
          >
            <div className="mb-1.5 ml-1">
              <span className="text-xs font-medium text-violet-400/70">ChatBridge</span>
            </div>
            <div className="max-w-[75%] space-y-2.5">
              <div className="shimmer h-4 w-3/4 rounded-lg" />
              <div className="shimmer h-4 w-full rounded-lg" />
              <div className="shimmer h-4 w-2/3 rounded-lg" />
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function formatToolName(name: string): string {
  return name
    .replace(/^(chess|tictactoe|ludo|weather|spotify)_/, "")
    .replace(/_/g, " ");
}
