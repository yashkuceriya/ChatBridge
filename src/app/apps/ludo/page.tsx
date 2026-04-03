"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { RotateCcw, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, Crown, X } from "lucide-react";
import { ChatBridgeSDK } from "@/lib/app-sdk";

// ========== Types & Constants ==========

type PlayerColor = "red" | "blue" | "green" | "yellow";

interface Piece {
  id: number;
  color: PlayerColor;
  position: number; // -1 = home, 0-51 = board, 52-57 = home column, 58 = finished
}

interface Player {
  color: PlayerColor;
  pieces: Piece[];
  isAI: boolean;
  startPos: number; // Entry point on the board
  homeEntry: number; // Where home column starts
}

const COLORS: PlayerColor[] = ["red", "blue", "green", "yellow"];
const COLOR_CONFIG: Record<PlayerColor, { bg: string; text: string; ring: string; light: string; dark: string; hex: string }> = {
  red:    { bg: "bg-red-500",    text: "text-red-400",    ring: "ring-red-400",    light: "bg-red-400/20",    dark: "bg-red-900/40",    hex: "#ef4444" },
  blue:   { bg: "bg-blue-500",   text: "text-blue-400",   ring: "ring-blue-400",   light: "bg-blue-400/20",   dark: "bg-blue-900/40",   hex: "#3b82f6" },
  green:  { bg: "bg-green-500",  text: "text-green-400",  ring: "ring-green-400",  light: "bg-green-400/20",  dark: "bg-green-900/40",  hex: "#22c55e" },
  yellow: { bg: "bg-yellow-500", text: "text-yellow-400", ring: "ring-yellow-400", light: "bg-yellow-400/20", dark: "bg-yellow-900/40", hex: "#eab308" },
};

// Each color enters the board at a different position (13 apart on a 52-square track)
const START_POSITIONS: Record<PlayerColor, number> = { red: 0, blue: 13, green: 26, yellow: 39 };
// Each color's home entry (one step before their start, wrapping around)
const HOME_ENTRIES: Record<PlayerColor, number> = { red: 51, blue: 12, green: 25, yellow: 38 };

const BOARD_SIZE = 52;
const HOME_LENGTH = 6;
const FINISHED_POS = 58;

const SAFE_SPOTS = [0, 8, 13, 21, 26, 34, 39, 47]; // Star positions

const DiceIcons = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];

// ========== Game Logic ==========

function createPlayer(color: PlayerColor, isAI: boolean): Player {
  return {
    color,
    pieces: Array.from({ length: 4 }, (_, i) => ({ id: i, color, position: -1 })),
    isAI,
    startPos: START_POSITIONS[color],
    homeEntry: HOME_ENTRIES[color],
  };
}

function getRelativePosition(piece: Piece, player: Player): number {
  if (piece.position === -1 || piece.position >= BOARD_SIZE) return piece.position;
  // Convert absolute board position to relative (from player's start)
  return (piece.position - player.startPos + BOARD_SIZE) % BOARD_SIZE;
}

function canMovePiece(piece: Piece, diceValue: number, player: Player): boolean {
  // In home base — need a 6 to enter
  if (piece.position === -1) return diceValue === 6;
  // Already finished
  if (piece.position === FINISHED_POS) return false;
  // In home column
  if (piece.position >= BOARD_SIZE) {
    const homeProgress = piece.position - BOARD_SIZE;
    const newProgress = homeProgress + diceValue;
    return newProgress < HOME_LENGTH; // Must land exactly
  }
  // On the board
  const relPos = getRelativePosition(piece, player);
  const newRelPos = relPos + diceValue;
  if (newRelPos === BOARD_SIZE - 1 + HOME_LENGTH) {
    return true; // Exact finish
  }
  if (newRelPos >= BOARD_SIZE) {
    // Entering home column
    const homeProgress = newRelPos - (BOARD_SIZE - 1) - 1;
    return homeProgress < HOME_LENGTH;
  }
  return true;
}

function movePiece(
  piece: Piece,
  diceValue: number,
  player: Player,
  allPlayers: Player[]
): { newPosition: number; captured: Piece | null } {
  let captured: Piece | null = null;

  // Enter from home
  if (piece.position === -1 && diceValue === 6) {
    const newPos = player.startPos;
    // Check for capture at start
    captured = checkCapture(newPos, player.color, allPlayers);
    return { newPosition: newPos, captured };
  }

  // In home column
  if (piece.position >= BOARD_SIZE) {
    const homeProgress = piece.position - BOARD_SIZE;
    const newProgress = homeProgress + diceValue;
    if (newProgress >= HOME_LENGTH) return { newPosition: FINISHED_POS, captured: null };
    return { newPosition: BOARD_SIZE + newProgress, captured: null };
  }

  // On the board
  const relPos = getRelativePosition(piece, player);
  const newRelPos = relPos + diceValue;

  if (newRelPos >= BOARD_SIZE) {
    // Entering home column
    const homeProgress = newRelPos - BOARD_SIZE;
    if (homeProgress >= HOME_LENGTH) return { newPosition: FINISHED_POS, captured: null };
    return { newPosition: BOARD_SIZE + homeProgress, captured: null };
  }

  const newAbsPos = (player.startPos + newRelPos) % BOARD_SIZE;
  captured = checkCapture(newAbsPos, player.color, allPlayers);
  return { newPosition: newAbsPos, captured };
}

function checkCapture(position: number, movingColor: PlayerColor, allPlayers: Player[]): Piece | null {
  if (SAFE_SPOTS.includes(position)) return null;
  for (const p of allPlayers) {
    if (p.color === movingColor) continue;
    for (const piece of p.pieces) {
      if (piece.position === position) return piece;
    }
  }
  return null;
}

function hasWon(player: Player): boolean {
  return player.pieces.every((p) => p.position === FINISHED_POS);
}

function getMovablePieces(player: Player, diceValue: number): number[] {
  return player.pieces
    .map((p, i) => (canMovePiece(p, diceValue, player) ? i : -1))
    .filter((i) => i >= 0);
}

// ========== Game Over Modal ==========

function GameOverModal({
  won,
  playerColor,
  onPlayAgain,
}: {
  won: boolean;
  playerColor: PlayerColor;
  onPlayAgain: () => void;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-md">
      <div className={`bg-gradient-to-b ${won ? "from-yellow-900/30" : "from-red-900/30"} to-zinc-900 border border-zinc-700 rounded-xl p-5 mx-4 w-full max-w-[260px] text-center shadow-2xl transition-all duration-300 ${visible ? "scale-100 opacity-100" : "scale-75 opacity-0"}`}>
        <div className={`inline-flex items-center justify-center h-14 w-14 rounded-full bg-zinc-800/80 mb-3 ${won ? "text-yellow-400" : "text-red-400"}`}>
          {won ? <Crown className="h-7 w-7" /> : <X className="h-7 w-7" />}
        </div>
        <h3 className="text-lg font-bold text-zinc-100 mb-1">{won ? "You won!" : "You lost!"}</h3>
        <p className="text-xs text-zinc-500 mb-4">
          Playing as <span className={`font-bold ${COLOR_CONFIG[playerColor].text}`}>{playerColor}</span>
        </p>
        <button onClick={onPlayAgain} className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-500 py-2.5 text-xs font-semibold text-white transition-colors">
          <RotateCcw className="h-3.5 w-3.5" /> Play Again
        </button>
      </div>
    </div>
  );
}

// ========== Board Visualization ==========

function PieceToken({ color, small, pulse }: { color: PlayerColor; small?: boolean; pulse?: boolean }) {
  const size = small ? "h-4 w-4" : "h-6 w-6";
  return (
    <div className={`${size} rounded-full ${COLOR_CONFIG[color].bg} border-2 border-white/30 shadow-md ${pulse ? "animate-pulse" : ""}`} />
  );
}

function HomeBase({ color, pieces }: { color: PlayerColor; pieces: Piece[] }) {
  const homePieces = pieces.filter((p) => p.position === -1);
  const cfg = COLOR_CONFIG[color];
  return (
    <div className={`rounded-xl ${cfg.dark} border border-zinc-700/50 p-2 flex flex-col items-center gap-1`}>
      <span className={`text-[9px] font-bold ${cfg.text} uppercase`}>{color}</span>
      <div className="grid grid-cols-2 gap-1">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-5 w-5 rounded-full border border-zinc-700/50 flex items-center justify-center">
            {homePieces[i] && <PieceToken color={color} small />}
          </div>
        ))}
      </div>
    </div>
  );
}

function FinishedArea({ players }: { players: Player[] }) {
  return (
    <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 p-2">
      <span className="text-[9px] font-bold text-zinc-500 uppercase block text-center mb-1">Home</span>
      <div className="grid grid-cols-2 gap-1">
        {players.map((p) => {
          const finished = p.pieces.filter((pc) => pc.position === FINISHED_POS).length;
          return (
            <div key={p.color} className="flex items-center gap-0.5">
              <div className={`h-2.5 w-2.5 rounded-full ${COLOR_CONFIG[p.color].bg}`} />
              <span className="text-[9px] text-zinc-400">{finished}/4</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ========== Main Ludo App ==========

export default function LudoApp() {
  const sdkRef = useRef<ChatBridgeSDK | null>(null);

  const [playerColor, setPlayerColor] = useState<PlayerColor>("red");
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [diceValue, setDiceValue] = useState<number | null>(null);
  const [diceRolling, setDiceRolling] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<PlayerColor | null>(null);
  const [movablePieces, setMovablePieces] = useState<number[]>([]);
  const [waitingForPieceSelect, setWaitingForPieceSelect] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [lastCapture, setLastCapture] = useState<string | null>(null);
  const [consecutiveSixes, setConsecutiveSixes] = useState(0);

  const currentPlayer = players[currentPlayerIndex] || null;
  const isPlayerTurn = currentPlayer?.color === playerColor && !gameOver;

  // --- Refs ---
  const startGameRef = useRef<((color: PlayerColor) => void) | null>(null);
  const rollDiceRef = useRef<(() => void) | null>(null);
  const movePieceRef = useRef<((idx: number) => void) | null>(null);
  const getStatusRef = useRef<(() => void) | null>(null);

  // --- SDK lifecycle ---
  useEffect(() => {
    const sdk = new ChatBridgeSDK({ version: "1.0.0" });
    sdkRef.current = sdk;
    sdk.ready(["ludo"]);

    const unsubSession = sdk.onSessionInit((_sid, _token, config) => {
      if (config.color && COLORS.includes(config.color as PlayerColor)) {
        setPlayerColor(config.color as PlayerColor);
      }
    });

    const unsubTool = sdk.onToolInvoke((toolName, args) => {
      switch (toolName) {
        case "ludo_start_game":
          startGameRef.current?.((args.color as PlayerColor) || "red");
          break;
        case "ludo_roll_dice":
          rollDiceRef.current?.();
          break;
        case "ludo_move_piece":
          movePieceRef.current?.(args.pieceIndex as number);
          break;
        case "ludo_get_game_status":
          getStatusRef.current?.();
          break;
      }
    });

    return () => { unsubSession(); unsubTool(); };
  }, []);

  // --- Emit state ---
  const emitState = useCallback((ps: Player[], cpIdx: number, dice: number | null, tc: number) => {
    sdkRef.current?.updateState({
      currentTurn: ps[cpIdx]?.color,
      diceValue: dice,
      turnCount: tc,
      players: ps.map((p) => ({
        color: p.color,
        pieces: p.pieces.map((pc) => ({
          id: pc.id,
          position: pc.position === -1 ? "home" : pc.position === FINISHED_POS ? "finished" : pc.position,
        })),
        finishedCount: p.pieces.filter((pc) => pc.position === FINISHED_POS).length,
      })),
    });
  }, []);

  // --- Start game ---
  const startNewGame = useCallback((color: PlayerColor) => {
    setPlayerColor(color);
    // 2-player game: player + AI opponent (across the board)
    const aiColor = COLORS[(COLORS.indexOf(color) + 2) % 4];
    const newPlayers = [createPlayer(color, false), createPlayer(aiColor, true)];
    setPlayers(newPlayers);
    setCurrentPlayerIndex(0);
    setDiceValue(null);
    setGameStarted(true);
    setGameOver(false);
    setWinner(null);
    setMovablePieces([]);
    setWaitingForPieceSelect(false);
    setTurnCount(0);
    setLastCapture(null);
    setConsecutiveSixes(0);
    emitState(newPlayers, 0, null, 0);
  }, [emitState]);

  // --- Next turn ---
  const nextTurn = useCallback((ps: Player[], currentIdx: number, dice: number, tc: number) => {
    // Extra turn on 6 (max 3 consecutive)
    if (dice === 6 && consecutiveSixes < 2) {
      setConsecutiveSixes((prev) => prev + 1);
      setDiceValue(null);
      setMovablePieces([]);
      setWaitingForPieceSelect(false);
      // If AI's turn continues, trigger AI roll
      if (ps[currentIdx].isAI) {
        setTimeout(() => rollDiceRef.current?.(), 800);
      }
      return;
    }

    setConsecutiveSixes(0);
    const nextIdx = (currentIdx + 1) % ps.length;
    setCurrentPlayerIndex(nextIdx);
    setDiceValue(null);
    setMovablePieces([]);
    setWaitingForPieceSelect(false);
    const newTc = tc + 1;
    setTurnCount(newTc);
    emitState(ps, nextIdx, null, newTc);

    // AI turn
    if (ps[nextIdx].isAI) {
      setTimeout(() => rollDiceRef.current?.(), 800);
    }
  }, [emitState, consecutiveSixes]);

  // --- Roll dice ---
  const rollDice = useCallback(() => {
    if (diceRolling || diceValue !== null || gameOver) return;

    setDiceRolling(true);
    setLastCapture(null);
    const value = Math.floor(Math.random() * 6) + 1;

    setTimeout(() => {
      setDiceValue(value);
      setDiceRolling(false);

      const cp = players[currentPlayerIndex];
      const movable = getMovablePieces(cp, value);
      setMovablePieces(movable);

      if (movable.length === 0) {
        // No moves — next turn
        setTimeout(() => nextTurn(players, currentPlayerIndex, value, turnCount), 600);
      } else if (movable.length === 1 && cp.isAI) {
        // AI auto-moves only piece
        setTimeout(() => movePieceRef.current?.(movable[0]), 400);
      } else if (cp.isAI) {
        // AI picks best piece (prefer entering, then furthest)
        setTimeout(() => {
          const best = movable.reduce((a, b) => {
            const pa = cp.pieces[a];
            const pb = cp.pieces[b];
            if (pa.position === -1) return a; // Prefer entering
            if (pb.position === -1) return b;
            const relA = getRelativePosition(pa, cp);
            const relB = getRelativePosition(pb, cp);
            return relA > relB ? a : b; // Move furthest piece
          });
          movePieceRef.current?.(best);
        }, 400);
      } else {
        setWaitingForPieceSelect(true);
        if (movable.length === 1) {
          // Auto-move for player if only one option
          setTimeout(() => movePieceRef.current?.(movable[0]), 200);
        }
      }
    }, 500);
  }, [diceRolling, diceValue, gameOver, players, currentPlayerIndex, nextTurn, turnCount]);

  // --- Move piece ---
  const handleMovePiece = useCallback((pieceIndex: number) => {
    if (diceValue === null || gameOver) return;

    const cp = players[currentPlayerIndex];
    const piece = cp.pieces[pieceIndex];
    if (!canMovePiece(piece, diceValue, cp)) return;

    const { newPosition, captured } = movePiece(piece, diceValue, cp, players);

    // Update state
    const updatedPlayers = players.map((p, pi) => {
      if (pi === currentPlayerIndex) {
        return {
          ...p,
          pieces: p.pieces.map((pc, pci) =>
            pci === pieceIndex ? { ...pc, position: newPosition } : pc
          ),
        };
      }
      // Handle capture — send captured piece home
      if (captured && p.color === captured.color) {
        return {
          ...p,
          pieces: p.pieces.map((pc) =>
            pc.id === captured.id ? { ...pc, position: -1 } : pc
          ),
        };
      }
      return p;
    });

    setPlayers(updatedPlayers);
    setWaitingForPieceSelect(false);

    if (captured) {
      setLastCapture(`${cp.color} captured ${captured.color}'s piece!`);
    }

    // Check win
    const updatedCurrent = updatedPlayers[currentPlayerIndex];
    if (hasWon(updatedCurrent)) {
      setGameOver(true);
      setWinner(updatedCurrent.color);
      sdkRef.current?.complete({
        winner: updatedCurrent.color,
        playerWon: updatedCurrent.color === playerColor,
        turnCount,
      });
      return;
    }

    emitState(updatedPlayers, currentPlayerIndex, diceValue, turnCount);

    // Extra turn on 6 or capture
    if (diceValue === 6 || captured) {
      setDiceValue(null);
      setMovablePieces([]);
      if (cp.isAI) {
        setTimeout(() => rollDiceRef.current?.(), 800);
      }
      return;
    }

    nextTurn(updatedPlayers, currentPlayerIndex, diceValue, turnCount);
  }, [diceValue, gameOver, players, currentPlayerIndex, playerColor, turnCount, emitState, nextTurn]);

  // --- Tool handler refs ---
  startGameRef.current = startNewGame;
  rollDiceRef.current = rollDice;
  movePieceRef.current = handleMovePiece;
  getStatusRef.current = () => {
    sdkRef.current?.updateState({
      currentTurn: currentPlayer?.color,
      diceValue,
      turnCount,
      isGameOver: gameOver,
      winner,
      players: players.map((p) => ({
        color: p.color,
        isAI: p.isAI,
        pieces: p.pieces.map((pc) => ({
          id: pc.id,
          position: pc.position === -1 ? "home" : pc.position === FINISHED_POS ? "finished" : pc.position,
        })),
        finishedCount: p.pieces.filter((pc) => pc.position === FINISHED_POS).length,
      })),
    });
  };

  // --- Render: Color Selection ---
  if (!gameStarted) {
    return (
      <div className="flex flex-col h-full bg-zinc-950">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-100">Choose Your Color</h3>
          <p className="text-xs text-zinc-500 mt-1">Pick a color to start playing Ludo</p>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="grid grid-cols-2 gap-3 w-full max-w-[280px]">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => startNewGame(c)}
                className={`flex flex-col items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:scale-105 hover:border-zinc-600`}
              >
                <div className={`h-10 w-10 rounded-full ${COLOR_CONFIG[c].bg} shadow-lg`} />
                <span className={`text-sm font-bold ${COLOR_CONFIG[c].text} capitalize`}>{c}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- Render: Game ---
  const DiceIcon = diceValue ? DiceIcons[diceValue - 1] : Dice1;
  const aiPlayer = players.find((p) => p.isAI);

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="px-4 py-2 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">Ludo</h3>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            gameOver
              ? winner === playerColor ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"
              : isPlayerTurn ? "bg-violet-900/50 text-violet-400" : "bg-zinc-700 text-zinc-400"
          }`}>
            {gameOver
              ? winner === playerColor ? "You won!" : "You lost!"
              : isPlayerTurn
                ? diceValue ? "Pick a piece" : "Roll the dice"
                : "AI's turn..."}
          </span>
        </div>
      </div>

      {/* Board area */}
      <div className="flex-1 overflow-y-auto p-3 relative">
        {/* Player info */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {players.map((p) => (
            <div
              key={p.color}
              className={`rounded-lg border p-2 ${
                currentPlayer?.color === p.color
                  ? `border-zinc-600 ${COLOR_CONFIG[p.color].dark}`
                  : "border-zinc-800 bg-zinc-900/30"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`h-3 w-3 rounded-full ${COLOR_CONFIG[p.color].bg}`} />
                <span className={`text-xs font-bold ${COLOR_CONFIG[p.color].text} capitalize`}>
                  {p.color} {p.isAI ? "(AI)" : "(You)"}
                </span>
                {currentPlayer?.color === p.color && (
                  <span className="text-[9px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded-full ml-auto">Turn</span>
                )}
              </div>
              <div className="flex gap-1">
                {p.pieces.map((pc) => (
                  <div
                    key={pc.id}
                    className={`h-5 w-5 rounded-full border flex items-center justify-center text-[8px] font-bold ${
                      pc.position === FINISHED_POS
                        ? `${COLOR_CONFIG[p.color].bg} border-white/30 text-white`
                        : pc.position === -1
                          ? `border-zinc-700 ${COLOR_CONFIG[p.color].light} ${COLOR_CONFIG[p.color].text}`
                          : `${COLOR_CONFIG[p.color].bg} border-white/30 text-white`
                    }`}
                  >
                    {pc.position === FINISHED_POS ? "!" : pc.position === -1 ? pc.id + 1 : pc.id + 1}
                  </div>
                ))}
                <span className="text-[9px] text-zinc-500 ml-auto self-center">
                  {p.pieces.filter((pc) => pc.position === FINISHED_POS).length}/4 home
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Board track visualization */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 mb-3">
          <div className="text-[9px] text-zinc-600 uppercase font-bold mb-2 text-center">Board Track</div>

          {/* Simplified visual: show pieces on a linear track */}
          <div className="relative">
            {/* Track grid — 4 rows of 13 */}
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex gap-[2px] mb-[2px]">
                {Array.from({ length: 13 }, (_, col) => {
                  const pos = row * 13 + col;
                  const isSafe = SAFE_SPOTS.includes(pos);
                  const isStart = Object.values(START_POSITIONS).includes(pos);
                  const piecesHere = players.flatMap((p) =>
                    p.pieces.filter((pc) => pc.position === pos).map((pc) => ({ ...pc, playerColor: p.color }))
                  );

                  return (
                    <div
                      key={col}
                      className={`h-6 w-full rounded-sm flex items-center justify-center relative
                        ${isSafe ? "bg-zinc-700/60 ring-1 ring-yellow-600/30" : "bg-zinc-800/60"}
                        ${isStart ? "ring-1 ring-zinc-600" : ""}
                      `}
                    >
                      {piecesHere.length > 0 ? (
                        <div className="flex -space-x-1">
                          {piecesHere.map((pc, idx) => (
                            <div key={idx} className={`h-4 w-4 rounded-full ${COLOR_CONFIG[pc.playerColor].bg} border border-white/30 z-${10 + idx}`} />
                          ))}
                        </div>
                      ) : (
                        <span className="text-[7px] text-zinc-700">{pos}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Home columns */}
          <div className="mt-2 grid grid-cols-2 gap-2">
            {players.map((p) => {
              const inHomeCol = p.pieces.filter((pc) => pc.position >= BOARD_SIZE && pc.position < FINISHED_POS);
              if (inHomeCol.length === 0) return null;
              return (
                <div key={p.color} className={`flex items-center gap-1 ${COLOR_CONFIG[p.color].dark} rounded px-2 py-1`}>
                  <span className={`text-[8px] ${COLOR_CONFIG[p.color].text}`}>Home col:</span>
                  {inHomeCol.map((pc) => (
                    <div key={pc.id} className={`h-3.5 w-3.5 rounded-full ${COLOR_CONFIG[p.color].bg} border border-white/30`} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Home bases & finished */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <HomeBase color={players[0]?.color || "red"} pieces={players[0]?.pieces || []} />
          <FinishedArea players={players} />
          <HomeBase color={players[1]?.color || "blue"} pieces={players[1]?.pieces || []} />
        </div>

        {/* Capture notification */}
        {lastCapture && (
          <div className="text-center text-xs text-amber-400 bg-amber-900/20 rounded-lg py-1.5 mb-3 animate-pulse">
            {lastCapture}
          </div>
        )}

        {/* Game over modal */}
        {gameOver && winner && (
          <GameOverModal
            won={winner === playerColor}
            playerColor={playerColor}
            onPlayAgain={() => startNewGame(playerColor)}
          />
        )}
      </div>

      {/* Controls */}
      <div className="border-t border-zinc-800 p-3">
        {/* Dice */}
        <div className="flex items-center justify-center gap-4 mb-3">
          <button
            onClick={rollDice}
            disabled={!isPlayerTurn || diceValue !== null || diceRolling || gameOver}
            className={`flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all ${
              isPlayerTurn && diceValue === null && !diceRolling
                ? "bg-violet-600 hover:bg-violet-500 text-white hover:scale-105"
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            }`}
          >
            <DiceIcon className={`h-5 w-5 ${diceRolling ? "animate-spin" : ""}`} />
            {diceRolling ? "Rolling..." : diceValue ? `Rolled: ${diceValue}` : "Roll Dice"}
          </button>
        </div>

        {/* Piece selection */}
        {waitingForPieceSelect && isPlayerTurn && movablePieces.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-zinc-500 text-center">Choose a piece to move:</p>
            <div className="flex justify-center gap-2">
              {movablePieces.map((idx) => {
                const piece = players.find((p) => p.color === playerColor)?.pieces[idx];
                return (
                  <button
                    key={idx}
                    onClick={() => handleMovePiece(idx)}
                    className={`flex items-center gap-1.5 rounded-lg border border-zinc-700 ${COLOR_CONFIG[playerColor].dark} px-3 py-2 text-xs font-medium text-zinc-200 transition-all hover:scale-105 hover:border-violet-600/40`}
                  >
                    <PieceToken color={playerColor} small />
                    Piece {idx + 1}
                    <span className="text-[9px] text-zinc-500">
                      ({piece?.position === -1 ? "home" : `pos ${piece?.position}`})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="text-center mt-2">
          <span className="text-[10px] text-zinc-600">Turn {turnCount + 1}</span>
        </div>
      </div>
    </div>
  );
}
