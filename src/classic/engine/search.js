import { Chess } from 'chess.js';
import { evaluatePosition, hashPosition, orderMoves } from './searchCore.js';
import { TranspositionTable } from './transposition.js';

/** @typedef {'beginner'|'medium'|'hard'} Difficulty */

export const TIME_LIMIT_MS = {
  beginner: 150,
  medium: 500,
  hard: 1500,
};

/** Extra wall-clock budget before the main thread watchdog terminates the worker. */
export const HARD_TIMEOUT_MARGIN_MS = {
  beginner: 100,
  medium: 150,
  hard: 250,
};

const MAX_DEPTH = 32;
const MAX_QUIESCENCE_DEPTH = 10;
const NODE_CHECK_MASK = 2047;

/**
 * @param {import('chess.js').Chess} chess
 * @param {number} alpha
 * @param {number} beta
 * @param {'w'|'b'} engineColor
 * @param {SearchContext} ctx
 * @param {number} qDepth
 */
function quiescence(chess, alpha, beta, engineColor, ctx, qDepth = 0) {
  ctx.nodes += 1;
  ctx.quiescenceNodes += 1;

  if (ctx.shouldStop()) {
    return evaluatePosition(chess, engineColor, 0);
  }

  if (qDepth >= MAX_QUIESCENCE_DEPTH) {
    return evaluatePosition(chess, engineColor, 0);
  }

  if (chess.isGameOver()) {
    return evaluatePosition(chess, engineColor, 0);
  }

  const standPat = evaluatePosition(chess, engineColor, 0);
  if (standPat >= beta) {
    return beta;
  }
  if (standPat > alpha) {
    alpha = standPat;
  }

  const captures = chess
    .moves({ verbose: true })
    .filter((m) => m.captured || String(m.flags).includes('p'));

  const ordered = orderMoves(captures, chess, ctx);

  for (const move of ordered) {
    if (ctx.shouldStop()) {
      break;
    }
    chess.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
    let score;
    try {
      score = -quiescence(chess, -beta, -alpha, engineColor, ctx, qDepth + 1);
    } finally {
      chess.undo();
    }
    if (score >= beta) {
      ctx.cutoffs += 1;
      return beta;
    }
    if (score > alpha) {
      alpha = score;
    }
  }

  return alpha;
}

/**
 * @param {import('chess.js').Chess} chess
 * @param {number} depth
 * @param {number} alpha
 * @param {number} beta
 * @param {'w'|'b'} engineColor
 * @param {SearchContext} ctx
 */
function negamax(chess, depth, alpha, beta, engineColor, ctx) {
  ctx.nodes += 1;
  if ((ctx.nodes & NODE_CHECK_MASK) === 0 && ctx.shouldStop()) {
    return evaluatePosition(chess, engineColor, 0);
  }

  if (ctx.shouldStop()) {
    return evaluatePosition(chess, engineColor, 0);
  }

  const hash = hashPosition(chess);
  const tt = ctx.tt.get(hash);
  if (tt && tt.depth >= depth) {
    if (tt.flag === 'EXACT') {
      return tt.score;
    }
    if (tt.flag === 'LOWER') {
      alpha = Math.max(alpha, tt.score);
    } else if (tt.flag === 'UPPER') {
      beta = Math.min(beta, tt.score);
    }
    if (alpha >= beta) {
      ctx.cutoffs += 1;
      return tt.score;
    }
  }

  if (depth <= 0) {
    return quiescence(chess, alpha, beta, engineColor, ctx, 0);
  }

  if (chess.isGameOver()) {
    return evaluatePosition(chess, engineColor, 0);
  }

  const moves = orderMoves(chess.moves({ verbose: true }), chess, ctx);
  if (moves.length === 0) {
    return evaluatePosition(chess, engineColor, 0);
  }

  let bestScore = -Infinity;
  let bestMoveLan = '';
  let flag = 'UPPER';

  for (const move of moves) {
    if (ctx.shouldStop()) {
      break;
    }

    chess.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
    let score;
    try {
      score = -negamax(chess, depth - 1, -beta, -alpha, engineColor, ctx);
    } finally {
      chess.undo();
    }

    if (score > bestScore) {
      bestScore = score;
      bestMoveLan = `${move.from}${move.to}${move.promotion ?? ''}`;
    }

    if (score > alpha) {
      alpha = score;
      flag = 'EXACT';
    }

    if (alpha >= beta) {
      ctx.cutoffs += 1;
      flag = 'LOWER';
      break;
    }
  }

  if (!ctx.shouldStop() && bestScore > -Infinity) {
    ctx.tt.set(hash, {
      score: bestScore,
      depth,
      flag,
      move: bestMoveLan,
    });
  }

  return bestScore > -Infinity ? bestScore : evaluatePosition(chess, engineColor, 0);
}

/**
 * @param {import('chess.js').Chess} chess
 * @param {number} depth
 * @param {'w'|'b'} engineColor
 * @param {SearchContext} ctx
 */
function searchDepth(chess, depth, engineColor, ctx) {
  const moves = orderMoves(chess.moves({ verbose: true }), chess, ctx);
  if (moves.length === 0) {
    return { move: null, score: 0, complete: true };
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

    chess.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
    let score;
    try {
      score = -negamax(chess, depth - 1, -beta, -alpha, engineColor, ctx);
    } finally {
      chess.undo();
    }

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
      ctx.pvMove = `${move.from}${move.to}${move.promotion ?? ''}`;
    }

    alpha = Math.max(alpha, score);
  }

  return { move: bestMove, score: bestScore, complete: !interrupted && !ctx.shouldStop() };
}

class SearchContext {
  /**
   * @param {number} softDeadlineMs
   * @param {number} hardDeadlineMs
   * @param {Record<string, number>} moveBiasMap
   * @param {() => boolean} [isAborted]
   */
  constructor(softDeadlineMs, hardDeadlineMs, moveBiasMap, isAborted) {
    this.softDeadlineMs = softDeadlineMs;
    this.hardDeadlineMs = hardDeadlineMs;
    this.isAborted = isAborted ?? (() => false);
    this.tt = new TranspositionTable();
    this.nodes = 0;
    this.quiescenceNodes = 0;
    this.cutoffs = 0;
    this.pvMove = '';
    this.timedOut = false;
    this.hardTimeout = false;
    this.moveBias = (move) => {
      const key = `${move.from}${move.to}${move.promotion ?? ''}`;
      return moveBiasMap[key] ?? 0;
    };
  }

  shouldStop() {
    if (this.isAborted()) {
      this.timedOut = true;
      return true;
    }
    const now = performance.now();
    if (now >= this.hardDeadlineMs) {
      this.hardTimeout = true;
      this.timedOut = true;
      return true;
    }
    if (now >= this.softDeadlineMs) {
      this.timedOut = true;
      return true;
    }
    return false;
  }
}

/**
 * @param {string} fen
 * @param {Difficulty} difficulty
 * @param {'w'|'b'} engineColor
 * @param {Record<string, number>} moveBiasMap
 * @param {{ isAborted?: () => boolean }} [options]
 */
export function searchBestMoveTimed(fen, difficulty, engineColor, moveBiasMap = {}, options = {}) {
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });
  if (legal.length === 0) {
    return { move: null, stats: emptyStats() };
  }

  const timeLimit = TIME_LIMIT_MS[difficulty] ?? TIME_LIMIT_MS.medium;
  const margin = HARD_TIMEOUT_MARGIN_MS[difficulty] ?? HARD_TIMEOUT_MARGIN_MS.medium;
  const started = performance.now();
  const softDeadlineMs = started + timeLimit;
  const hardDeadlineMs = started + timeLimit + margin;
  const ctx = new SearchContext(
    softDeadlineMs,
    hardDeadlineMs,
    moveBiasMap,
    options.isAborted,
  );

  let bestMove = legal[0];
  let completedDepth = 0;

  for (let depth = 1; depth <= MAX_DEPTH; depth += 1) {
    if (ctx.shouldStop()) {
      break;
    }
    const { move, complete } = searchDepth(chess, depth, engineColor, ctx);
    if (complete && move) {
      bestMove = move;
      completedDepth = depth;
    }
    if (ctx.shouldStop()) {
      break;
    }
    if (chess.isGameOver()) {
      break;
    }
  }

  const elapsed = performance.now() - started;
  const ttStats = ctx.tt.getStats();
  const stats = {
    timeMs: Math.round(elapsed),
    nodes: ctx.nodes,
    depth: completedDepth,
    nps: elapsed > 0 ? Math.round(ctx.nodes / (elapsed / 1000)) : ctx.nodes,
    cutoffs: ctx.cutoffs,
    ttHits: ttStats.hits,
    ttMisses: ttStats.misses,
    ttSize: ttStats.size,
    quiescenceNodes: ctx.quiescenceNodes,
    timeout: ctx.timedOut,
    hardTimeout: ctx.hardTimeout,
    bestMoveLan: `${bestMove.from}${bestMove.to}${bestMove.promotion ?? ''}`,
  };

  return {
    move: {
      from: bestMove.from,
      to: bestMove.to,
      promotion: bestMove.promotion || 'q',
    },
    stats,
  };
}

function emptyStats() {
  return {
    timeMs: 0,
    nodes: 0,
    depth: 0,
    nps: 0,
    cutoffs: 0,
    ttHits: 0,
    ttMisses: 0,
    ttSize: 0,
    quiescenceNodes: 0,
    timeout: false,
    hardTimeout: false,
    bestMoveLan: '',
  };
}

export function pickRandomMoveFromFen(fen) {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;
  const move = moves[Math.floor(Math.random() * moves.length)];
  return { from: move.from, to: move.to, promotion: move.promotion || 'q' };
}

export function pickFirstLegalMoveFromFen(fen) {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;
  const move = moves[0];
  return { from: move.from, to: move.to, promotion: move.promotion || 'q' };
}
