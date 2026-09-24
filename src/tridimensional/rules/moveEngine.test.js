import { describe, expect, it } from 'vitest';
import { createCoord, coordKey } from '../board/coordinates.js';
import {
  applyMove,
  createInitialTriPosition,
  generateLegalMoves,
  generatePseudoMovesForPiece,
  isInCheck,
  isSquareAttacked,
  materialAdvantage,
  resign,
  undoMove,
  classifyEndStatus,
  updateStatus,
} from './moveEngine.js';

describe('CG-TDC move engine', () => {
  it('starts with white to move and empty attack boards', () => {
    const pos = createInitialTriPosition();
    expect(pos.turn).toBe('w');
    expect(pos.pieces.size).toBe(32);
    expect(pos.attackSlots).toEqual([0, 0, 0, 0]);
  });

  it('generates pawn forward and double push on main level', () => {
    const pos = createInitialTriPosition();
    const from = coordKey(createCoord(4, 1, 0, 'main'));
    const moves = generatePseudoMovesForPiece(pos, from);
    const targets = moves.map((m) => m.to);
    expect(targets).toContain(coordKey(createCoord(4, 2, 0, 'main')));
    expect(targets).toContain(coordKey(createCoord(4, 3, 0, 'main')));
  });

  it('blocks rook path with friendly piece', () => {
    const pos = createInitialTriPosition();
    const from = coordKey(createCoord(0, 0, 0, 'main'));
    const moves = generatePseudoMovesForPiece(pos, from);
    expect(moves.some((m) => m.to === coordKey(createCoord(0, 2, 0, 'main')))).toBe(false);
  });

  it('allows knight jumps over blockers', () => {
    const pos = createInitialTriPosition();
    const from = coordKey(createCoord(1, 0, 0, 'main'));
    const moves = generatePseudoMovesForPiece(pos, from);
    expect(moves.some((m) => m.to === coordKey(createCoord(2, 2, 0, 'main')))).toBe(true);
  });

  it('rook moves vertically across main levels when file is clear', () => {
    const pos = createInitialTriPosition();
    pos.pieces.delete(coordKey(createCoord(4, 1, 0, 'main')));
    pos.pieces.delete(coordKey(createCoord(4, 2, 1, 'main')));
    pos.pieces.delete(coordKey(createCoord(4, 3, 2, 'main')));
    pos.pieces.delete(coordKey(createCoord(4, 4, 2, 'main')));
    pos.pieces.delete(coordKey(createCoord(4, 5, 2, 'main')));
    pos.pieces.delete(coordKey(createCoord(4, 6, 2, 'main')));
    pos.pieces.set(coordKey(createCoord(4, 0, 0, 'main')), { color: 'w', type: 'r' });
    const from = coordKey(createCoord(4, 0, 0, 'main'));
    const moves = generatePseudoMovesForPiece(pos, from);
    expect(moves.some((m) => m.to === coordKey(createCoord(4, 0, 2, 'main')))).toBe(true);
  });

  it('gateway move from main corner to attack board', () => {
    const pos = createInitialTriPosition();
    pos.pieces.delete(coordKey(createCoord(0, 0, 0, 'main')));
    pos.pieces.set(coordKey(createCoord(0, 0, 0, 'main')), { color: 'w', type: 'n' });
    const moves = generatePseudoMovesForPiece(pos, coordKey(createCoord(0, 0, 0, 'main')));
    expect(moves.some((m) => m.to === coordKey(createCoord(0, 0, 0, 'attack')))).toBe(true);
  });

  it('rejects king moves into attacked squares', () => {
    const pos = createInitialTriPosition();
    pos.pieces.clear();
    pos.pieces.set(coordKey(createCoord(4, 4, 0, 'main')), { color: 'w', type: 'k' });
    pos.pieces.set(coordKey(createCoord(4, 7, 0, 'main')), { color: 'b', type: 'r' });
    pos.turn = 'w';
    const kingKey = coordKey(createCoord(4, 4, 0, 'main'));
    const legal = generateLegalMoves(pos, kingKey);
    expect(legal.some((m) => m.to === coordKey(createCoord(4, 5, 0, 'main')))).toBe(false);
  });

  it('classifies checkmate when no piece moves remain while in check', () => {
    const pos = createInitialTriPosition();
    pos.pieces.clear();
    pos.pieces.set(coordKey(createCoord(4, 0, 0, 'main')), { color: 'w', type: 'k' });
    pos.pieces.set(coordKey(createCoord(5, 1, 0, 'main')), { color: 'b', type: 'q' });
    pos.turn = 'w';
    expect(isInCheck(pos, 'w')).toBe(true);
    expect(classifyEndStatus(pos, [])).toEqual({ status: 'checkmate', winner: 'b' });
  });

  it('classifies stalemate when no legal moves and not in check', () => {
    const pos = createInitialTriPosition();
    pos.turn = 'b';
    expect(classifyEndStatus(pos, [])).toEqual({ status: 'stalemate', winner: null });
  });

  it('applyMove triggers stalemate on discovered position', () => {
    const pos = createInitialTriPosition();
    pos.pieces.clear();
    pos.pieces.set(coordKey(createCoord(6, 6, 0, 'main')), { color: 'b', type: 'k' });
    pos.pieces.set(coordKey(createCoord(0, 0, 0, 'main')), { color: 'w', type: 'q' });
    pos.pieces.set(coordKey(createCoord(6, 7, 0, 'main')), { color: 'w', type: 'k' });
    pos.turn = 'w';
    const next = applyMove(pos, {
      from: coordKey(createCoord(0, 0, 0, 'main')),
      to: coordKey(createCoord(6, 6, 0, 'main')),
    });
    expect(next?.status).toBe('stalemate');
  });

  it('captures and tracks material', () => {
    const pos = createInitialTriPosition();
    pos.pieces.clear();
    pos.pieces.set(coordKey(createCoord(4, 4, 0, 'main')), { color: 'w', type: 'q' });
    pos.pieces.set(coordKey(createCoord(4, 5, 0, 'main')), { color: 'b', type: 'r' });
    pos.turn = 'w';
    const next = applyMove(pos, {
      from: coordKey(createCoord(4, 4, 0, 'main')),
      to: coordKey(createCoord(4, 5, 0, 'main')),
    });
    expect(next?.capturedByWhite).toEqual(['r']);
    expect(materialAdvantage(next)).toBe(5);
  });

  it('promotes pawn to queen on last rank', () => {
    const pos = createInitialTriPosition();
    pos.pieces.clear();
    pos.pieces.set(coordKey(createCoord(4, 6, 0, 'main')), { color: 'w', type: 'p' });
    pos.turn = 'w';
    const next = applyMove(pos, {
      from: coordKey(createCoord(4, 6, 0, 'main')),
      to: coordKey(createCoord(4, 7, 0, 'main')),
    });
    expect(next?.pieces.get(coordKey(createCoord(4, 7, 0, 'main')))?.type).toBe('q');
  });

  it('allows attack board relocation with friendly piece and no opponent', () => {
    const pos = createInitialTriPosition();
    pos.pieces.set(coordKey(createCoord(0, 0, 0, 'attack')), { color: 'w', type: 'p' });
    const legal = generateLegalMoves(pos).filter((m) => m.kind === 'relocate_attack');
    expect(legal.some((m) => m.boardIndex === 0)).toBe(true);
    const next = applyMove(pos, { kind: 'relocate_attack', boardIndex: 0, toSlot: 1 });
    expect(next?.attackSlots[0]).toBe(1);
    expect(next?.turn).toBe('b');
  });

  it('blocks attack relocation with opponent piece on board', () => {
    const pos = createInitialTriPosition();
    pos.pieces.set(coordKey(createCoord(0, 0, 0, 'attack')), { color: 'b', type: 'p' });
    const legal = generateLegalMoves(pos).filter((m) => m.kind === 'relocate_attack' && m.boardIndex === 0);
    expect(legal.length).toBe(0);
  });

  it('undo restores previous position', () => {
    const pos = createInitialTriPosition();
    const from = coordKey(createCoord(4, 1, 0, 'main'));
    const to = coordKey(createCoord(4, 3, 0, 'main'));
    const next = applyMove(pos, { from, to });
    expect(next?.pieces.get(to)?.type).toBe('p');
    const prev = undoMove(next);
    expect(prev?.pieces.get(from)?.type).toBe('p');
    expect(prev?.turn).toBe('w');
  });

  it('resign sets winner', () => {
    const pos = createInitialTriPosition();
    const next = resign(pos, 'w');
    expect(next.status).toBe('resigned');
    expect(next.winner).toBe('b');
  });

  it('isSquareAttacked respects bishop diagonal', () => {
    const pos = createInitialTriPosition();
    pos.pieces.clear();
    pos.pieces.set(coordKey(createCoord(0, 0, 0, 'main')), { color: 'w', type: 'k' });
    pos.pieces.set(coordKey(createCoord(3, 3, 0, 'main')), { color: 'b', type: 'b' });
    expect(isSquareAttacked(pos, coordKey(createCoord(0, 0, 0, 'main')), 'b')).toBe(true);
  });

  it('new game baseline after moves via undo chain', () => {
    let pos = createInitialTriPosition();
    pos = applyMove(pos, {
      from: coordKey(createCoord(4, 1, 0, 'main')),
      to: coordKey(createCoord(4, 3, 0, 'main')),
    });
    pos = undoMove(pos);
    expect(pos?.pieces.size).toBe(32);
  });
});
