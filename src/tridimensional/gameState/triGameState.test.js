import { describe, expect, it } from 'vitest';
import { createInitialPosition, TriGameState } from '../gameState/triGameState.js';
import { createCoord } from '../board/coordinates.js';

describe('tri game state', () => {
  it('starts with 32 pieces on main levels', () => {
    const pos = createInitialPosition();
    expect(pos.pieces.size).toBe(32);
  });

  it('selects and moves a legal pawn double step', () => {
    const state = new TriGameState();
    const from = createCoord(4, 1, 0, 'main');
    const to = createCoord(4, 3, 0, 'main');

    const selected = state.selectOrMove(from);
    expect(selected.kind).toBe('selected');

    const moved = state.selectOrMove(to);
    expect(moved.kind).toBe('moved');
    expect(state.getPieceAt(from)).toBeNull();
    expect(state.getPieceAt(to)?.type).toBe('p');
  });

  it('resets on new game', () => {
    const state = new TriGameState();
    state.selectOrMove(createCoord(4, 1, 0, 'main'));
    state.selectOrMove(createCoord(4, 3, 0, 'main'));
    state.reset();
    expect(state.selectedKey).toBeNull();
    expect(state.pieces.size).toBe(32);
  });
});
