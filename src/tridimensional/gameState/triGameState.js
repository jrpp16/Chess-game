import {
  applyMove,
  createInitialTriPosition,
  generateLegalMoves,
  isInCheck,
  materialAdvantage,
  resign,
  undoMove,
} from '../rules/moveEngine.js';
import { parseCoordKey, coordKey } from '../board/coordinates.js';

export { createInitialTriPosition as createInitialPosition };

export class TriGameState {
  constructor() {
    this.position = createInitialTriPosition();
    /** @type {string | null} */
    this.selectedKey = null;
    /** @type {object[]} */
    this.moveHistorySan = [];
  }

  reset() {
    this.position = createInitialTriPosition();
    this.selectedKey = null;
    this.moveHistorySan = [];
  }

  get pieces() {
    return this.position.pieces;
  }

  get turn() {
    return this.position.turn;
  }

  get attackSlots() {
    return this.position.attackSlots;
  }

  get status() {
    return this.position.status;
  }

  get winner() {
    return this.position.winner;
  }

  get capturedByWhite() {
    return this.position.capturedByWhite;
  }

  get capturedByBlack() {
    return this.position.capturedByBlack;
  }

  get lastMove() {
    return this.position.lastMove;
  }

  /** @param {import('../board/coordinates.js').TriCoord} coord */
  getPieceAt(coord) {
    return this.position.pieces.get(coordKey(coord)) ?? null;
  }

  getLegalTargets(fromKey) {
    return generateLegalMoves(this.position, fromKey).filter((m) => !m.kind);
  }

  /** @param {import('../board/coordinates.js').TriCoord} coord */
  selectOrMove(coord) {
    const targetKey = coordKey(coord);
    const targetPiece = this.position.pieces.get(targetKey);

    if (this.position.status !== 'active') {
      return { kind: 'ignored' };
    }

    if (!this.selectedKey) {
      if (!targetPiece || targetPiece.color !== this.position.turn) {
        return { kind: 'ignored' };
      }
      this.selectedKey = targetKey;
      return { kind: 'selected', key: targetKey, piece: targetPiece, legal: this.getLegalTargets(targetKey) };
    }

    if (this.selectedKey === targetKey) {
      this.selectedKey = null;
      return { kind: 'cleared' };
    }

    const move = { from: this.selectedKey, to: targetKey };
    const applied = applyMove(this.position, move);
    if (!applied) {
      if (targetPiece && targetPiece.color === this.position.turn) {
        this.selectedKey = targetKey;
        return { kind: 'selected', key: targetKey, piece: targetPiece, legal: this.getLegalTargets(targetKey) };
      }
      return { kind: 'illegal' };
    }

    this.position = applied;
    this.selectedKey = null;
    this.moveHistorySan.push(`${move.from}→${move.to}`);
    return { kind: 'moved', move, inCheck: isInCheck(this.position, this.position.turn) };
  }

  relocateAttackBoard(boardIndex) {
    const move = { kind: 'relocate_attack', boardIndex, toSlot: this.position.attackSlots[boardIndex] === 0 ? 1 : 0 };
    const applied = applyMove(this.position, move);
    if (!applied) return { kind: 'illegal' };
    this.position = applied;
    this.selectedKey = null;
    this.moveHistorySan.push(`A${boardIndex}:${move.toSlot === 1 ? 'HIGH' : 'LOW'}`);
    return { kind: 'relocated', move };
  }

  undo() {
    const prev = undoMove(this.position);
    if (!prev) return false;
    this.position = prev;
    this.selectedKey = null;
    this.moveHistorySan.pop();
    return true;
  }

  resignSide(color) {
    this.position = resign(this.position, color);
    this.selectedKey = null;
    return true;
  }

  materialDiff() {
    return materialAdvantage(this.position);
  }

  clearSelection() {
    this.selectedKey = null;
  }
}
