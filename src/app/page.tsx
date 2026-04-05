"use client";

import { useChat } from "@ai-sdk/react";
import { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatInput } from "@/components/chat/chat-input";
import { Sidebar } from "@/components/layout/sidebar";
import { AppRuntime } from "@/components/apps/app-runtime";
import { useConversations, DbMessage } from "@/hooks/use-conversations";
import { useSession } from "next-auth/react";
import { Shield, X } from "lucide-react";

interface ActiveApp {
  appId: string;
  appName: string;
  appIcon?: string;
  toolName: string;
  args: Record<string, unknown>;
  sessionId: string;
  entrypointUrl: string;
  sandboxFlags: string;
  capabilityToken: string;
}

// Tools that are executed server-side and should NOT trigger an app iframe
const SERVER_EXECUTED_TOOLS = new Set([
  "chess_get_game_status", "chess_get_hint",
  "tictactoe_get_game_status",
  "ludo_get_game_status",
]);

// Map tool name prefixes to app IDs
function detectAppFromToolType(partType: string): { appId: string; toolName: string } | null {
  const toolName = partType.replace("tool-", "");
  // Skip tools that execute server-side — they don't need an iframe
  if (SERVER_EXECUTED_TOOLS.has(toolName)) return null;
  if (partType.startsWith("tool-chess_")) return { appId: "chess", toolName };
  if (partType.startsWith("tool-tictactoe_")) return { appId: "tictactoe", toolName };
  if (partType.startsWith("tool-ludo_")) return { appId: "ludo", toolName };
  if (partType.startsWith("tool-weather_")) return { appId: "weather", toolName };
  if (partType.startsWith("tool-spotify_")) return { appId: "spotify", toolName };
  return null;
}

/** Convert a DB message row into a UIMessage that useChat understands. */
function dbMessageToUIMessage(msg: DbMessage): UIMessage {
  return {
    id: msg.id,
    role: msg.role as "user" | "assistant" | "system",
    parts: [{ type: "text" as const, text: msg.content }],
  };
}

const GRADE_BANDS = [
  { id: "K-2", label: "K-2nd", emoji: "🧒", ages: "5-7" },
  { id: "3-5", label: "3rd-5th", emoji: "📚", ages: "8-10" },
  { id: "6-8", label: "6th-8th", emoji: "🔬", ages: "11-13" },
  { id: "9-12", label: "9th-12th", emoji: "🎓", ages: "14-18" },
];

function GradeSelector({ onSelect }: { onSelect: (grade: string) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/95 backdrop-blur-sm">
      <div className="w-full max-w-md p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 mx-auto mb-4">
          <span className="text-3xl">🌉</span>
        </div>
        <h2 className="text-xl font-bold text-zinc-100 mb-1">Welcome to ChatBridge!</h2>
        <p className="text-sm text-zinc-400 mb-6">What grade are you in?</p>
        <div className="grid grid-cols-2 gap-3">
          {GRADE_BANDS.map((g) => (
            <button
              key={g.id}
              onClick={() => onSelect(g.id)}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-violet-600/40 hover:bg-zinc-900 hover:scale-105"
            >
              <span className="text-2xl">{g.emoji}</span>
              <span className="text-sm font-bold text-zinc-200">{g.label}</span>
              <span className="text-[10px] text-zinc-500">Ages {g.ages}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState("");
  const [activeApp, setActiveApp] = useState<ActiveApp | null>(null);
  const activeAppRef = useRef<ActiveApp | null>(null);
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role as string | undefined;
  const canAccessTeacherControls = userRole === "teacher" || userRole === "admin";
  const [teacherControlsOpen, setTeacherControlsOpen] = useState(false);

  // Grade level — stored in localStorage so it persists
  const [gradeBand, setGradeBand] = useState<string | null>(null);
  const gradeBandRef = useRef<string | null>(null);
  useEffect(() => {
    const saved = localStorage.getItem("chatbridge_grade");
    if (saved) { setGradeBand(saved); gradeBandRef.current = saved; }
  }, []);
  const handleGradeSelect = (grade: string) => {
    setGradeBand(grade);
    gradeBandRef.current = grade;
    localStorage.setItem("chatbridge_grade", grade);
  };

  const {
    conversations,
    activeConversationId,
    loading: conversationsLoading,
    loadConversations,
    createConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
  } = useConversations();

  // Keep a ref so the transport body function always sees the latest conversationId
  const activeConvIdRef = useRef(activeConversationId);
  activeConvIdRef.current = activeConversationId;
  activeAppRef.current = activeApp;

  // Memoize transport so useChat doesn't re-create on every render
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          conversationId: activeConvIdRef.current,
          gradeBand: gradeBandRef.current,
          // Pass active app state so the API can inject it into system prompt
          appContext: appStateRef.current
            ? {
                appId: activeAppRef.current?.appId,
                ...appStateRef.current,
              }
            : null,
        }),
      }),
    []
  );

  const { messages, setMessages, sendMessage, status } = useChat({ transport });

  const isLoading = status === "streaming" || status === "submitted";
  const isLoadingRef = useRef(false);
  isLoadingRef.current = isLoading;
  const initializedRef = useRef(false);

  // On mount, load conversations from API and create one if empty
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    (async () => {
      await loadConversations();
    })();
  }, [loadConversations]);

  // If conversations loaded but none exist, create an initial one
  useEffect(() => {
    if (initializedRef.current && !conversationsLoading && conversations.length === 0 && !activeConversationId) {
      createConversation("New Chat");
    }
  }, [conversationsLoading, conversations.length, activeConversationId, createConversation]);

  // Save messages to DB when streaming completes
  const prevStatusRef = useRef(status);
  const savedMessageCountRef = useRef(0);
  useEffect(() => {
    const wasStreaming = prevStatusRef.current === "streaming" || prevStatusRef.current === "submitted";
    const nowIdle = status === "ready" || status === "error";
    prevStatusRef.current = status;

    if (wasStreaming && nowIdle && activeConversationId && messages.length > savedMessageCountRef.current) {
      // Save only the new messages since last save
      const newMessages = messages.slice(savedMessageCountRef.current);
      savedMessageCountRef.current = messages.length;

      // Fire and forget — don't block UI
      for (const msg of newMessages) {
        const text = msg.parts
          ?.filter((p: any) => p.type === "text")
          .map((p: any) => p.text)
          .join("\n") || "";
        // Skip auto-move messages — they're transient context, not conversation history
        const isAutoMove = msg.role === "user" && /^\[(Move|Tic|Ludo)/.test(text);
        if (text && !isAutoMove && (msg.role === "user" || msg.role === "assistant")) {
          fetch(`/api/conversations/${activeConversationId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: msg.role, content: text }),
          }).catch(() => {});
        }
      }

      // Auto-rename conversation from first REAL user message (skip auto-move messages)
      if (messages.length >= 1) {
        const firstRealUser = messages.find((m) => {
          if (m.role !== "user") return false;
          const t = m.parts?.filter((p: any) => p.type === "text").map((p: any) => p.text).join("") || "";
          return t && !/^\[(Move|Tic|Ludo)/.test(t);
        });
        if (firstRealUser) {
          const title = (firstRealUser.parts
            ?.filter((p: any) => p.type === "text")
            .map((p: any) => p.text)
            .join(" ") || "").slice(0, 50) || "New Chat";
          const conv = conversations.find((c) => c.id === activeConversationId);
          if (conv && conv.title === "New Chat" && title !== "New Chat") {
            renameConversation(activeConversationId, title);
          }
        }
      }
    }
  }, [status, messages, activeConversationId, conversations, renameConversation]);

  // Track handled tool call IDs to prevent duplicate orchestrator invocations
  const handledToolCallsRef = useRef(new Set<string>());
  const invokingRef = useRef(false);

  // Watch messages for tool calls to detect when to show app
  useEffect(() => {
    if (activeApp || invokingRef.current) return;

    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      for (const part of msg.parts) {
        if (typeof part.type !== "string") continue;
        const detected = detectAppFromToolType(part.type);
        if (!detected) continue;

        const partAny = part as Record<string, unknown>;
        const state = partAny.state as string | undefined;
        if (state === "input-streaming") continue;

        // Deduplicate by toolCallId
        const toolCallId = (partAny.toolCallId as string) || `${msg.id}-${part.type}`;
        if (handledToolCallsRef.current.has(toolCallId)) continue;
        handledToolCallsRef.current.add(toolCallId);

        const toolInput = (partAny.input ?? partAny.args ?? {}) as Record<string, unknown>;
        console.log("[ChatBridge] Tool detected:", detected.toolName, "input:", toolInput);

        invokingRef.current = true;
        fetch("/api/orchestrator/invoke", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toolName: detected.toolName,
            args: toolInput,
            conversationId: activeConversationId,
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.allowed) {
              setActiveApp({
                appId: data.appId,
                appName: data.appName,
                appIcon: data.appIcon,
                toolName: detected.toolName,
                args: toolInput,
                sessionId: data.appSessionId,
                entrypointUrl: data.entrypointUrl,
                sandboxFlags: data.sandboxFlags,
                capabilityToken: data.capabilityToken,
              });
            } else {
              console.warn("[ChatBridge] App not allowed:", data.reason);
            }
          })
          .catch((err) => console.error("[ChatBridge] Orchestrator error:", err))
          .finally(() => { invokingRef.current = false; });

        return;
      }
    }
  }, [messages, activeApp, activeConversationId]);

  const handleSubmit = useCallback(
    (text?: string) => {
      const msg = text || input;
      if (!msg.trim() || isLoading) return;

      sendMessage({
        role: "user",
        parts: [{ type: "text", text: msg }],
      });
      setInput("");
    },
    [input, isLoading, sendMessage]
  );

  const handleNewConversation = useCallback(async () => {
    await createConversation("New Chat");
    setMessages([]);
    setActiveApp(null);
    savedMessageCountRef.current = 0;
    gameCompletedRef.current = false;
    prevMoveCountRef.current = 0;
    prevPgnRef.current = "";
    prevBoardRef.current = null;
    autoCommentingRef.current = false;
  }, [createConversation, setMessages]);

  const handleSelectConversation = useCallback(
    async (id: string) => {
      const dbMessages = await selectConversation(id);
      savedMessageCountRef.current = 0; // Reset save counter for new conversation
      if (dbMessages.length > 0) {
        const uiMsgs = dbMessages.map(dbMessageToUIMessage);
        setMessages(uiMsgs);
        savedMessageCountRef.current = uiMsgs.length; // Don't re-save loaded messages
      } else {
        setMessages([]);
      }
      setActiveApp(null);
      gameCompletedRef.current = false;
      prevMoveCountRef.current = 0;
      prevPgnRef.current = "";
    },
    [selectConversation, setMessages]
  );

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      await deleteConversation(id);
      // If deleted the active conversation, clear messages
      if (id === activeConversationId) {
        setMessages([]);
        setActiveApp(null);
      }
    },
    [deleteConversation, activeConversationId, setMessages]
  );

  // Store latest app state for context injection into chat
  const appStateRef = useRef<Record<string, unknown> | null>(null);
  const prevMoveCountRef = useRef<number>(0);
  const prevPgnRef = useRef<string>("");
  const prevBoardRef = useRef<string[] | null>(null);
  const autoCommentingRef = useRef(false);

  const TTT_LABELS = ["top-left","top-center","top-right","middle-left","center","middle-right","bottom-left","bottom-center","bottom-right"];

  const handleAppStateUpdate = useCallback((state: Record<string, unknown>) => {
    const prevState = appStateRef.current;
    appStateRef.current = state;

    // --- Auto-send game state to AI after each move ---
    const appId = activeAppRef.current?.appId;
    if (!appId) return;

    // Don't send while AI is still responding or if game just completed
    if (autoCommentingRef.current || gameCompletedRef.current) return;

    let newMove: string | null = null;

    if (appId === "chess") {
      const pgn = state.pgn as string || "";
      const prevPgn = prevPgnRef.current;
      const moveCount = state.moveCount as number || 0;
      if (pgn && pgn !== prevPgn && moveCount > prevMoveCountRef.current) {
        const newPart = pgn.slice(prevPgn.length).trim();
        if (newPart) {
          const turn = state.turn as string;
          const isCheck = state.isCheck as boolean;
          newMove = `[Move ${moveCount}: ${newPart}${isCheck ? " — check!" : ""}. It's now ${turn}'s turn.]`;
        }
        prevMoveCountRef.current = moveCount;
        prevPgnRef.current = pgn;
      }
    } else if (appId === "tictactoe") {
      const moveCount = state.moveCount as number || 0;
      const board = state.board as string[] | undefined;
      if (moveCount > prevMoveCountRef.current && moveCount > 0 && board) {
        // Diff the board to find exactly which position changed and who played
        const prev = prevBoardRef.current;
        let moveDesc = "";
        if (prev) {
          for (let i = 0; i < 9; i++) {
            if (board[i] !== prev[i] && (board[i] === "X" || board[i] === "O")) {
              moveDesc = `${board[i]} placed at ${TTT_LABELS[i]} (position ${i})`;
              break;
            }
          }
        }
        const turn = state.currentTurn as string;
        const boardVisual = `${board[0]}|${board[1]}|${board[2]}  ${board[3]}|${board[4]}|${board[5]}  ${board[6]}|${board[7]}|${board[8]}`;
        newMove = `[Tic Tac Toe move ${moveCount}: ${moveDesc || "move made"}. Board: ${boardVisual}. It's now ${turn}'s turn.]`;
        prevMoveCountRef.current = moveCount;
        prevBoardRef.current = [...board];
      } else if (board && !prevBoardRef.current) {
        // Initial board state
        prevBoardRef.current = [...board];
      }
    } else if (appId === "ludo") {
      const turnCount = state.turnCount as number || 0;
      if (turnCount > prevMoveCountRef.current) {
        const turn = state.currentTurn as string;
        const dice = state.diceValue as number | null;
        const players = state.players as Array<{ color: string; finishedCount: number }> | undefined;
        const progress = players ? players.map(p => `${p.color}: ${p.finishedCount}/4 home`).join(", ") : "";
        newMove = `[Ludo turn ${turnCount}: ${turn}'s turn${dice ? `, rolled ${dice}` : ""}. Progress: ${progress}]`;
        prevMoveCountRef.current = turnCount;
      }
    }

    if (newMove && !isLoadingRef.current) {
      autoCommentingRef.current = true;
      setTimeout(() => {
        sendMessage({
          role: "user",
          parts: [{ type: "text", text: newMove! }],
        });
        autoCommentingRef.current = false;
      }, 600);
    }
  }, [sendMessage]);

  const gameCompletedRef = useRef(false);

  const handleAppComplete = useCallback(
    (result: Record<string, unknown>, appId: string) => {
      // Prevent double-firing for games with game-over modals
      const gamesWithModals = ["chess", "tictactoe", "ludo"];
      if (gameCompletedRef.current && gamesWithModals.includes(appId)) return;
      if (gamesWithModals.includes(appId)) gameCompletedRef.current = true;

      // Don't close the panel for games — let user see the game over modal
      if (!gamesWithModals.includes(appId)) setActiveApp(null);

      // Build a clean, human-readable summary
      let summary: string;
      if (appId === "chess") {
        const winner = result.winner as string;
        const moves = result.totalMoves as number;
        const opponent = result.opponent as string || "Computer";
        const resigned = result.resigned as boolean;
        if (resigned) {
          summary = `I resigned my chess game against ${opponent} after ${moves} moves.`;
        } else if (winner === "draw") {
          summary = `My chess game against ${opponent} ended in a draw after ${moves} moves.`;
        } else {
          const won = (winner === "white" && playerColorRef.current === "white") ||
                      (winner === "black" && playerColorRef.current === "black");
          summary = won
            ? `I won my chess game against ${opponent} in ${moves} moves! Can you analyze the game?`
            : `I lost my chess game against ${opponent} after ${moves} moves. Any tips?`;
        }
      } else if (appId === "tictactoe") {
        const winner = result.winner as string;
        const moves = result.totalMoves as number;
        const marker = result.playerMarker as string || "X";
        if (winner === "player") {
          summary = `I won my Tic Tac Toe game as ${marker} in ${moves} moves! Can you review the game?`;
        } else if (winner === "draw") {
          summary = `My Tic Tac Toe game ended in a draw after ${moves} moves. Any tips on how to win?`;
        } else {
          summary = `I lost my Tic Tac Toe game as ${marker} after ${moves} moves. What could I have done better?`;
        }
      } else if (appId === "ludo") {
        const winner = result.winner as string;
        const playerWon = result.playerWon as boolean;
        const turns = result.turnCount as number;
        summary = playerWon
          ? `I won my Ludo game as ${winner} in ${turns} turns! That was fun!`
          : `I lost my Ludo game after ${turns} turns. Any strategy tips?`;
      } else if (appId === "weather") {
        const loc = result.location as string || "the location";
        summary = `I checked the weather for ${loc}.`;
      } else if (appId === "spotify") {
        const name = result.playlistName as string || "a playlist";
        summary = `I created a Spotify playlist called "${name}".`;
      } else {
        summary = `I finished using the ${appId} app.`;
      }

      // Include game data in app context for the AI to analyze
      if (appId === "chess" && result.pgn) {
        appStateRef.current = {
          ...appStateRef.current,
          pgn: result.pgn,
          gameOver: true,
          winner: result.winner,
        };
      } else if (appId === "tictactoe") {
        appStateRef.current = {
          ...appStateRef.current,
          gameOver: true,
          winner: result.winner,
          board: result.board,
          playerMarker: result.playerMarker,
          totalMoves: result.totalMoves,
        };
      } else if (appId === "ludo") {
        appStateRef.current = {
          ...appStateRef.current,
          gameOver: true,
          winner: result.winner,
          playerWon: result.playerWon,
          turnCount: result.turnCount,
        };
      }

      sendMessage({
        role: "user",
        parts: [{ type: "text", text: summary }],
      });
    },
    [sendMessage]
  );

  // Track player color for game result messages
  const playerColorRef = useRef("white");
  useEffect(() => {
    if (activeApp?.appId === "chess") {
      playerColorRef.current = (activeApp.args.color as string)?.toLowerCase() === "black" ? "black" : "white";
    }
  }, [activeApp]);

  const handleCloseApp = useCallback(() => {
    setActiveApp(null);
    gameCompletedRef.current = false;
    prevMoveCountRef.current = 0;
    prevPgnRef.current = "";
    prevBoardRef.current = null;
  }, []);

  // Show grade selector for students who haven't picked yet
  if (!gradeBand && userRole !== "teacher" && userRole !== "admin") {
    return <GradeSelector onSelect={handleGradeSelect} />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        conversations={conversations}
        activeId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={renameConversation}
      />

      <main className="flex flex-1 overflow-hidden">
        {/* Chat Column */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <ChatMessages
            messages={messages}
            isLoading={isLoading}
            activeApp={activeApp?.appId || null}
            onSuggestionClick={handleSubmit}
          />
          <ChatInput
            input={input}
            isLoading={isLoading}
            onInputChange={setInput}
            onSubmit={() => handleSubmit()}
          />
        </div>

        {/* App Panel (slides in from right) — unified iframe runtime */}
        {activeApp && (
          <div className="w-full sm:w-[420px] lg:w-[520px] shrink-0 border-l border-zinc-800 bg-zinc-950 overflow-hidden h-full">
            <AppRuntime
              appId={activeApp.appId}
              appName={activeApp.appName}
              appIcon={activeApp.appIcon}
              entrypointUrl={activeApp.entrypointUrl}
              sandboxFlags={activeApp.sandboxFlags}
              sessionId={activeApp.sessionId}
              capabilityToken={activeApp.capabilityToken}
              toolInvocation={{ toolName: activeApp.toolName, args: activeApp.args }}
              onStateUpdate={handleAppStateUpdate}
              onComplete={(r) => handleAppComplete(r, activeApp.appId)}
              onError={(err) => console.error("App error:", err)}
              onClose={handleCloseApp}
            />
          </div>
        )}
      </main>

      {/* Teacher Controls Button — only visible to teachers/admins */}
      {canAccessTeacherControls && (
        <button
          onClick={() => setTeacherControlsOpen(true)}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 shadow-lg transition-colors hover:border-violet-600/40 hover:bg-zinc-800 hover:text-zinc-100"
        >
          <Shield className="h-4 w-4 text-violet-400" />
          Teacher Controls
        </button>
      )}

      {/* Teacher Controls Modal */}
      {teacherControlsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-violet-400" />
                <h2 className="text-lg font-semibold text-zinc-100">Teacher Controls</h2>
              </div>
              <button
                onClick={() => setTeacherControlsOpen(false)}
                className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <h3 className="text-sm font-medium text-zinc-300 mb-2">Enabled Apps</h3>
                <p className="text-xs text-zinc-500 mb-3">
                  Control which apps are available for students in this class.
                </p>
                <div className="space-y-2">
                  {["chess", "tictactoe", "ludo", "weather", "spotify"].map((appId) => (
                    <label key={appId} className="flex items-center gap-3 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-violet-500 focus:ring-violet-500 focus:ring-offset-0"
                      />
                      <span className="capitalize">{appId}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <h3 className="text-sm font-medium text-zinc-300 mb-2">Session Limits</h3>
                <p className="text-xs text-zinc-500 mb-3">
                  Set time and usage limits per app session.
                </p>
                <div className="flex items-center gap-3">
                  <label className="text-xs text-zinc-400">Max session duration</label>
                  <select className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                    <option>15 minutes</option>
                    <option>30 minutes</option>
                    <option>1 hour</option>
                    <option>No limit</option>
                  </select>
                </div>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <h3 className="text-sm font-medium text-zinc-300 mb-2">Content Moderation</h3>
                <p className="text-xs text-zinc-500 mb-3">
                  All app interactions are logged for review.
                </p>
                <div className="flex items-center gap-2 text-xs text-green-400">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  Moderation active
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setTeacherControlsOpen(false)}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
