import { MATERIAL } from '../rules/cgTdcV1Rules.js';
import { generateLegalMoves, isInCheck, isSquareAttacked } from '../rules/moveEngine.js';
import { parseCoordKey } from '../board/coordinates.js';
import { moveKey } from './transposition.js';

const PIECE_VALUES = MATERIAL;

/**
 * @param {object} move
 * @param {import('../rules/moveEngine.js').TriPosition} pos
 * @param {string} ttMoveKey
 */
export function scoreMove(move, pos, ttMoveKey = '') {
  const key = moveKey(move);
  let score = 0;
  if (key === ttMoveKey) score += 1_000_000;
  if (move.capture) {
    const moving = move.from ? pos.pieces.get(move.from) : null;
    const captured = move.to ? pos.pieces.get(move.to) : null;
    const victim = captured ? PIECE_VALUES[captured.type] ?? 0 : 0;
    const attacker = moving ? PIECE_VALUES[moving.type] ?? 0 : 0;
    score += 100_000 + victim * 10 - attacker;
  }
  if (move.kind === 'relocate_attack') {
    score += 500;
  }
  return score;
}

/**
 * @param {object[]} moves
 * @param {import('../rules/moveEngine.js').TriPosition} pos
 * @param {string} ttMoveKey
 */
export function orderMoves(moves, pos, ttMoveKey = '') {
  return [...moves].sort(
    (a, b) => scoreMove(b, pos, ttMoveKey) - scoreMove(a, pos, ttMoveKey),
  );
}

export { moveKey };
