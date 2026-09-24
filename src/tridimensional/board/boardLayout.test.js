import { describe, expect, it } from 'vitest';
import {
  ATTACK_BOARD_COUNT,
  ATTACK_BOARD_SIZE,
  MAIN_BOARD_SIZE,
  MAIN_LEVELS,
  getAllBoardCells,
  isValidCell,
  coordToWorld,
  worldToNearestCell,
} from './boardLayout.js';
import { createCoord } from './coordinates.js';

describe('tri board layout', () => {
  it('builds all main and attack cells', () => {
    const cells = getAllBoardCells();
    const expected = MAIN_LEVELS * MAIN_BOARD_SIZE * MAIN_BOARD_SIZE +
      ATTACK_BOARD_COUNT * ATTACK_BOARD_SIZE * ATTACK_BOARD_SIZE;
    expect(cells).toHaveLength(expected);
  });

  it('validates coordinate bounds', () => {
    expect(isValidCell(createCoord(0, 0, 0, 'main'))).toBe(true);
    expect(isValidCell(createCoord(8, 0, 0, 'main'))).toBe(false);
    expect(isValidCell(createCoord(0, 0, 0, 'attack'))).toBe(true);
    expect(isValidCell(createCoord(2, 0, 0, 'attack'))).toBe(false);
  });

  it('maps world points back to nearest cell', () => {
    const cell = createCoord(4, 4, 1, 'main');
    const world = coordToWorld(cell);
    const nearest = worldToNearestCell(world);
    expect(nearest?.x).toBe(4);
    expect(nearest?.y).toBe(4);
    expect(nearest?.z).toBe(1);
  });
});
