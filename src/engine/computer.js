import { pickRandomMove, searchBestMove } from './minimax.js';

/** @typedef {'beginner'|'medium'|'hard'} Difficulty */

const DEPTH = {
  beginner: 1,
  medium: 2,
  hard: 4,
};

/**
 * @param {import('chess.js').Chess} chess
 * @param {Difficulty} difficulty
 * @param {'w'|'b'} engineColor
 * @param {{ getMoveBias?: (key: string) => number }} experience
 */
export function chooseComputerMove(chess, difficulty, engineColor, experience = {}) {
  const legal = chess.moves({ verbose: true });
  if (legal.length === 0) return null;

  const biasFn =
    typeof experience.getMoveBias === 'function'
      ? experience.getMoveBias
      : () => 0;

  if (difficulty === 'beginner' && Math.random() < 0.45) {
    return pickRandomMove(chess);
  }

  const depth = DEPTH[difficulty] ?? 2;
  const best = searchBestMove(chess, depth, engineColor, biasFn);

  if (difficulty === 'beginner' && Math.random() < 0.25 && legal.length > 1) {
    return pickRandomMove(chess);
  }

  return best;
}

export function defaultPromotion() {
  return 'q';
}

export { DEPTH };
