import { createCoord } from './coordinates.js';

export const MAIN_LEVELS = 3;
export const MAIN_BOARD_SIZE = 8;
export const ATTACK_BOARD_SIZE = 2;
export const ATTACK_BOARD_COUNT = 4;

/** @typedef {{ wx: number, wy: number, wz: number }} WorldPoint */

/**
 * @returns {import('./coordinates.js').TriCoord[]}
 */
export function getAllBoardCells() {
  /** @type {import('./coordinates.js').TriCoord[]} */
  const cells = [];

  for (let z = 0; z < MAIN_LEVELS; z += 1) {
    for (let x = 0; x < MAIN_BOARD_SIZE; x += 1) {
      for (let y = 0; y < MAIN_BOARD_SIZE; y += 1) {
        cells.push(createCoord(x, y, z, 'main'));
      }
    }
  }

  for (let attackIndex = 0; attackIndex < ATTACK_BOARD_COUNT; attackIndex += 1) {
    for (let x = 0; x < ATTACK_BOARD_SIZE; x += 1) {
      for (let y = 0; y < ATTACK_BOARD_SIZE; y += 1) {
        cells.push(createCoord(x, y, attackIndex, 'attack'));
      }
    }
  }

  return cells;
}

const ATTACK_OFFSETS = [
  { wx: -6.2, wy: 1.8, wz: -6.2 },
  { wx: 6.2, wy: 1.8, wz: -6.2 },
  { wx: -6.2, wy: 5.4, wz: 6.2 },
  { wx: 6.2, wy: 5.4, wz: 6.2 },
];

const CELL = 0.95;
const LEVEL_GAP = 3.6;

/**
 * Maps logical coordinates to world space (Y-up).
 * @param {import('./coordinates.js').TriCoord} coord
 * @returns {WorldPoint}
 */
export function coordToWorld(coord) {
  if (coord.surface === 'main') {
    return {
      wx: (coord.x - (MAIN_BOARD_SIZE - 1) / 2) * CELL,
      wy: coord.z * LEVEL_GAP,
      wz: (coord.y - (MAIN_BOARD_SIZE - 1) / 2) * CELL,
    };
  }

  const base = ATTACK_OFFSETS[coord.z] ?? ATTACK_OFFSETS[0];
  return {
    wx: base.wx + (coord.x - 0.5) * CELL,
    wy: base.wy,
    wz: base.wz + (coord.y - 0.5) * CELL,
  };
}

/**
 * @param {WorldPoint} point
 * @returns {import('./coordinates.js').TriCoord | null}
 */
export function worldToNearestCell(point) {
  let best = null;
  let bestDist = Infinity;

  for (const cell of getAllBoardCells()) {
    const w = coordToWorld(cell);
    const dx = w.wx - point.wx;
    const dy = w.wy - point.wy;
    const dz = w.wz - point.wz;
    const dist = dx * dx + dy * dy + dz * dz;
    if (dist < bestDist) {
      bestDist = dist;
      best = cell;
    }
  }

  if (bestDist > CELL * CELL * 2.5) {
    return null;
  }

  return best;
}

export function isValidCell(coord) {
  if (coord.surface === 'main') {
    return (
      coord.z >= 0 &&
      coord.z < MAIN_LEVELS &&
      coord.x >= 0 &&
      coord.x < MAIN_BOARD_SIZE &&
      coord.y >= 0 &&
      coord.y < MAIN_BOARD_SIZE
    );
  }

  return (
    coord.z >= 0 &&
    coord.z < ATTACK_BOARD_COUNT &&
    coord.x >= 0 &&
    coord.x < ATTACK_BOARD_SIZE &&
    coord.y >= 0 &&
    coord.y < ATTACK_BOARD_SIZE
  );
}
