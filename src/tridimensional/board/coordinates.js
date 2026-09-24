/** @typedef {'w'|'b'} PieceColor */
/** @typedef {'k'|'q'|'r'|'b'|'n'|'p'} PieceType */

/**
 * @typedef {object} TriCoord
 * @property {number} x
 * @property {number} y
 * @property {number} z level (main) or attack-board index (attack)
 * @property {'main'|'attack'} surface
 */

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {'main'|'attack'} surface
 * @returns {TriCoord}
 */
export function createCoord(x, y, z, surface = 'main') {
  return { x, y, z, surface };
}

/**
 * @param {TriCoord} coord
 */
export function coordKey(coord) {
  if (coord.surface === 'attack') {
    return `a:${coord.z}:${coord.x}:${coord.y}`;
  }
  return `m:${coord.z}:${coord.x}:${coord.y}`;
}

/**
 * @param {string} key
 * @returns {TriCoord | null}
 */
export function parseCoordKey(key) {
  const parts = key.split(':');
  if (parts.length !== 4) return null;
  if (parts[0] === 'm') {
    return createCoord(Number(parts[2]), Number(parts[3]), Number(parts[1]), 'main');
  }
  if (parts[0] === 'a') {
    return createCoord(Number(parts[2]), Number(parts[3]), Number(parts[1]), 'attack');
  }
  return null;
}

export function coordsEqual(a, b) {
  return a.x === b.x && a.y === b.y && a.z === b.z && a.surface === b.surface;
}
