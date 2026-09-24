import { generateLegalMoves } from '../rules/moveEngine.js';
import { evaluatePosition } from './evaluation.js';
import { orderMoves, moveKey } from './moveOrdering.js';
import { hashPosition, TranspositionTable } from './transposition.js';
import { makeSearchMove, unmakeSearchMove } from './searchStack.js';
import { deserializePosition } from './positionCodec.js';

/** @typedef {'easy'|'medium'|'hard'} TriDifficulty */

export const TIME_LIMIT_MS = {
  easy: 150,
  medium: 500,
  hard: 1500,
};

const MAX_DEPTH = 24;

/**
 * @param {import('../rules/moveEngine.js').TriPosition} pos
 * @param {number} alpha
 * @param {number} beta
 * @param {'w'|'b'} engineColor
 * @param {SearchContext} ctx
 */
function quiescence(pos, alpha, beta, engineColor, ctx) {
  ctx.nodes += 1;
  const standPat = evaluatePosition(pos, engineColor);
  if (standPat >= beta) {
    ctx.cutoffs += 1;
    return beta;
  }
  if (standPat > alpha) alpha = standPat;

  const side = pos.turn;
  const moves = generateLegalMoves(pos).filter((m) => m.capture || m.kind === 'relocate_attack');
  const ordered = orderMoves(moves, pos, ctx.pvMoveKey);

  for (const move of ordered) {
    if (ctx.shouldStop()) break;
    const undo = makeSearchMove(pos, move);
    const score = -quiescence(pos, -beta, -alpha, engineColor, ctx);
    unmakeSearchMove(pos, undo);
    if (score >= beta) {
      ctx.cutoffs += 1;
      return beta;
    }
    if (score > alpha) alpha = score;
  }
  return alpha;
}

/**
 * @param {import('../rules/moveEngine.js').TriPosition} pos
 * @param {number} depth
 * @param {number} alpha
 * @param {number} beta
 * @param {'w'|'b'} engineColor
 * @param {SearchContext} ctx
 */
function negamax(pos, depth, alpha, beta, engineColor, ctx) {
  ctx.nodes += 1;
  if (ctx.shouldStop()) {
    return evaluatePosition(pos, engineColor);
  }

  const hash = hashPosition(pos);
  const tt = ctx.tt.get(hash);
  if (tt && tt.depth >= depth) {
    if (tt.flag === 'EXACT') return tt.score;
    if (tt.flag === 'LOWER') alpha = Math.max(alpha, tt.score);
    else if (tt.flag === 'UPPER') beta = Math.min(beta, tt.score);
    if (alpha >= beta) {
      ctx.cutoffs += 1;
      return tt.score;
    }
  }

  if (depth <= 0) {
    return quiescence(pos, alpha, beta, engineColor, ctx);
  }

  if (pos.status !== 'active') {
    return evaluatePosition(pos, engineColor);
  }

  const ttMoveKey = tt?.moveKey ?? ctx.pvMoveKey;
  const moves = orderMoves(generateLegalMoves(pos), pos, ttMoveKey);
  if (moves.length === 0) {
    return evaluatePosition(pos, engineColor);
  }

  let bestScore = -Infinity;
  let bestMoveKey = '';
  let flag = 'UPPER';

  for (const move of moves) {
    if (ctx.shouldStop()) break;
    const undo = makeSearchMove(pos, move);
    const score = -negamax(pos, depth - 1, -beta, -alpha, engineColor, ctx);
    unmakeSearchMove(pos, undo);

    const mk = moveKey(move);
    if (score > bestScore) {
      bestScore = score;
      bestMoveKey = mk;
    }
    if (score > alpha) {
      alpha = score;
      flag = 'EXACT';
    }
    if (alpha >= beta) {
      flag = 'LOWER';
      ctx.cutoffs += 1;
      break;
    }
  }

  ctx.tt.set(hash, { score: bestScore, depth, flag, moveKey: bestMoveKey });
  return bestScore;
}

/**
 * @param {import('../rules/moveEngine.js').TriPosition} pos
 * @param {number} depth
 * @param {'w'|'b'} engineColor
 * @param {SearchContext} ctx
 */
function searchDepth(pos, depth, engineColor, ctx) {
  const moves = orderMoves(generateLegalMoves(pos), pos, ctx.pvMoveKey);
  if (moves.length === 0) {
    return { move: null, score: evaluatePosition(pos, engineColor), complete: true };
  }

  let alpha = -Infinity;
  const beta = Infinity;
  let bestMove = moves[0];
  let bestScore = -Infinity;
  let interrupted = false;

  for (const move of moves) {
    if (ctx.shouldStop()) {
      interrupted = true;
      break;
    }
    const undo = makeSearchMove(pos, move);
    const score = -negamax(pos, depth - 1, -beta, -alpha, engineColor, ctx);
    unmakeSearchMove(pos, undo);

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
      ctx.pvMoveKey = moveKey(move);
    }
    alpha = Math.max(alpha, score);
  }

  return { move: bestMove, score: bestScore, complete: !interrupted && !ctx.shouldStop() };
}

class SearchContext {
  /** @param {number} deadlineMs */
  constructor(deadlineMs) {
    this.deadlineMs = deadlineMs;
    this.tt = new TranspositionTable();
    this.nodes = 0;
    this.cutoffs = 0;
    this.pvMoveKey = '';
  }

  shouldStop() {
    return performance.now() >= this.deadlineMs;
  }
}

/**
 * @param {import('../rules/moveEngine.js').TriPosition | ReturnType<typeof deserializePosition>} posInput
 * @param {TriDifficulty} difficulty
 * @param {'w'|'b'} engineColor
 */
export function searchBestMoveTimed(posInput, difficulty, engineColor) {
  const pos = typeof posInput.pieces?.entries === 'function' ? posInput : deserializePosition(posInput);
  pos.history = [];

  const legal = generateLegalMoves(pos);
  if (legal.length === 0) {
    return { move: null, stats: emptyStats(), fingerprint: hashPosition(pos) };
  }

  const timeLimit = TIME_LIMIT_MS[difficulty] ?? TIME_LIMIT_MS.medium;
  const started = performance.now();
  const deadlineMs = started + timeLimit;
  const ctx = new SearchContext(deadlineMs);

  let bestMove = legal[0];
  let bestScore = 0;
  let completedDepth = 0;

  for (let depth = 1; depth <= MAX_DEPTH; depth += 1) {
    const { move, score, complete } = searchDepth(pos, depth, engineColor, ctx);
    if (complete && move) {
      bestMove = move;
      bestScore = score;
      completedDepth = depth;
    }
    if (ctx.shouldStop()) break;
    if (pos.status !== 'active') break;
  }

  const elapsed = performance.now() - started;
  const ttStats = ctx.tt.getStats();
  const stats = {
    timeMs: Math.round(elapsed),
    timeLimitMs: timeLimit,
    nodes: ctx.nodes,
    depth: completedDepth,
    nps: elapsed > 0 ? Math.round(ctx.nodes / (elapsed / 1000)) : ctx.nodes,
    cutoffs: ctx.cutoffs,
    ttHits: ttStats.hits,
    ttMisses: ttStats.misses,
    ttSize: ttStats.size,
    score: Math.round(bestScore),
    move: moveKey(bestMove),
  };

  return {
    move: bestMove,
    stats,
    fingerprint: hashPosition(pos),
  };
}

function emptyStats() {
  return {
    timeMs: 0,
    timeLimitMs: 0,
    nodes: 0,
    depth: 0,
    nps: 0,
    cutoffs: 0,
    ttHits: 0,
    ttMisses: 0,
    ttSize: 0,
    score: 0,
    move: '',
  };
}

export function pickRandomLegalMove(pos) {
  const moves = generateLegalMoves(pos);
  if (moves.length === 0) return null;
  return moves[Math.floor(Math.random() * moves.length)];
}

export function logTriSearchStats(stats, difficulty) {
  if (!import.meta.env.DEV || !stats) return;
  console.info('[tri-bot]', { difficulty, ...stats });
}
