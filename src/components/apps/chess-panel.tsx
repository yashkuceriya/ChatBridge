"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { X, RotateCcw, Flag, Star, Crown, Handshake } from "lucide-react";
import { findBestMove, evaluatePosition, BOT_PROFILES, type BotProfile } from "@/lib/chess-engine";

interface ChessPanelProps {
  sessionId: string;
  args: Record<string, unknown>;
  onStateUpdate: (state: Record<string, unknown>) => void;
  onComplete: (result: Record<string, unknown>) => void;
  onClose: () => void;
  onAskTutor?: (question: string) => void;
}

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const PIECE_UNICODE: Record<string, string> = {
  wp: "\u2659", wn: "\u2658", wb: "\u2657", wr: "\u2656", wq: "\u2655",
  bp: "\u265F", bn: "\u265E", bb: "\u265D", br: "\u265C", bq: "\u265B",
};

const BOT_QUOTES: Record<string, string> = {
  "Buddy": "\"I just learned how the horsey moves!\"",
  "Elena": "\"Let's have a friendly game!\"",
  "Marcus": "\"I play at my local club every week.\"",
  "Sofia": "\"Prepare for a real challenge.\"",
  "Viktor": "\"I see 10 moves ahead.\"",
  "Magnus AI": "\"Resistance is futile.\"",
};

function getCapturedPieces(game: Chess) {
  const start: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const counts = { w: { ...start }, b: { ...start } };
  for (const row of game.board()) {
    for (const sq of row) {
      if (sq) counts[sq.color][sq.type]--;
    }
  }
  const captured: { white: string[]; black: string[] } = { white: [], black: [] };
  for (const [p, c] of Object.entries(counts.b)) for (let i = 0; i < c; i++) captured.white.push(`b${p}`);
  for (const [p, c] of Object.entries(counts.w)) for (let i = 0; i < c; i++) captured.black.push(`w${p}`);
  return captured;
}

function getMaterialAdv(captured: { white: string[]; black: string[] }) {
  const w = captured.white.reduce((s, p) => s + (PIECE_VALUES[p[1]] || 0), 0);
  const b = captured.black.reduce((s, p) => s + (PIECE_VALUES[p[1]] || 0), 0);
  return w - b;
}

// Convert centipawn evaluation to a percentage for the eval bar (0-100, from white's perspective)
function evalToPercent(evalScore: number): number {
  // Use sigmoid-like function to map eval to percentage
  // Clamp extreme values
  if (evalScore > 9000) return 98;
  if (evalScore < -9000) return 2;
  const pawnUnits = evalScore / 100;
  // Sigmoid mapping: 50 + 50 * tanh(eval / 4)
  const percent = 50 + 50 * Math.tanh(pawnUnits / 4);
  return Math.max(2, Math.min(98, percent));
}

function formatEval(evalScore: number): string {
  if (evalScore > 9000) return "M" + Math.ceil((99999 - evalScore) / 2);
  if (evalScore < -9000) return "M" + Math.ceil((99999 + evalScore) / 2);
  const pawnUnits = evalScore / 100;
  const sign = pawnUnits > 0 ? "+" : "";
  return `${sign}${pawnUnits.toFixed(1)}`;
}

// ========== Evaluation Bar ==========
function EvalBar({ evalScore, orientation }: { evalScore: number; orientation: "white" | "black" }) {
  const whitePercent = evalToPercent(evalScore);
  // If board is flipped (playing as black), white is at top, black at bottom
  const bottomPercent = orientation === "white" ? whitePercent : (100 - whitePercent);
  const evalText = formatEval(evalScore);
  const isWhiteWinning = evalScore >= 0;

  return (
    <div className="relative flex flex-col w-5 h-full rounded overflow-hidden select-none" style={{ minHeight: "100%" }}>
      {/* Black section (top) */}
      <div
        className="bg-zinc-800 transition-all duration-700 ease-out relative"
        style={{ flexGrow: 100 - bottomPercent }}
      >
        {!isWhiteWinning && (
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold text-zinc-400 whitespace-nowrap">
            {evalText}
          </span>
        )}
      </div>
      {/* White section (bottom) */}
      <div
        className="bg-zinc-100 transition-all duration-700 ease-out relative"
        style={{ flexGrow: bottomPercent }}
      >
        {isWhiteWinning && (
          <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[8px] font-bold text-zinc-700 whitespace-nowrap">
            {evalText}
          </span>
        )}
      </div>
    </div>
  );
}

// ========== Game Over Modal ==========
function GameOverModal({
  game,
  playerColor,
  selectedBot,
  moveCount,
  onPlayAgain,
  onNewOpponent,
}: {
  game: Chess;
  playerColor: "white" | "black";
  selectedBot: BotProfile;
  moveCount: number;
  onPlayAgain: () => void;
  onNewOpponent: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  let result: "win" | "loss" | "draw";
  let resultText: string;
  let ResultIcon: typeof Crown;

  if (game.isCheckmate()) {
    const loser = game.turn(); // the side that is checkmated
    const playerSide = playerColor === "white" ? "w" : "b";
    if (loser === playerSide) {
      result = "loss";
      resultText = "You lost";
      ResultIcon = X;
    } else {
      result = "win";
      resultText = "You won!";
      ResultIcon = Crown;
    }
  } else {
    result = "draw";
    resultText = "Draw";
    ResultIcon = Handshake;
  }

  const iconColors = {
    win: "text-yellow-400",
    loss: "text-red-400",
    draw: "text-zinc-400",
  };

  const bgColors = {
    win: "from-yellow-900/30 to-zinc-900",
    loss: "from-red-900/30 to-zinc-900",
    draw: "from-zinc-800/50 to-zinc-900",
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-md">
      <div
        className={`bg-gradient-to-b ${bgColors[result]} border border-zinc-700 rounded-xl p-5 mx-4 w-full max-w-[260px] text-center shadow-2xl transition-all duration-300 ${
          visible ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
      >
        <div className={`inline-flex items-center justify-center h-14 w-14 rounded-full bg-zinc-800/80 mb-3 ${iconColors[result]}`}>
          <ResultIcon className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-bold text-zinc-100 mb-1">{resultText}</h3>
        <p className="text-xs text-zinc-400 mb-0.5">
          vs {selectedBot.avatar} {selectedBot.name}
          <span className="ml-1.5 text-[10px] font-mono bg-zinc-800 px-1.5 py-0.5 rounded">{selectedBot.rating}</span>
        </p>
        <p className="text-[10px] text-zinc-500 mb-4">{moveCount} moves played</p>

        <div className="flex gap-2">
          <button
            onClick={onPlayAgain}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-500 py-2.5 text-xs font-semibold text-white transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Play Again
          </button>
          <button
            onClick={onNewOpponent}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 py-2.5 text-xs font-semibold text-zinc-200 transition-colors"
          >
            New Opponent
          </button>
        </div>
      </div>
    </div>
  );
}

// ========== Resign Confirmation ==========
function ResignConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-md">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 mx-4 w-full max-w-[240px] text-center shadow-2xl">
        <Flag className="h-8 w-8 text-red-400 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-zinc-100 mb-1">Resign Game?</h3>
        <p className="text-xs text-zinc-400 mb-4">Are you sure you want to resign?</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 py-2 text-xs font-semibold text-zinc-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-red-600 hover:bg-red-500 py-2 text-xs font-semibold text-white transition-colors"
          >
            Resign
          </button>
        </div>
      </div>
    </div>
  );
}

// ========== Bot Selection Screen ==========
function BotSelector({ onSelect, playerColor }: { onSelect: (bot: BotProfile) => void; playerColor: "white" | "black" }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-100">Choose Your Opponent</h3>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs text-zinc-500">Playing as</span>
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
            playerColor === "white"
              ? "bg-zinc-100 text-zinc-900"
              : "bg-zinc-700 text-zinc-100"
          }`}>
            <span className={`h-2.5 w-2.5 rounded-full ${playerColor === "white" ? "bg-white border border-zinc-300" : "bg-zinc-900 border border-zinc-600"}`} />
            {playerColor === "white" ? "White" : "Black"}
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-2">
          {BOT_PROFILES.map((bot, idx) => {
            const difficulty = Math.ceil((idx + 1) * (5 / BOT_PROFILES.length));
            const isSelected = selected === bot.name;
            const ratingColor =
              bot.rating < 600 ? "bg-green-700 text-green-100" :
              bot.rating < 1000 ? "bg-blue-700 text-blue-100" :
              bot.rating < 1400 ? "bg-yellow-700 text-yellow-100" :
              bot.rating < 1800 ? "bg-orange-700 text-orange-100" :
              bot.rating < 2200 ? "bg-red-700 text-red-100" :
              "bg-purple-700 text-purple-100";

            return (
              <button
                key={bot.name}
                onClick={() => {
                  setSelected(bot.name);
                  // Small delay for visual feedback
                  setTimeout(() => onSelect(bot), 200);
                }}
                className={`relative flex flex-col items-center rounded-xl border p-3 text-center transition-all duration-200 hover:scale-[1.03] ${
                  isSelected
                    ? "border-green-500 bg-green-900/20 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                    : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-900"
                }`}
              >
                <div className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center text-2xl mb-2 transition-transform group-hover:scale-110">
                  {bot.avatar}
                </div>
                <span className="text-xs font-bold text-zinc-200 mb-0.5">{bot.name}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full mb-1.5 ${ratingColor}`}>
                  {bot.rating}
                </span>
                <div className="flex gap-0.5 mb-1.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={`h-2.5 w-2.5 ${
                        i < difficulty ? "text-yellow-400 fill-yellow-400" : "text-zinc-700"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[9px] text-zinc-500 italic leading-tight">
                  {BOT_QUOTES[bot.name] || bot.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ========== Main Chess Panel ==========
export function ChessPanel({ sessionId, args, onStateUpdate, onComplete, onClose, onAskTutor }: ChessPanelProps) {
  const playerColor: "white" | "black" = (args.color as string)?.toLowerCase() === "black" ? "black" : "white";
  const computerSide = playerColor === "white" ? "b" : "w";

  const [selectedBot, setSelectedBot] = useState<BotProfile | null>(null);
  const [game, setGame] = useState(() => new Chess());
  const [gameOver, setGameOver] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [moveHistory, setMoveHistory] = useState<{ white: string; black: string }[]>([]);
  const [positionHistory, setPositionHistory] = useState<string[]>([]);
  const [viewingMoveIndex, setViewingMoveIndex] = useState<number | null>(null);
  const [evalScore, setEvalScore] = useState(0);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const [resigned, setResigned] = useState(false);
  const pendingRef = useRef(false);
  const moveListRef = useRef<HTMLDivElement>(null);

  const captured = useMemo(() => getCapturedPieces(game), [game.fen()]);
  const materialAdv = useMemo(() => getMaterialAdv(captured), [captured]);
  const isPlayerTurn = game.turn() !== computerSide && !gameOver && !thinking;

  // Update eval when position changes
  useEffect(() => {
    try {
      const ev = evaluatePosition(game.fen());
      setEvalScore(ev);
    } catch {
      // ignore eval errors
    }
  }, [game.fen()]);

  const statusText = gameOver
    ? resigned ? "You resigned"
    : game.isCheckmate()
      ? `Checkmate! ${game.turn() === "w" ? "Black" : "White"} wins!`
      : game.isDraw() ? "Draw!" : "Game over"
    : thinking ? `${selectedBot?.name || "Computer"} is thinking...`
    : isPlayerTurn ? (game.isCheck() ? "Your turn — Check!" : "Your turn")
    : "Opponent's turn";

  // Square highlighting
  const squareStyles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {};
    if (lastMove) {
      s[lastMove.from] = { backgroundColor: "rgba(255, 255, 0, 0.35)" };
      s[lastMove.to] = { backgroundColor: "rgba(255, 255, 0, 0.35)" };
    }
    if (game.isCheck()) {
      for (const row of game.board()) {
        for (const sq of row) {
          if (sq && sq.type === "k" && sq.color === game.turn()) {
            s[sq.square] = { background: "radial-gradient(circle, rgba(255,0,0,0.6) 0%, rgba(255,0,0,0) 70%)" };
          }
        }
      }
    }
    if (selectedSquare && isPlayerTurn) {
      s[selectedSquare] = { ...s[selectedSquare], backgroundColor: "rgba(108, 92, 231, 0.5)" };
      try {
        for (const m of game.moves({ square: selectedSquare as Square, verbose: true })) {
          const isCapture = game.get(m.to as Square);
          s[m.to] = {
            ...s[m.to],
            background: isCapture
              ? "radial-gradient(circle, transparent 55%, rgba(0,0,0,0.25) 55%)"
              : "radial-gradient(circle, rgba(0,0,0,0.2) 20%, transparent 20%)",
          };
        }
      } catch {}
    }
    return s;
  }, [lastMove, game.fen(), selectedSquare, isPlayerTurn]);

  const emitState = useCallback((g: Chess) => {
    onStateUpdate({ fen: g.fen(), turn: g.turn() === "w" ? "white" : "black", isCheck: g.isCheck(), pgn: g.pgn() });
  }, [onStateUpdate]);

  const updateMoveHistory = useCallback((g: Chess) => {
    const h = g.history();
    const pairs: { white: string; black: string }[] = [];
    for (let i = 0; i < h.length; i += 2) pairs.push({ white: h[i] || "", black: h[i + 1] || "" });
    setMoveHistory(pairs);
    setViewingMoveIndex(null);
    setTimeout(() => moveListRef.current?.scrollTo({ top: 99999, behavior: "smooth" }), 50);
  }, []);

  const checkGameOver = useCallback((g: Chess) => {
    if (!g.isGameOver()) return false;
    setGameOver(true);
    onComplete({
      winner: g.isCheckmate() ? (g.turn() === "w" ? "black" : "white") : "draw",
      totalMoves: g.moveNumber(), pgn: g.pgn(),
      opponent: selectedBot?.name,
    });
    return true;
  }, [onComplete, selectedBot]);

  const doComputerMove = useCallback((cur: Chess) => {
    if (pendingRef.current || !selectedBot) return;
    pendingRef.current = true;
    setThinking(true);
    setTimeout(() => {
      const move = findBestMove(cur.fen(), selectedBot.depth, selectedBot.blunderRate);
      if (move) {
        const next = new Chess(cur.fen());
        const r = next.move(move);
        if (r) {
          setGame(next);
          setLastMove({ from: r.from, to: r.to });
          setSelectedSquare(null);
          setPositionHistory(prev => [...prev, next.fen()]);
          emitState(next);
          updateMoveHistory(next);
          checkGameOver(next);
        }
      }
      setThinking(false);
      pendingRef.current = false;
    }, 200 + Math.random() * 400);
  }, [selectedBot, emitState, updateMoveHistory, checkGameOver]);

  // Check if a move is a pawn promotion
  const isPromotion = useCallback((from: string, to: string): boolean => {
    const piece = game.get(from as Square);
    if (!piece || piece.type !== "p") return false;
    const targetRank = to[1];
    return (piece.color === "w" && targetRank === "8") || (piece.color === "b" && targetRank === "1");
  }, [game]);

  // Execute a move with a specific promotion piece
  const executeMove = useCallback((from: string, to: string, promotion: string = "q"): boolean => {
    try {
      const next = new Chess(game.fen());
      const r = next.move({ from, to, promotion });
      if (!r) return false;
      setGame(next);
      setLastMove({ from: r.from, to: r.to });
      setSelectedSquare(null);
      setPendingPromotion(null);
      setPositionHistory(prev => [...prev, next.fen()]);
      emitState(next);
      updateMoveHistory(next);
      if (!checkGameOver(next)) doComputerMove(next);
      return true;
    } catch { return false; }
  }, [game, emitState, updateMoveHistory, checkGameOver, doComputerMove]);

  const makePlayerMove = useCallback((from: string, to: string): boolean => {
    if (gameOver || thinking || game.turn() === computerSide) return false;
    if (viewingMoveIndex !== null) setViewingMoveIndex(null);

    // Check if this is a promotion — show picker instead of auto-queen
    if (isPromotion(from, to)) {
      // Verify the move is legal first
      const test = new Chess(game.fen());
      const legal = test.move({ from, to, promotion: "q" });
      if (!legal) return false;
      test.undo();
      setPendingPromotion({ from, to });
      return true;
    }

    return executeMove(from, to);
  }, [game, gameOver, thinking, computerSide, viewingMoveIndex, isPromotion, executeMove]);

  const onDrop = useCallback(({ sourceSquare, targetSquare }: { piece: unknown; sourceSquare: string; targetSquare: string | null }) => {
    return targetSquare ? makePlayerMove(sourceSquare, targetSquare) : false;
  }, [makePlayerMove]);

  const onSquareClick = useCallback(({ square }: { piece: unknown; square: string }) => {
    if (!isPlayerTurn) return;
    if (selectedSquare) {
      if (!makePlayerMove(selectedSquare, square)) {
        const p = game.get(square as Square);
        setSelectedSquare(p && p.color === game.turn() ? square : null);
      }
    } else {
      const p = game.get(square as Square);
      if (p && p.color === game.turn()) setSelectedSquare(square);
    }
  }, [selectedSquare, isPlayerTurn, makePlayerMove, game]);

  const handleMoveClick = useCallback((pairIndex: number, isBlack: boolean) => {
    const moveIdx = pairIndex * 2 + (isBlack ? 1 : 0);
    // positionHistory[0] is after first move, so moveIdx maps directly
    if (moveIdx < positionHistory.length) {
      setViewingMoveIndex(moveIdx);
    }
  }, [positionHistory]);

  const displayFen = viewingMoveIndex !== null && viewingMoveIndex < positionHistory.length
    ? positionHistory[viewingMoveIndex]
    : game.fen();

  const startGame = useCallback((bot: BotProfile) => {
    setSelectedBot(bot);
    const fresh = new Chess();
    setGame(fresh);
    setGameOver(false);
    setResigned(false);
    setThinking(false);
    setLastMove(null);
    setMoveHistory([]);
    setPositionHistory([fresh.fen()]);
    setViewingMoveIndex(null);
    setEvalScore(0);
    setShowResignConfirm(false);
    pendingRef.current = false;
    emitState(fresh);
    if (playerColor === "black") {
      setTimeout(() => {
        pendingRef.current = true;
        setThinking(true);
        setTimeout(() => {
          const move = findBestMove(fresh.fen(), bot.depth, bot.blunderRate);
          if (move) {
            const next = new Chess(fresh.fen());
            const r = next.move(move);
            if (r) {
              setGame(next);
              setLastMove({ from: r.from, to: r.to });
              setPositionHistory([fresh.fen(), next.fen()]);
              emitState(next);
              updateMoveHistory(next);
            }
          }
          setThinking(false);
          pendingRef.current = false;
        }, 400);
      }, 300);
    }
  }, [playerColor, emitState, updateMoveHistory]);

  const handleNewGame = () => setSelectedBot(null);
  const handlePlayAgain = () => {
    if (selectedBot) startGame(selectedBot);
  };
  const handleResign = () => {
    if (gameOver) return;
    setShowResignConfirm(true);
  };
  const confirmResign = () => {
    setShowResignConfirm(false);
    setResigned(true);
    setGameOver(true);
    onComplete({ winner: playerColor === "white" ? "black" : "white", resigned: true, opponent: selectedBot?.name });
  };

  // --- Bot selection screen ---
  if (!selectedBot) {
    return (
      <div className="flex flex-col h-full bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span>♟</span>
            <span className="text-sm font-semibold text-zinc-100">Chess</span>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <BotSelector onSelect={startGame} playerColor={playerColor} />
      </div>
    );
  }

  // --- Player bar ---
  const PlayerBar = ({ color, isTop }: { color: "white" | "black"; isTop: boolean }) => {
    const isComp = (color === "white" && computerSide === "w") || (color === "black" && computerSide === "b");
    const name = isComp ? selectedBot.name : "You";
    const caps = color === "white" ? captured.white : captured.black;
    const adv = color === "white" ? materialAdv : -materialAdv;
    const active = !gameOver && game.turn() === (color === "white" ? "w" : "b");

    return (
      <div className={`flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors ${active ? "bg-zinc-800" : "bg-zinc-900/50"}`}>
        <div className="flex items-center gap-2">
          <div className={`h-7 w-7 rounded-full flex items-center justify-center text-sm ${
            isComp ? "bg-zinc-700" : "bg-green-700 text-white"
          }`}>
            {isComp ? selectedBot.avatar : "Y"}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-zinc-200">{name}</span>
              {isComp && <span className="text-[9px] text-zinc-500 font-mono">{selectedBot.rating}</span>}
              {active && !gameOver && <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />}
            </div>
            <div className="flex items-center gap-0.5 min-h-[14px]">
              {caps.map((p, i) => (
                <span key={i} className="text-[10px] leading-none opacity-70">{PIECE_UNICODE[p] || ""}</span>
              ))}
              {adv > 0 && <span className="text-[9px] text-zinc-500 ml-1">+{adv}</span>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- Annotate moves ---
  const annotateMove = (san: string) => {
    if (!san) return null;
    const isCapture = san.includes("x");
    const isCheck = san.includes("+");
    const isCheckmate = san.includes("#");

    return (
      <span className={`font-mono ${isCheckmate ? "text-yellow-400 font-bold" : isCapture ? "text-red-400" : isCheck ? "text-zinc-200 font-bold" : "text-zinc-300"}`}>
        {san}
        {isCheckmate && <Star className="inline h-2.5 w-2.5 ml-0.5 text-yellow-400 fill-yellow-400" />}
      </span>
    );
  };

  const totalMoves = moveHistory.reduce((c, p) => c + (p.white ? 1 : 0) + (p.black ? 1 : 0), 0);

  // --- Game screen ---
  return (
    <div className="relative flex flex-col h-full bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span>♟</span>
          <span className="text-sm font-semibold text-zinc-100">Chess</span>
          {!gameOver ? (
            <span className="rounded-full bg-green-900/50 px-2 py-0.5 text-[10px] font-medium text-green-400">Live</span>
          ) : (
            <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] font-medium text-zinc-400">Finished</span>
          )}
          <span className="text-[10px] text-zinc-600">vs {selectedBot.name}</span>
        </div>
        <button onClick={onClose} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-1.5 text-center">
          <span className={`text-xs font-medium ${gameOver ? "text-amber-400" : thinking ? "text-green-400" : "text-zinc-400"}`}>
            {thinking && <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse mr-1.5 align-middle" />}
            {statusText}
          </span>
        </div>

        <div className="px-3 flex flex-col gap-1.5">
          <PlayerBar color={playerColor === "white" ? "black" : "white"} isTop />

          {/* Board + Eval bar container */}
          <div className="flex gap-1.5">
            {/* Evaluation Bar */}
            <div className="w-5 flex-shrink-0" style={{ aspectRatio: "auto" }}>
              <div className="h-full">
                <EvalBar evalScore={evalScore} orientation={playerColor} />
              </div>
            </div>

            {/* Chess Board */}
            <div className={`relative flex-1 aspect-square rounded-md overflow-hidden transition-shadow duration-500 ${thinking && !gameOver ? "ring-2 ring-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.15)]" : ""}`}
              style={{ transition: "box-shadow 0.3s" }}
            >
              <Chessboard options={{
                position: displayFen,
                onPieceDrop: onDrop,
                onSquareClick: onSquareClick as any,
                boardOrientation: playerColor,
                animationDurationInMs: 150,
                showNotation: true,
                squareStyles,
                canDragPiece: ({ piece }: any) => {
                  if (!isPlayerTurn || viewingMoveIndex !== null) return false;
                  const c = piece?.pieceType?.[0]?.toLowerCase();
                  return c === (playerColor === "white" ? "w" : "b");
                },
                boardStyle: { borderRadius: "6px" },
                darkSquareStyle: { backgroundColor: "#779952" },
                lightSquareStyle: { backgroundColor: "#edeed1" },
              }} />

              {/* Promotion Picker Overlay */}
              {pendingPromotion && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-md">
                  <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 shadow-2xl">
                    <p className="text-xs text-zinc-400 text-center mb-2 font-medium">Promote to:</p>
                    <div className="flex gap-2">
                      {(["q", "r", "b", "n"] as const).map((piece) => {
                        const icons: Record<string, string> = {
                          q: playerColor === "white" ? "\u2655" : "\u265B",
                          r: playerColor === "white" ? "\u2656" : "\u265C",
                          b: playerColor === "white" ? "\u2657" : "\u265D",
                          n: playerColor === "white" ? "\u2658" : "\u265E",
                        };
                        const labels: Record<string, string> = { q: "Queen", r: "Rook", b: "Bishop", n: "Knight" };
                        return (
                          <button
                            key={piece}
                            onClick={() => executeMove(pendingPromotion.from, pendingPromotion.to, piece)}
                            className="flex flex-col items-center gap-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 p-2.5 min-w-[56px] transition-colors border border-zinc-700 hover:border-green-500/50"
                            title={labels[piece]}
                          >
                            <span className="text-3xl leading-none">{icons[piece]}</span>
                            <span className="text-[9px] text-zinc-500">{labels[piece]}</span>
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setPendingPromotion(null)}
                      className="mt-2 w-full text-center text-[10px] text-zinc-500 hover:text-zinc-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <PlayerBar color={playerColor} isTop={false} />
        </div>

        {/* Viewing indicator */}
        {viewingMoveIndex !== null && (
          <div className="mx-3 mt-1 text-center">
            <button
              onClick={() => setViewingMoveIndex(null)}
              className="text-[10px] text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-full hover:bg-amber-900/50 transition-colors"
            >
              Viewing move {viewingMoveIndex + 1} — click to return to current position
            </button>
          </div>
        )}

        {/* Move history */}
        <div className="flex-1 min-h-0 mt-2 mx-3 mb-2 rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden flex flex-col">
          <div className="px-3 py-1.5 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Moves</span>
            {moveHistory.length > 0 && (
              <span className="text-[10px] text-zinc-600">{totalMoves} moves</span>
            )}
          </div>
          <div ref={moveListRef} className="flex-1 overflow-y-auto px-1 py-1">
            {moveHistory.length === 0
              ? <div className="text-center py-3 text-xs text-zinc-600">No moves yet</div>
              : moveHistory.map((pair, i) => {
                  const isLastPair = i === moveHistory.length - 1;
                  return (
                    <div
                      key={i}
                      className={`flex items-center text-xs py-0.5 px-2 rounded transition-colors ${
                        isLastPair ? "bg-zinc-800/70" : "hover:bg-zinc-800/30"
                      }`}
                    >
                      <span className="w-6 text-zinc-600 font-mono text-[10px]">{i + 1}.</span>
                      <button
                        onClick={() => handleMoveClick(i, false)}
                        className={`w-16 text-left cursor-pointer hover:bg-zinc-700/50 px-1 rounded transition-colors ${
                          viewingMoveIndex === i * 2 ? "bg-green-800/40 rounded" : ""
                        }`}
                      >
                        {annotateMove(pair.white)}
                      </button>
                      <button
                        onClick={() => pair.black ? handleMoveClick(i, true) : undefined}
                        className={`w-16 text-left cursor-pointer hover:bg-zinc-700/50 px-1 rounded transition-colors ${
                          viewingMoveIndex === i * 2 + 1 ? "bg-green-800/40 rounded" : ""
                        }`}
                      >
                        {annotateMove(pair.black)}
                      </button>
                    </div>
                  );
                })}
          </div>
        </div>

        {/* Tutor Help Buttons */}
        {onAskTutor && !gameOver && (
          <div className="px-3 pb-2 flex gap-1.5">
            <button
              onClick={() => onAskTutor("What should I do here? Give me a hint.")}
              className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-violet-600/20 border border-violet-500/30 py-1.5 text-[11px] font-medium text-violet-300 hover:bg-violet-600/30 transition-colors"
            >
              💡 Hint
            </button>
            <button
              onClick={() => onAskTutor("Explain the current position. What are the key ideas for both sides?")}
              className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-violet-600/20 border border-violet-500/30 py-1.5 text-[11px] font-medium text-violet-300 hover:bg-violet-600/30 transition-colors"
            >
              🔍 Explain
            </button>
            <button
              onClick={() => onAskTutor("Was my last move good? What would have been better?")}
              className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-violet-600/20 border border-violet-500/30 py-1.5 text-[11px] font-medium text-violet-300 hover:bg-violet-600/30 transition-colors"
            >
              📝 Review
            </button>
          </div>
        )}

        {/* Game Over Tutor */}
        {onAskTutor && gameOver && (
          <div className="px-3 pb-2">
            <button
              onClick={() => onAskTutor("The game just ended. Please review the key moments — what did I do well and what should I improve?")}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 py-2 text-xs font-medium text-violet-300 hover:bg-violet-600/30 transition-colors"
            >
              🎓 Get Game Review from Tutor
            </button>
          </div>
        )}

        <div className="px-3 pb-3 flex gap-2">
          <button onClick={handleNewGame}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-green-700 py-2 text-xs font-medium text-white hover:bg-green-600 transition-colors">
            <RotateCcw className="h-3.5 w-3.5" /> New Game
          </button>
          <button onClick={handleResign} disabled={gameOver}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-zinc-800 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 transition-colors">
            <Flag className="h-3.5 w-3.5" /> Resign
          </button>
        </div>
      </div>

      {/* Game Over Modal Overlay */}
      {gameOver && selectedBot && (
        <GameOverModal
          game={game}
          playerColor={playerColor}
          selectedBot={selectedBot}
          moveCount={totalMoves}
          onPlayAgain={handlePlayAgain}
          onNewOpponent={handleNewGame}
        />
      )}

      {/* Resign Confirmation Overlay */}
      {showResignConfirm && (
        <ResignConfirm
          onConfirm={confirmResign}
          onCancel={() => setShowResignConfirm(false)}
        />
      )}
    </div>
  );
}
