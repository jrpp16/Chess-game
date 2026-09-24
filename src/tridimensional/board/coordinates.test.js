import { describe, expect, it } from 'vitest';
import { coordKey, createCoord, parseCoordKey, coordsEqual } from './coordinates.js';

describe('tri coordinates', () => {
  it('creates unique keys for main and attack surfaces', () => {
    const main = createCoord(3, 4, 1, 'main');
    const attack = createCoord(0, 1, 2, 'attack');
    expect(coordKey(main)).toBe('m:1:3:4');
    expect(coordKey(attack)).toBe('a:2:0:1');
  });

  it('round-trips keys', () => {
    const key = 'm:2:7:0';
    const parsed = parseCoordKey(key);
    expect(parsed).toEqual(createCoord(7, 0, 2, 'main'));
    expect(coordKey(parsed)).toBe(key);
  });

  it('compares coordinates', () => {
    expect(coordsEqual(createCoord(1, 2, 0, 'main'), createCoord(1, 2, 0, 'main'))).toBe(true);
    expect(coordsEqual(createCoord(1, 2, 0, 'main'), createCoord(1, 2, 1, 'main'))).toBe(false);
  });
});
