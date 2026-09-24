import { parseCoordKey } from '../board/coordinates.js';
import { MAIN_BOARD_SIZE } from '../board/boardLayout.js';
import { updateStatus } from '../rules/moveEngine.js';

function maybePromote(piece, toKey) {
  if (piece.type !== 'p') return piece;
  const coord = parseCoordKey(toKey);
  if (!coord || coord.surface !== 'main') return piece;
  const lastRank = piece.color === 'w' ? MAIN_BOARD_SIZE - 1 : 0;
  if (coord.y === lastRank) return { ...piece, type: 'q' };
  return piece;
}

/**
 * @param {import('../rules/moveEngine.js').TriPosition} pos
 * @param {object} move
 */
export function makeSearchMove(pos, move) {
  if (move.kind === 'relocate_attack') {
    const undo = {
      kind: 'relocate_attack',
      boardIndex: move.boardIndex,
      prevSlot: pos.attackSlots[move.boardIndex],
      prevTurn: pos.turn,
      prevLastMove: pos.lastMove,
      prevStatus: pos.status,
      prevWinner: pos.winner,
    };
    pos.attackSlots[move.boardIndex] = move.toSlot;
    pos.turn = pos.turn === 'w' ? 'b' : 'w';
    pos.lastMove = move;
    updateStatus(pos);
    return undo;
  }

  const piece = pos.pieces.get(move.from);
  const captured = pos.pieces.get(move.to) ?? null;
  const undo = {
    kind: 'piece',
    from: move.from,
    to: move.to,
    piece,
    captured,
    prevTurn: pos.turn,
    prevLastMove: pos.lastMove,
    prevStatus: pos.status,
    prevWinner: pos.winner,
    capturedByWhiteLen: pos.capturedByWhite.length,
    capturedByBlackLen: pos.capturedByBlack.length,
  };

  if (captured) {
    if (captured.color === 'b') pos.capturedByWhite.push(captured.type);
    else pos.capturedByBlack.push(captured.type);
    pos.pieces.delete(move.to);
  }
  pos.pieces.delete(move.from);
  pos.pieces.set(move.to, maybePromote(piece, move.to));
  pos.turn = pos.turn === 'w' ? 'b' : 'w';
  pos.lastMove = move;
  updateStatus(pos);
  return undo;
}

/**
 * @param {import('../rules/moveEngine.js').TriPosition} pos
 * @param {object} undo
 */
export function unmakeSearchMove(pos, undo) {
  if (undo.kind === 'relocate_attack') {
    pos.attackSlots[undo.boardIndex] = undo.prevSlot;
    pos.turn = undo.prevTurn;
    pos.lastMove = undo.prevLastMove;
    pos.status = undo.prevStatus;
    pos.winner = undo.prevWinner;
    return;
  }

  pos.pieces.delete(undo.to);
  pos.pieces.set(undo.from, undo.piece);
  if (undo.captured) {
    pos.pieces.set(undo.to, undo.captured);
    if (undo.captured.color === 'b') {
      pos.capturedByWhite.length = undo.capturedByWhiteLen;
    } else {
      pos.capturedByBlack.length = undo.capturedByBlackLen;
    }
  }
  pos.turn = undo.prevTurn;
  pos.lastMove = undo.prevLastMove;
  pos.status = undo.prevStatus;
  pos.winner = undo.prevWinner;
}
