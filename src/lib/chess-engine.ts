import { Chess, Square } from "chess.js";

// Piece values
const PIECE_VAL: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

// Piece-square tables (from white's perspective, flipped for black)
const PST: Record<string, number[]> = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
   -50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
     0,  0,  5,  5,  5,  5,  0, -5,
   -10,  5,  5,  5,  5,  5,  0,-10,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0,  0, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20,
  ],
};

function getPstValue(piece: string, color: string, sq: number): number {
  const table = PST[piece];
  if (!table) return 0;
  // Flip table index for black
  const idx = color === "w" ? sq : 63 - sq;
  return table[idx];
}

/** Static board evaluation from white's perspective. */
function evaluate(game: Chess): number {
  if (game.isCheckmate()) {
    return game.turn() === "w" ? -99999 : 99999;
  }
  if (game.isDraw() || game.isStalemate()) return 0;

  let score = 0;
  const board = game.board();

  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (!piece) continue;
      const sq = rank * 8 + file;
      const val = PIECE_VAL[piece.type] + getPstValue(piece.type, piece.color, sq);
      score += piece.color === "w" ? val : -val;
    }
  }

  // Mobility bonus
  const currentMoves = game.moves().length;
  score += game.turn() === "w" ? currentMoves * 2 : -currentMoves * 2;

  return score;
}

/** Minimax with alpha-beta pruning. */
function minimax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean
): number {
  if (depth === 0 || game.isGameOver()) {
    return evaluate(game);
  }

  const moves = game.moves();

  // Move ordering: captures first, then checks
  moves.sort((a, b) => {
    let sa = 0, sb = 0;
    if (a.includes("x")) sa += 10;
    if (b.includes("x")) sb += 10;
    if (a.includes("+")) sa += 5;
    if (b.includes("+")) sb += 5;
    return sb - sa;
  });

  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      game.move(move);
      const val = minimax(game, depth - 1, alpha, beta, false);
      game.undo();
      maxEval = Math.max(maxEval, val);
      alpha = Math.max(alpha, val);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      game.move(move);
      const val = minimax(game, depth - 1, alpha, beta, true);
      game.undo();
      minEval = Math.min(minEval, val);
      beta = Math.min(beta, val);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

// --- Difficulty Profiles (like chess.com bots) ---
export interface BotProfile {
  name: string;
  rating: number;
  depth: number;
  blunderRate: number; // 0-1, chance of picking a random move instead of best
  description: string;
  avatar: string;
}

export const BOT_PROFILES: BotProfile[] = [
  { name: "Buddy", rating: 400, depth: 1, blunderRate: 0.5, description: "Just learning!", avatar: "🐣" },
  { name: "Elena", rating: 800, depth: 2, blunderRate: 0.3, description: "Casual player", avatar: "👩" },
  { name: "Marcus", rating: 1200, depth: 3, blunderRate: 0.15, description: "Club player", avatar: "🧑" },
  { name: "Sofia", rating: 1600, depth: 3, blunderRate: 0.05, description: "Tournament player", avatar: "👩‍🎓" },
  { name: "Viktor", rating: 2000, depth: 4, blunderRate: 0.02, description: "Expert", avatar: "🎩" },
  { name: "Magnus AI", rating: 2500, depth: 4, blunderRate: 0, description: "Grandmaster", avatar: "👑" },
];

/**
 * Find the best move for the current side using minimax.
 */
export function findBestMove(fen: string, depth: number = 3, blunderRate: number = 0): string | null {
  const game = new Chess(fen);
  const moves = game.moves();
  if (!moves.length) return null;

  const isMaximizing = game.turn() === "w";
  let bestMove: string | null = null;
  let bestScore = isMaximizing ? -Infinity : Infinity;

  // Move ordering for root
  moves.sort((a, b) => {
    let sa = 0, sb = 0;
    if (a.includes("x")) sa += 10;
    if (b.includes("x")) sb += 10;
    if (a.includes("+")) sa += 5;
    if (b.includes("+")) sb += 5;
    if (a.includes("#")) sa += 100;
    if (b.includes("#")) sb += 100;
    return sb - sa;
  });

  for (const move of moves) {
    game.move(move);
    const score = minimax(game, depth - 1, -Infinity, Infinity, !isMaximizing);
    game.undo();

    if (isMaximizing) {
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    } else {
      if (score < bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
  }

  // Blunder: sometimes pick a random (non-terrible) move instead
  if (blunderRate > 0 && Math.random() < blunderRate && moves.length > 1) {
    // Pick a random move that isn't a total disaster (not hanging the queen etc.)
    // Filter out the worst 30% of moves
    const scored = moves.map((m) => {
      game.move(m);
      const s = minimax(game, 1, -Infinity, Infinity, !isMaximizing);
      game.undo();
      return { m, s };
    });
    scored.sort((a, b) => isMaximizing ? b.s - a.s : a.s - b.s);
    const pool = scored.slice(0, Math.max(2, Math.ceil(scored.length * 0.7)));
    return pool[Math.floor(Math.random() * pool.length)].m;
  }

  return bestMove;
}

/** Evaluate a position from white's perspective. Returns centipawn score divided by 100 (pawn units). */
export function evaluatePosition(fen: string): number {
  const game = new Chess(fen);
  return evaluate(game);
}
