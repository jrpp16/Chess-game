import { Chess } from 'chess.js';
import { evaluatePosition } from './evaluation.js';

/**
 * @param {import('chess.js').Chess} chess
 * @param {import('chess.js').Move} move
 */
function applyMove(chess, move) {
  const next = new Chess(chess.fen());
  next.move({
    from: move.from,
    to: move.to,
    promotion: move.promotion,
  });
  return next;
}

/**
 * @param {import('chess.js').Chess} chess
 * @param {number} depth
 * @param {number} alpha
 * @param {number} beta
 * @param {'w'|'b'} maximizingColor
 * @param {(chess: import('chess.js').Chess, move: import('chess.js').Move) => number} moveBias
 */
export function minimax(chess, depth, alpha, beta, maximizingColor, moveBias) {
  if (depth === 0 || chess.isGameOver()) {
    return evaluatePosition(chess, maximizingColor, 0);
  }

  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) {
    return evaluatePosition(chess, maximizingColor, 0);
  }

  const isMax = chess.turn() === maximizingColor;

  if (isMax) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const bias = moveBias(chess, move);
      const child = applyMove(chess, move);
      const evalScore = minimax(child, depth - 1, alpha, beta, maximizingColor, moveBias) + bias;
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  }

  let minEval = Infinity;
  for (const move of moves) {
    const bias = moveBias(chess, move);
    const child = applyMove(chess, move);
    const evalScore = minimax(child, depth - 1, alpha, beta, maximizingColor, moveBias) - bias;
    minEval = Math.min(minEval, evalScore);
    beta = Math.min(beta, evalScore);
    if (beta <= alpha) break;
  }
  return minEval;
}

/**
 * @param {import('chess.js').Chess} chess
 * @param {number} depth
 * @param {'w'|'b'} engineColor
 * @param {(chess: import('chess.js').Chess, move: import('chess.js').Move) => number} moveBias
 * @returns {import('chess.js').Move | null}
 */
export function searchBestMove(chess, depth, engineColor, moveBias = () => 0) {
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;

  let bestMove = moves[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const move of moves) {
    const bias = moveBias(chess, move);
    const child = applyMove(chess, move);
    const score = minimax(child, depth - 1, alpha, beta, engineColor, moveBias) + bias;
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    alpha = Math.max(alpha, score);
  }

  return bestMove;
}

export function pickRandomMove(chess) {
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;
  return moves[Math.floor(Math.random() * moves.length)];
}
