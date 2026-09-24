const MAX_ENTRIES = 140000;

/** @typedef {{ score: number, depth: number, flag: 'EXACT'|'LOWER'|'UPPER', move?: string }} TTEntry */

export class TranspositionTable {
  /** @type {Map<number, TTEntry>} */
  #map = new Map();

  #hits = 0;

  #misses = 0;

  get(hash) {
    const entry = this.#map.get(hash);
    if (entry) {
      this.#hits += 1;
      return entry;
    }
    this.#misses += 1;
    return null;
  }

  /**
   * @param {number} hash
   * @param {TTEntry} entry
   */
  set(hash, entry) {
    if (this.#map.size >= MAX_ENTRIES) {
      this.#map.clear();
    }
    this.#map.set(hash, entry);
  }

  clear() {
    this.#map.clear();
    this.#hits = 0;
    this.#misses = 0;
  }

  getStats() {
    return {
      size: this.#map.size,
      hits: this.#hits,
      misses: this.#misses,
    };
  }
}

/**
 * Fast 32-bit FEN hash (piece placement, side, castling, en passant).
 * @param {import('chess.js').Chess} chess
 */
export function hashPosition(chess) {
  const parts = chess.fen().split(' ');
  const key = `${parts[0]}|${parts[1]}|${parts[2]}|${parts[3]}`;
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const PIECE_VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

/**
 * @param {import('chess.js').Move} move
 * @param {import('chess.js').Chess} chess
 * @param {{ pvMove?: string, moveBias?: (move: import('chess.js').Move) => number }} ctx
 */
export function scoreMove(move, chess, ctx) {
  let score = 0;
  const flags = String(move.flags ?? '');

  if (flags.includes('p')) {
    score += 900000;
  }

  if (flags.includes('c') && move.captured) {
    const victim = PIECE_VALUE[move.captured] ?? 0;
    const attacker = PIECE_VALUE[move.piece] ?? 0;
    score += 800000 + victim * 10 - attacker;
  }

  if (move.san?.includes('+')) {
    score += 500000;
  }

  const lan = `${move.from}${move.to}${move.promotion ?? ''}`;
  if (ctx.pvMove && lan === ctx.pvMove) {
    score += 400000;
  }

  if (ctx.moveBias) {
    score += ctx.moveBias(move);
  }

  if (flags.includes('k') || flags.includes('q')) {
    score += 120000;
  }

  if (flags.includes('n')) {
    score += centerBonus(move.to);
  }

  return score;
}

function centerBonus(square) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  const cf = Math.min(file, 7 - file);
  const cr = Math.min(rank - 1, 8 - rank);
  return (3 - cf) * 4 + (3 - cr) * 4;
}

/**
 * @param {import('chess.js').Move[]} moves
 */
export function orderMoves(moves, chess, ctx) {
  const scored = moves.map((move) => ({ move, score: scoreMove(move, chess, ctx) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.move);
}
