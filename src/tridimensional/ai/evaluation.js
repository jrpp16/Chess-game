import { MATERIAL } from '../rules/cgTdcV1Rules.js';
import { generateLegalMoves, generatePseudoMovesForPiece, isInCheck, isSquareAttacked } from '../rules/moveEngine.js';
import { parseCoordKey } from '../board/coordinates.js';
import { MAIN_BOARD_SIZE } from '../board/boardLayout.js';

const PIECE_VALUES = { ...MATERIAL, k: 200 };

function centerScore(x, y, size) {
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  return Math.max(0, 3 - (dx + dy) * 0.6);
}

function levelWeight(z, color) {
  if (color === 'w') return z === 0 ? 1.2 : z === 1 ? 1.05 : 0.95;
  return z === 2 ? 1.2 : z === 1 ? 1.05 : 0.95;
}

function findKingKey(pos, color) {
  for (const [key, piece] of pos.pieces.entries()) {
    if (piece.type === 'k' && piece.color === color) return key;
  }
  return null;
}

/**
 * @param {import('../rules/moveEngine.js').TriPosition} pos
 * @param {'w'|'b'} engineColor
 */
export function evaluatePosition(pos, engineColor) {
  if (pos.status === 'checkmate') {
    const winner = pos.winner;
    if (winner === engineColor) return 50_000;
    if (winner && winner !== engineColor) return -50_000;
  }
  if (pos.status === 'stalemate') return 0;
  if (pos.status === 'resigned') {
    if (pos.winner === engineColor) return 40_000;
    return -40_000;
  }

  const enemy = engineColor === 'w' ? 'b' : 'w';
  let score = 0;

  for (const [key, piece] of pos.pieces.entries()) {
    const coord = parseCoordKey(key);
    if (!coord) continue;
    const sign = piece.color === engineColor ? 1 : -1;
    const material = PIECE_VALUES[piece.type] ?? 0;
    score += sign * material;

    if (coord.surface === 'main') {
      score += sign * centerScore(coord.x, coord.y, MAIN_BOARD_SIZE) * 0.15;
      score += sign * (levelWeight(coord.z, piece.color) - 1) * 0.35;
    } else {
      score += sign * 0.25;
    }
  }

  const engineKing = findKingKey(pos, engineColor);
  const enemyKing = findKingKey(pos, enemy);
  if (engineKing && isInCheck(pos, engineColor)) {
    score -= 45;
  }
  if (enemyKing && isInCheck(pos, enemy)) {
    score += 35;
  }

  const mobilityView = { ...pos, status: 'active' };
  mobilityView.turn = engineColor;
  const engineMobility = generateLegalMoves(mobilityView).length;
  mobilityView.turn = enemy;
  const enemyMobility = generateLegalMoves(mobilityView).length;
  score += (engineMobility - enemyMobility) * 0.8;

  for (const [key, piece] of pos.pieces.entries()) {
    if (piece.color !== engineColor) continue;
    const attacked = isSquareAttacked(pos, key, enemy);
    if (!attacked) continue;
    const defended = isSquareAttacked(pos, key, engineColor);
    const val = PIECE_VALUES[piece.type] ?? 0;
    score -= defended ? val * 0.08 : val * 0.22;
  }

  for (const [key, piece] of pos.pieces.entries()) {
    if (piece.color !== enemy) continue;
    const attacked = isSquareAttacked(pos, key, engineColor);
    if (attacked) {
      const defended = isSquareAttacked(pos, key, enemy);
      const val = PIECE_VALUES[piece.type] ?? 0;
      score += defended ? val * 0.06 : val * 0.18;
    }
  }

  let attackBoardControl = 0;
  for (let boardIndex = 0; boardIndex < pos.attackSlots.length; boardIndex += 1) {
    let friendly = 0;
    let hostile = 0;
    for (const [key, piece] of pos.pieces.entries()) {
      const c = parseCoordKey(key);
      if (!c || c.surface !== 'attack' || c.z !== boardIndex) continue;
      if (piece.color === engineColor) friendly += 1;
      else hostile += 1;
    }
    if (friendly && !hostile) attackBoardControl += 0.4;
    if (hostile && !friendly) attackBoardControl -= 0.25;
    attackBoardControl += (pos.attackSlots[boardIndex] ?? 0) * 0.05 * (friendly > hostile ? 1 : -1);
  }
  score += attackBoardControl;

  if (engineKing) {
    const c = parseCoordKey(engineKing);
    if (c?.surface === 'main') {
      const edgeDist = Math.min(c.x, c.y, MAIN_BOARD_SIZE - 1 - c.x, MAIN_BOARD_SIZE - 1 - c.y);
      score += edgeDist * 0.12;
    }
  }

  return score;
}

/**
 * Lightweight mobility estimate without full legal gen for enemy turn override.
 * @param {import('../rules/moveEngine.js').TriPosition} pos
 * @param {'w'|'b'} color
 */
export function countMobility(pos, color) {
  let n = 0;
  for (const [key, piece] of pos.pieces.entries()) {
    if (piece.color !== color) continue;
    n += generatePseudoMovesForPiece(pos, key).length;
  }
  return n;
}
