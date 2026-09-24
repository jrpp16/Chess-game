import { parseCoordKey } from '../board/coordinates.js';
import { createInitialTriPosition } from '../rules/moveEngine.js';

/** @typedef {import('../rules/moveEngine.js').TriPosition} TriPosition */

/**
 * @param {TriPosition} pos
 */
export function serializePosition(pos) {
  const pieces = [...pos.pieces.entries()].map(([key, piece]) => [key, piece]);
  return {
    pieces,
    turn: pos.turn,
    attackSlots: [...pos.attackSlots],
    status: pos.status,
    winner: pos.winner,
    lastMove: pos.lastMove,
    capturedByWhite: [...pos.capturedByWhite],
    capturedByBlack: [...pos.capturedByBlack],
  };
}

/**
 * @param {ReturnType<typeof serializePosition>} data
 * @returns {TriPosition}
 */
export function deserializePosition(data) {
  const pieces = new Map(data.pieces);
  return {
    pieces,
    turn: data.turn,
    attackSlots: [...data.attackSlots],
    status: data.status,
    winner: data.winner,
    lastMove: data.lastMove ? { ...data.lastMove } : null,
    history: [],
    capturedByWhite: [...data.capturedByWhite],
    capturedByBlack: [...data.capturedByBlack],
  };
}

/**
 * @param {TriPosition} pos
 */
export function positionFingerprint(pos) {
  const parts = [pos.turn, pos.attackSlots.join(','), pos.status];
  const keys = [...pos.pieces.keys()].sort();
  for (const key of keys) {
    const p = pos.pieces.get(key);
    parts.push(`${key}:${p.color}${p.type}`);
  }
  return parts.join('|');
}

export function cloneSearchPosition(pos) {
  const base = deserializePosition(serializePosition(pos));
  base.history = [];
  return base;
}

export { createInitialTriPosition };
