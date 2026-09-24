import { describe, expect, it } from 'vitest';
import { createInitialPosition, TriGameState } from '../gameState/triGameState.js';
import { createCoord } from '../board/coordinates.js';

describe('tri game state', () => {
  it('starts with 32 pieces on main levels', () => {
    const pieces = createInitialPosition();
    expect(pieces.size).toBe(32);
  });

  it('selects and moves a piece without separate tracking', () => {
    const state = new TriGameState();
    const from = createCoord(0, 0, 0, 'main');
    const to = createCoord(0, 2, 0, 'main');

    const selected = state.selectOrMove(from);
    expect(selected.kind).toBe('selected');

    const moved = state.selectOrMove(to);
    expect(moved.kind).toBe('moved');
    expect(state.getPieceAt(from)).toBeNull();
    expect(state.getPieceAt(to)?.type).toBe('r');
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
