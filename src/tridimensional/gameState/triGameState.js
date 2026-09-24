import { createCoord, coordKey } from '../board/coordinates.js';
import { isValidCell } from '../board/boardLayout.js';

/** @typedef {'k'|'q'|'r'|'b'|'n'|'p'} PieceType */
/** @typedef {'w'|'b'} PieceColor */
/** @typedef {{ color: PieceColor, type: PieceType }} Piece */

const BACK_RANK = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

/**
 * @returns {Map<string, Piece>}
 */
export function createInitialPosition() {
  /** @type {Map<string, Piece>} */
  const pieces = new Map();

  for (let x = 0; x < 8; x += 1) {
    pieces.set(coordKey(createCoord(x, 0, 0, 'main')), { color: 'w', type: BACK_RANK[x] });
    pieces.set(coordKey(createCoord(x, 1, 0, 'main')), { color: 'w', type: 'p' });
    pieces.set(coordKey(createCoord(x, 6, 2, 'main')), { color: 'b', type: 'p' });
    pieces.set(coordKey(createCoord(x, 7, 2, 'main')), { color: 'b', type: BACK_RANK[x] });
  }

  return pieces;
}

export class TriGameState {
  constructor() {
    this.pieces = createInitialPosition();
    /** @type {string | null} */
    this.selectedKey = null;
  }

  reset() {
    this.pieces = createInitialPosition();
    this.selectedKey = null;
  }

  /** @param {import('../board/coordinates.js').TriCoord} coord */
  getPieceAt(coord) {
    return this.pieces.get(coordKey(coord)) ?? null;
  }

  /** @param {import('../board/coordinates.js').TriCoord} coord */
  selectOrMove(coord) {
    if (!isValidCell(coord)) {
      return { kind: 'ignored' };
    }

    const targetKey = coordKey(coord);
    const targetPiece = this.pieces.get(targetKey);

    if (!this.selectedKey) {
      if (!targetPiece) {
        return { kind: 'ignored' };
      }
      this.selectedKey = targetKey;
      return { kind: 'selected', key: targetKey, piece: targetPiece };
    }

    if (this.selectedKey === targetKey) {
      this.selectedKey = null;
      return { kind: 'cleared' };
    }

    const moving = this.pieces.get(this.selectedKey);
    if (!moving) {
      this.selectedKey = null;
      return { kind: 'cleared' };
    }

    const fromKey = this.selectedKey;
    this.pieces.delete(fromKey);
    if (targetPiece) {
      this.pieces.delete(targetKey);
    }
    this.pieces.set(targetKey, moving);
    this.selectedKey = null;

    return { kind: 'moved', from: fromKey, to: targetKey, piece: moving };
  }

  clearSelection() {
    this.selectedKey = null;
  }
}
