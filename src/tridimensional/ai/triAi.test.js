import { describe, expect, it } from 'vitest';
import { createCoord, coordKey } from '../board/coordinates.js';
import { TriGameState } from '../gameState/triGameState.js';
import {
  applyMove,
  createInitialTriPosition,
  generateLegalMoves,
  isInCheck,
} from '../rules/moveEngine.js';
import {
  applyValidatedTriMove,
  beginTriSearchToken,
  cancelTriSearch,
  isTriSearchTokenCurrent,
  TIME_LIMIT_MS,
} from './searchClient.js';
import { searchBestMoveTimed } from './search.js';
import { orderMoves } from './moveOrdering.js';
import { hashPosition } from './transposition.js';
import { evaluatePosition } from './evaluation.js';

describe('tri AI', () => {
  it('exposes difficulty time limits', () => {
    expect(TIME_LIMIT_MS.easy).toBe(150);
    expect(TIME_LIMIT_MS.medium).toBe(500);
    expect(TIME_LIMIT_MS.hard).toBe(1500);
  });

  it('search returns only legal moves', () => {
    const pos = createInitialTriPosition();
    const { move } = searchBestMoveTimed(pos, 'easy', 'w');
    expect(move).toBeTruthy();
    const legal = generateLegalMoves(pos);
    const ok = move.kind === 'relocate_attack'
      ? legal.some((m) => m.kind === 'relocate_attack' && m.boardIndex === move.boardIndex)
      : legal.some((m) => m.from === move.from && m.to === move.to);
    expect(ok).toBe(true);
  });

  it('bot orders capture of hanging queen first', () => {
    const pos = createInitialTriPosition();
    pos.pieces.clear();
    pos.pieces.set(coordKey(createCoord(4, 4, 0, 'main')), { color: 'w', type: 'q' });
    pos.pieces.set(coordKey(createCoord(4, 5, 0, 'main')), { color: 'b', type: 'r' });
    pos.pieces.set(coordKey(createCoord(0, 0, 0, 'main')), { color: 'w', type: 'k' });
    pos.pieces.set(coordKey(createCoord(7, 7, 2, 'main')), { color: 'b', type: 'k' });
    pos.turn = 'b';
    const capture = generateLegalMoves(pos).find((m) => m.capture);
    expect(capture?.to).toBe(coordKey(createCoord(4, 4, 0, 'main')));
    const ordered = orderMoves(generateLegalMoves(pos), pos);
    expect(ordered[0].to).toBe(capture?.to);
  });

  it('evaluation penalizes king in check for side to move', () => {
    const pos = createInitialTriPosition();
    pos.pieces.clear();
    pos.pieces.set(coordKey(createCoord(4, 0, 0, 'main')), { color: 'w', type: 'k' });
    pos.pieces.set(coordKey(createCoord(5, 1, 0, 'main')), { color: 'b', type: 'q' });
    pos.pieces.set(coordKey(createCoord(6, 0, 0, 'main')), { color: 'b', type: 'k' });
    pos.turn = 'w';
    expect(isInCheck(pos, 'w')).toBe(true);
    const safe = createInitialTriPosition();
    safe.pieces.clear();
    safe.pieces.set(coordKey(createCoord(4, 0, 0, 'main')), { color: 'w', type: 'k' });
    safe.pieces.set(coordKey(createCoord(5, 3, 0, 'main')), { color: 'b', type: 'q' });
    safe.pieces.set(coordKey(createCoord(6, 0, 0, 'main')), { color: 'b', type: 'k' });
    safe.turn = 'w';
    expect(isInCheck(safe, 'w')).toBe(false);
    expect(evaluatePosition(pos, 'w')).toBeLessThan(evaluatePosition(safe, 'w'));
  });

  it('finds escape move when king is in check', () => {
    const pos = createInitialTriPosition();
    pos.pieces.clear();
    pos.pieces.set(coordKey(createCoord(4, 0, 0, 'main')), { color: 'w', type: 'k' });
    pos.pieces.set(coordKey(createCoord(5, 1, 0, 'main')), { color: 'b', type: 'q' });
    pos.pieces.set(coordKey(createCoord(6, 0, 0, 'main')), { color: 'b', type: 'k' });
    pos.turn = 'w';
    const { move } = searchBestMoveTimed(pos, 'hard', 'w');
    const trial = applyMove(pos, move);
    expect(isInCheck(trial, 'w')).toBe(false);
  });

  it('search finishes within time budget', () => {
    const pos = createInitialTriPosition();
    const { stats } = searchBestMoveTimed(pos, 'easy', 'w');
    expect(stats.timeMs).toBeLessThanOrEqual(TIME_LIMIT_MS.easy + 80);
    expect(stats.depth).toBeGreaterThan(0);
    expect(stats.nodes).toBeGreaterThan(0);
  });

  it('cancelled search token rejects stale results', () => {
    const token = beginTriSearchToken();
    cancelTriSearch();
    expect(isTriSearchTokenCurrent(token)).toBe(false);
  });

  it('applyValidatedTriMove updates history', () => {
    const state = new TriGameState();
    const move = generateLegalMoves(state.position)[0];
    expect(applyValidatedTriMove(state, move)).toBe(true);
    expect(state.moveHistorySan.length).toBe(1);
  });

  it('search token increments on cancel', () => {
    const t1 = beginTriSearchToken();
    cancelTriSearch();
    expect(isTriSearchTokenCurrent(t1)).toBe(false);
  });

  it('orders captures ahead of quiet moves', () => {
    const pos = createInitialTriPosition();
    pos.pieces.clear();
    pos.pieces.set(coordKey(createCoord(4, 4, 0, 'main')), { color: 'w', type: 'q' });
    pos.pieces.set(coordKey(createCoord(4, 5, 0, 'main')), { color: 'b', type: 'r' });
    pos.pieces.set(coordKey(createCoord(0, 0, 0, 'main')), { color: 'w', type: 'k' });
    pos.pieces.set(coordKey(createCoord(7, 7, 2, 'main')), { color: 'b', type: 'k' });
    pos.turn = 'b';
    const moves = generateLegalMoves(pos);
    const ordered = orderMoves(moves, pos);
    expect(ordered[0].capture).toBe(true);
  });

  it('hashes positions deterministically', () => {
    const a = createInitialTriPosition();
    const b = createInitialTriPosition();
    expect(hashPosition(a)).toBe(hashPosition(b));
  });
});
