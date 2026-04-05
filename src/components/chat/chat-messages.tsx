"use client";

import { useEffect, useRef, useState } from "react";
import { MessageBubble } from "./message-bubble";
import type { UIMessage } from "ai";
import { Puzzle, Sparkles, Cloud, Music, BookOpen, Grid3x3, Dice6, ChevronDown, ChevronRight, CheckCircle2, Loader2 } from "lucide-react";
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
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
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
        input: (p as any).input as Record<string, unknown> | undefined,
        output: (p as any).output as Record<string, unknown> | undefined,
      });
    }
  }
  return results;
}

function ToolCallCard({ tc }: { tc: ToolCallInfo }) {
  const [expanded, setExpanded] = useState(false);
  const isDone = tc.state === "output-available";
  const isRunning = !isDone;
  const appName = tc.toolName.split("_")[0];
  const action = formatToolName(tc.toolName);

  // Pick a color based on the app
  const colorMap: Record<string, string> = {
    chess: "violet", tictactoe: "rose", ludo: "cyan",
    weather: "sky", spotify: "green",
  };
  const color = colorMap[appName] || "violet";

  const borderColor = `border-${color}-500/20`;
  const bgColor = `bg-${color}-500/5`;
  const textColor = `text-${color}-400`;

  // Summarize input/output for display
  const inputSummary = tc.input
    ? Object.entries(tc.input).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ")
    : null;

  const outputHighlights = tc.output ? getOutputHighlights(tc.toolName, tc.output) : null;

  return (
    <div className="px-4 py-1.5">
      <div className={`ml-1 rounded-xl border ${borderColor} ${bgColor} overflow-hidden`}>
        {/* Header — always visible */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-white/[0.02] transition-colors"
        >
          {isRunning ? (
            <Loader2 className={`h-3.5 w-3.5 ${textColor} animate-spin`} />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
          )}
          <Puzzle className={`h-3 w-3 ${textColor}`} />
          <span className={`text-xs font-medium ${textColor}`}>
            {isRunning ? `${action}...` : action}
          </span>
          {inputSummary && (
            <span className="text-[10px] text-zinc-500 truncate max-w-[200px]">
              ({inputSummary})
            </span>
          )}
          <span className="ml-auto">
            {expanded ? (
              <ChevronDown className="h-3 w-3 text-zinc-600" />
            ) : (
              <ChevronRight className="h-3 w-3 text-zinc-600" />
            )}
          </span>
        </button>

        {/* Expanded details */}
        {expanded && (
          <div className="border-t border-zinc-800/50 px-3 py-2 space-y-2">
            {inputSummary && (
              <div>
                <span className="text-[10px] font-medium text-zinc-500 uppercase">Input</span>
                <pre className="text-[11px] text-zinc-400 mt-0.5 whitespace-pre-wrap break-all">
                  {JSON.stringify(tc.input, null, 2)}
                </pre>
              </div>
            )}
            {tc.output && (
              <div>
                <span className="text-[10px] font-medium text-zinc-500 uppercase">Result</span>
                <pre className="text-[11px] text-zinc-400 mt-0.5 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                  {JSON.stringify(tc.output, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Quick output summary — always visible when done */}
        {isDone && outputHighlights && !expanded && (
          <div className="border-t border-zinc-800/30 px-3 py-1.5">
            <span className="text-[10px] text-zinc-500">{outputHighlights}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Extract a human-readable summary from tool output */
function getOutputHighlights(toolName: string, output: Record<string, unknown>): string | null {
  if (output.error) return `Error: ${output.error}`;

  if (toolName === "chess_start_game") return output.message as string;
  if (toolName === "chess_get_game_status") {
    const ev = output.evaluationDescription || output.evaluationExplanation;
    return `${output.legalMoveCount} legal moves | ${ev} | Best: ${output.bestMove}`;
  }
  if (toolName === "chess_get_hint") return `Best move: ${output.bestMove}`;
  if (toolName === "chess_make_move") return output.message as string || `${output.move} → ${output.captured ? "captures!" : "ok"}`;

  if (toolName === "tictactoe_start_game") return output.message as string;
  if (toolName === "tictactoe_get_game_status") return `${(output.availableMoves as unknown[])?.length} moves available`;

  if (toolName === "ludo_start_game") return output.message as string;
  if (toolName === "ludo_roll_dice") return output.message as string;

  if (toolName === "weather_get_current") return `${output.location}: ${output.temperature}, ${output.description}`;
  if (toolName === "spotify_search") return `${output.resultCount} results${output.mock ? " (demo)" : ""}`;

  if (output.message) return output.message as string;
  if (output.status) return `Status: ${output.status}`;
  return null;
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

            // Auto-move messages start with "[Move", "[Tic", "[Ludo" — render as system notifications
            const isAutoMove = message.role === "user" && text && /^\[(Move|Tic|Ludo)/.test(text);

            return (
              <motion.div
                key={`${message.id}-${idx}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                {text && isAutoMove ? (
                  <div className="flex justify-center px-4 py-1">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-[11px] text-zinc-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-500/50" />
                      {text.replace(/^\[|\]$/g, "")}
                    </span>
                  </div>
                ) : text ? (
                  <MessageBubble
                    role={message.role as "user" | "assistant"}
                    content={text}
                  />
                ) : null}

                {toolCalls.map((tc, i) => (
                  <ToolCallCard key={`${message.id}-tool-${i}`} tc={tc} />
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
