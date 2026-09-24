import { describe, expect, it } from 'vitest';
import { createInitialPosition } from './startPositions.js';

describe('tri start positions', () => {
  it('places white on z=0 and black on z=2', () => {
    const pos = createInitialPosition();
    const pieces = pos.pieces;
    let whiteOnBottom = 0;
    let blackOnTop = 0;

    for (const key of pieces.keys()) {
      if (key.startsWith('m:0:')) whiteOnBottom += 1;
      if (key.startsWith('m:2:')) blackOnTop += 1;
    }

    expect(whiteOnBottom).toBe(16);
    expect(blackOnTop).toBe(16);
  });
});
