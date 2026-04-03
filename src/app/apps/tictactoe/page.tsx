"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { RotateCcw, Crown, X, Minus } from "lucide-react";
import { ChatBridgeSDK } from "@/lib/app-sdk";

// ========== Types & Constants ==========

type Marker = "X" | "O" | null;
type Board = Marker[];
type Difficulty = "easy" | "medium" | "hard";

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],            // diags
];

const EMPTY_BOARD: Board = Array(9).fill(null);

const POSITION_LABELS = [
  "top-left", "top-center", "top-right",
  "middle-left", "center", "middle-right",
  "bottom-left", "bottom-center", "bottom-right",
];

// ========== AI Engine ==========

function checkWinner(board: Board): { winner: Marker; line: number[] | null } {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  return { winner: null, line: null };
}

function getAvailableMoves(board: Board): number[] {
  return board.reduce<number[]>((acc, cell, i) => (cell === null ? [...acc, i] : acc), []);
}

function minimax(board: Board, isMaximizing: boolean, aiMarker: Marker, playerMarker: Marker): number {
  const { winner } = checkWinner(board);
  if (winner === aiMarker) return 10;
  if (winner === playerMarker) return -10;
  if (getAvailableMoves(board).length === 0) return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (const i of getAvailableMoves(board)) {
      board[i] = aiMarker;
      best = Math.max(best, minimax(board, false, aiMarker, playerMarker));
      board[i] = null;
    }
    return best;
  } else {
    let best = Infinity;
    for (const i of getAvailableMoves(board)) {
      board[i] = playerMarker;
      best = Math.min(best, minimax(board, true, aiMarker, playerMarker));
      board[i] = null;
    }
    return best;
  }
}

function getAIMove(board: Board, aiMarker: Marker, playerMarker: Marker, difficulty: Difficulty): number {
  const available = getAvailableMoves(board);
  if (available.length === 0) return -1;

  // Easy: random moves
  if (difficulty === "easy") {
    return available[Math.floor(Math.random() * available.length)];
  }

  // Medium: 50% optimal, 50% random
  if (difficulty === "medium" && Math.random() < 0.5) {
    return available[Math.floor(Math.random() * available.length)];
  }

  // Hard (and 50% of medium): minimax
  let bestScore = -Infinity;
  let bestMove = available[0];
  for (const i of available) {
    const copy = [...board];
    copy[i] = aiMarker;
    const score = minimax(copy, false, aiMarker, playerMarker);
    if (score > bestScore) {
      bestScore = score;
      bestMove = i;
    }
  }
  return bestMove;
}

// ========== Difficulty Selector ==========

function DifficultySelector({
  onSelect,
  playerMarker,
}: {
  onSelect: (difficulty: Difficulty) => void;
  playerMarker: Marker;
}) {
  const difficulties: { level: Difficulty; label: string; emoji: string; desc: string }[] = [
    { level: "easy", label: "Easy", emoji: "🌱", desc: "Random moves — great for learning" },
    { level: "medium", label: "Medium", emoji: "🎯", desc: "Sometimes smart, sometimes random" },
    { level: "hard", label: "Hard", emoji: "🧠", desc: "Perfect play — can you draw?" },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-100">Choose Difficulty</h3>
        <p className="text-xs text-zinc-500 mt-1">
          Playing as <span className="font-bold text-zinc-300">{playerMarker}</span>
          {playerMarker === "X" ? " (you go first)" : " (AI goes first)"}
        </p>
      </div>
      <div className="flex-1 flex flex-col justify-center gap-3 p-4">
        {difficulties.map((d) => (
          <button
            key={d.level}
            onClick={() => onSelect(d.level)}
            className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-left transition-all hover:border-violet-600/40 hover:bg-zinc-900 hover:scale-[1.02]"
          >
            <span className="text-2xl">{d.emoji}</span>
            <div>
              <span className="text-sm font-bold text-zinc-200">{d.label}</span>
              <p className="text-xs text-zinc-500">{d.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ========== Game Over Modal ==========

function GameOverModal({
  result,
  playerMarker,
  onPlayAgain,
  onChangeDifficulty,
}: {
  result: "win" | "loss" | "draw";
  playerMarker: Marker;
  onPlayAgain: () => void;
  onChangeDifficulty: () => void;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  const config = {
    win: { text: "You won!", Icon: Crown, iconColor: "text-yellow-400", bg: "from-yellow-900/30 to-zinc-900" },
    loss: { text: "You lost!", Icon: X, iconColor: "text-red-400", bg: "from-red-900/30 to-zinc-900" },
    draw: { text: "It's a draw!", Icon: Minus, iconColor: "text-zinc-400", bg: "from-zinc-800/50 to-zinc-900" },
  }[result];

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-md">
      <div className={`bg-gradient-to-b ${config.bg} border border-zinc-700 rounded-xl p-5 mx-4 w-full max-w-[260px] text-center shadow-2xl transition-all duration-300 ${visible ? "scale-100 opacity-100" : "scale-75 opacity-0"}`}>
        <div className={`inline-flex items-center justify-center h-14 w-14 rounded-full bg-zinc-800/80 mb-3 ${config.iconColor}`}>
          <config.Icon className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-bold text-zinc-100 mb-1">{config.text}</h3>
        <p className="text-xs text-zinc-500 mb-4">Playing as {playerMarker}</p>
        <div className="flex gap-2">
          <button onClick={onPlayAgain} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-500 py-2.5 text-xs font-semibold text-white transition-colors">
            <RotateCcw className="h-3.5 w-3.5" /> Play Again
          </button>
          <button onClick={onChangeDifficulty} className="flex-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 py-2.5 text-xs font-semibold text-zinc-200 transition-colors">
            Change Level
          </button>
        </div>
      </div>
    </div>
  );
}

// ========== Main Tic Tac Toe App ==========

export default function TicTacToeApp() {
  const sdkRef = useRef<ChatBridgeSDK | null>(null);

  const [playerMarker, setPlayerMarker] = useState<"X" | "O">("X");
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [board, setBoard] = useState<Board>(EMPTY_BOARD);
  const [currentTurn, setCurrentTurn] = useState<"X" | "O">("X");
  const [gameOver, setGameOver] = useState(false);
  const [winLine, setWinLine] = useState<number[] | null>(null);
  const [result, setResult] = useState<"win" | "loss" | "draw" | null>(null);
  const [thinking, setThinking] = useState(false);
  const [moveCount, setMoveCount] = useState(0);

  const aiMarker = playerMarker === "X" ? "O" : "X";
  const isPlayerTurn = currentTurn === playerMarker && !gameOver && !thinking;

  // --- Refs for tool handlers ---
  const startGameFromToolRef = useRef<((marker: "X" | "O", diff?: Difficulty) => void) | null>(null);
  const makeMoveFromToolRef = useRef<((pos: number) => void) | null>(null);
  const getGameStatusRef = useRef<(() => void) | null>(null);

  // --- SDK lifecycle ---
  useEffect(() => {
    const sdk = new ChatBridgeSDK({ version: "1.0.0" });
    sdkRef.current = sdk;
    sdk.ready(["tictactoe"]);

    const unsubSession = sdk.onSessionInit((sessionId, _token, config) => {
      if (config.marker) {
        setPlayerMarker((config.marker as string).toUpperCase() === "O" ? "O" : "X");
      }
    });

    const unsubTool = sdk.onToolInvoke((toolName, args) => {
      switch (toolName) {
        case "tictactoe_start_game":
          startGameFromToolRef.current?.(
            (args.marker as string)?.toUpperCase() === "O" ? "O" : "X",
            (args.difficulty as Difficulty) || "medium"
          );
          break;
        case "tictactoe_make_move":
          makeMoveFromToolRef.current?.(args.position as number);
          break;
        case "tictactoe_get_game_status":
          getGameStatusRef.current?.();
          break;
      }
    });

    return () => { unsubSession(); unsubTool(); };
  }, []);

  // --- Emit state ---
  const emitState = useCallback((b: Board, turn: "X" | "O", mc: number) => {
    sdkRef.current?.updateState({
      board: b.map((c, i) => c || (i + 1).toString()),
      currentTurn: turn,
      playerMarker,
      moveCount: mc,
      availableMoves: getAvailableMoves(b).map(i => ({ position: i, label: POSITION_LABELS[i] })),
    });
  }, [playerMarker]);

  // --- Check game end ---
  const checkEnd = useCallback((b: Board, mc: number): boolean => {
    const { winner, line } = checkWinner(b);
    if (winner) {
      setGameOver(true);
      setWinLine(line);
      const r = winner === playerMarker ? "win" : "loss";
      setResult(r);
      sdkRef.current?.complete({
        winner: winner === playerMarker ? "player" : "ai",
        playerMarker,
        totalMoves: mc,
        board: b,
      });
      return true;
    }
    if (getAvailableMoves(b).length === 0) {
      setGameOver(true);
      setResult("draw");
      sdkRef.current?.complete({
        winner: "draw",
        playerMarker,
        totalMoves: mc,
        board: b,
      });
      return true;
    }
    return false;
  }, [playerMarker]);

  // --- AI move ---
  const doAIMove = useCallback((b: Board, mc: number) => {
    if (!difficulty) return;
    setThinking(true);
    setTimeout(() => {
      const move = getAIMove(b, aiMarker, playerMarker, difficulty);
      if (move >= 0) {
        const next = [...b];
        next[move] = aiMarker;
        const newMc = mc + 1;
        setBoard(next);
        setMoveCount(newMc);
        setCurrentTurn(playerMarker);
        emitState(next, playerMarker, newMc);
        checkEnd(next, newMc);
      }
      setThinking(false);
    }, 300 + Math.random() * 400);
  }, [difficulty, aiMarker, playerMarker, emitState, checkEnd]);

  // --- Player move ---
  const makeMove = useCallback((pos: number) => {
    if (board[pos] !== null || gameOver || !isPlayerTurn) return;
    const next = [...board];
    next[pos] = playerMarker;
    const newMc = moveCount + 1;
    setBoard(next);
    setMoveCount(newMc);
    setCurrentTurn(aiMarker);
    emitState(next, aiMarker, newMc);
    if (!checkEnd(next, newMc)) {
      doAIMove(next, newMc);
    }
  }, [board, gameOver, isPlayerTurn, playerMarker, aiMarker, moveCount, emitState, checkEnd, doAIMove]);

  // --- Start game ---
  const startGame = useCallback((marker: "X" | "O", diff: Difficulty) => {
    setPlayerMarker(marker);
    setDifficulty(diff);
    setBoard(EMPTY_BOARD);
    setCurrentTurn("X");
    setGameOver(false);
    setWinLine(null);
    setResult(null);
    setMoveCount(0);
    setThinking(false);
    emitState(EMPTY_BOARD, "X", 0);

    // If AI is X, it goes first
    if (marker === "O") {
      const ai = marker === "O" ? "X" : "O";
      setThinking(true);
      setTimeout(() => {
        const move = getAIMove(EMPTY_BOARD, ai as Marker, marker, diff);
        if (move >= 0) {
          const next = [...EMPTY_BOARD];
          next[move] = ai;
          setBoard(next);
          setMoveCount(1);
          setCurrentTurn(marker);
          emitState(next, marker, 1);
        }
        setThinking(false);
      }, 400);
    }
  }, [emitState]);

  // --- Tool handler refs ---
  startGameFromToolRef.current = (marker, diff) => startGame(marker, diff || "medium");
  makeMoveFromToolRef.current = (pos) => makeMove(pos);
  getGameStatusRef.current = () => {
    sdkRef.current?.updateState({
      board: board.map((c, i) => c || (i + 1).toString()),
      currentTurn,
      playerMarker,
      isGameOver: gameOver,
      moveCount,
      availableMoves: getAvailableMoves(board).map(i => ({ position: i, label: POSITION_LABELS[i] })),
      result,
    });
  };

  // --- Select difficulty ---
  const handleSelectDifficulty = (diff: Difficulty) => {
    startGame(playerMarker, diff);
  };

  const handlePlayAgain = () => {
    if (difficulty) startGame(playerMarker, difficulty);
  };

  const handleChangeDifficulty = () => {
    setDifficulty(null);
    setBoard(EMPTY_BOARD);
    setGameOver(false);
    setResult(null);
    setWinLine(null);
  };

  // --- Render ---
  if (!difficulty) {
    return <DifficultySelector onSelect={handleSelectDifficulty} playerMarker={playerMarker} />;
  }

  const statusText = gameOver
    ? result === "win" ? "You won!" : result === "loss" ? "You lost!" : "Draw!"
    : thinking ? "AI is thinking..."
    : isPlayerTurn ? "Your turn" : "Opponent's turn";

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Tic Tac Toe</h3>
            <p className="text-xs text-zinc-500">
              You: <span className="font-bold text-zinc-300">{playerMarker}</span> vs AI: <span className="font-bold text-zinc-300">{aiMarker}</span>
              <span className="ml-2 text-zinc-600">({difficulty})</span>
            </p>
          </div>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            gameOver
              ? result === "win" ? "bg-green-900/50 text-green-400"
              : result === "loss" ? "bg-red-900/50 text-red-400"
              : "bg-zinc-700 text-zinc-400"
              : isPlayerTurn ? "bg-violet-900/50 text-violet-400"
              : "bg-zinc-700 text-zinc-400"
          }`}>
            {statusText}
          </span>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 flex items-center justify-center p-4 relative">
        <div className="grid grid-cols-3 gap-2 w-full max-w-[320px] aspect-square">
          {board.map((cell, i) => {
            const isWinCell = winLine?.includes(i);
            const isEmpty = cell === null;
            return (
              <button
                key={i}
                onClick={() => makeMove(i)}
                disabled={!isEmpty || !isPlayerTurn}
                className={`
                  aspect-square rounded-xl text-4xl font-bold flex items-center justify-center
                  transition-all duration-200
                  ${isEmpty && isPlayerTurn
                    ? "bg-zinc-800/60 hover:bg-zinc-700/80 hover:scale-105 cursor-pointer border border-zinc-700 hover:border-violet-600/40"
                    : "bg-zinc-800/40 border border-zinc-800 cursor-default"}
                  ${isWinCell ? "bg-green-900/40 border-green-500/60 scale-105" : ""}
                `}
              >
                {cell && (
                  <span className={`transition-all duration-200 ${
                    cell === "X" ? "text-violet-400" : "text-amber-400"
                  } ${isWinCell ? "scale-110" : ""}`}>
                    {cell}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Game Over Modal */}
        {gameOver && result && (
          <GameOverModal
            result={result}
            playerMarker={playerMarker}
            onPlayAgain={handlePlayAgain}
            onChangeDifficulty={handleChangeDifficulty}
          />
        )}
      </div>

      {/* Move count */}
      <div className="px-4 py-2 border-t border-zinc-800 text-center">
        <span className="text-[10px] text-zinc-600">Move {moveCount} of 9</span>
      </div>
    </div>
  );
}
