import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import {
  HARD_TIMEOUT_MARGIN_MS,
  searchBestMoveTimed,
  TIME_LIMIT_MS,
} from './search.js';
import { evaluatePosition } from './evaluation.js';

const OPENING =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const MIDDLEGAME = 'r1bq1rk1/pp2bppp/2n1bn2/3pp3/3P4/2NBPN2/PP3PPP/R1BQ1RK1 w - - 0 9';

const TACTICAL = '2b1qrk1/1rpnbppp/p2p1n2/1B1P4/4PpP1/2P2N1P/PP3P2/RN1QR1K1 b - g3 0 15';

const ENDGAME = '6k1/5ppp/8/8/8/8/5PPP/5RK1 w - - 0 1';

const PROMOTION =
  '4k3/P7/8/8/8/8/6p1/4K3 w - - 0 1';

const CHECK = 'rnb1kbnr/pppp1ppp/8/4q3/6P1/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';

function maxAllowedMs(difficulty) {
  const base = TIME_LIMIT_MS[difficulty];
  const margin = HARD_TIMEOUT_MARGIN_MS[difficulty];
  return base + margin + 120;
}

function assertSearchCompletes(fen, difficulty, engineColor) {
  const wallStart = performance.now();
  const result = searchBestMoveTimed(fen, difficulty, engineColor);
  const wallMs = performance.now() - wallStart;
  expect(result.move).toBeTruthy();
  expect(wallMs).toBeLessThan(maxAllowedMs(difficulty));
  expect(result.stats.timeMs).toBeLessThanOrEqual(maxAllowedMs(difficulty));
  return result;
}

describe('classic chess AI search', () => {
  it('evaluates positions with en passant without throwing (side mobility flip)', () => {
    const chess = new Chess(TACTICAL);
    expect(() => evaluatePosition(chess, 'w', 0)).not.toThrow();
    expect(() => evaluatePosition(chess, 'b', 0)).not.toThrow();
  });

  it('searches the former crash FEN within time limits', () => {
    const fen = '2b1qrk1/1rpnbppp/p2p1n2/1B1Pp3/4P3/2P2N1P/PP3PP1/RNBQR1K1 w - - 1 14';
    expect(() => assertSearchCompletes(fen, 'medium', 'w')).not.toThrow();
  });

  it.each([
    ['opening', OPENING, 'b'],
    ['middlegame', MIDDLEGAME, 'b'],
    ['tactical ep', TACTICAL, 'b'],
    ['endgame', ENDGAME, 'w'],
    ['promotion', PROMOTION, 'w'],
    ['check', CHECK, 'b'],
  ])('respects soft/hard deadlines on %s', (_label, fen, engineColor) => {
    assertSearchCompletes(fen, 'medium', engineColor);
    assertSearchCompletes(fen, 'hard', engineColor);
  });

  it('completes 30 consecutive searches in a evolving game without hanging', { timeout: 120_000 }, () => {
    const chess = new Chess();
    const line = [
      'e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7',
      'Re1', 'b5', 'Bb3', 'd6', 'c3', 'O-O', 'h3', 'Nb8', 'd4', 'Nbd7',
    ];
    for (const san of line) {
      chess.move(san);
    }

    for (let i = 0; i < 30; i += 1) {
      if (chess.isGameOver()) break;
      const engineColor = chess.turn();
      const { move, stats } = assertSearchCompletes(chess.fen(), 'medium', engineColor);
      expect(stats.quiescenceNodes).toBeGreaterThanOrEqual(0);
      const applied = chess.move(move);
      expect(applied).toBeTruthy();
    }
  });
});
