/**
 * Chess-game Tri-Dimensional Chess (CG-TDC) v1
 *
 * This project intentionally implements a documented house variant inspired by
 * multi-level “Tri-Dimensional Chess” concepts (Star Trek / Andrew Bartmess lineage),
 * adapted to the Phase 1 board geometry (three 8×8 main levels + four 2×2 attack boards).
 *
 * It is NOT a claim of official tournament Bartmess rules.
 */

export const RULESET_ID = 'CG-TDC-v1';
export const RULESET_NAME = 'Chess-game Tri-Dimensional Chess v1';

export const RULES_SUMMARY = {
  board: {
    mainLevels: 3,
    mainSize: 8,
    attackBoards: 4,
    attackSize: 2,
  },
  start: {
    white: 'Standard chess setup on main level z=0 (y ranks 0–1).',
    black: 'Standard chess setup on main level z=2 (y ranks 6–7).',
    attackBoards: 'Empty at game start.',
  },
  movement: {
    sameLevel: 'Orthodox chess rules on the active 8×8 slice (fixed z).',
    vertical: 'Rook/Queen may traverse empty cells along the same (x,y) through z.',
    gateways: 'Listed gateway pairs connect main and attack cells (one step transfers).',
    attackMini: 'On a 2×2 attack board, kings move 1 square, other pieces use same-level rules scaled to 2×2 with no castling/en passant.',
  },
  attackBoardMotion: {
    description:
      'Each attack board can toggle between LOW/HIGH slot on its corner mast when moved as a legal board relocation move.',
    constraints:
      'Only the side to move; board must contain at least one friendly piece and no opponent pieces; relocation consumes the turn.',
  },
  special: {
    castling: 'Disabled in CG-TDC v1.',
    enPassant: 'Disabled in CG-TDC v1.',
    promotion: 'Pawn reaching last rank on its main level promotes to queen (default).',
  },
  end: {
    check: 'King threatened by any legal opponent move path.',
    checkmate: 'In check and no legal move.',
    stalemate: 'Not in check and no legal move.',
    resignation: 'Player resigns via UI.',
  },
};

/** Gateway pairs (undirected). One step move between endpoints if empty or capture at target. */
export const GATEWAYS = [
  ['m:0:0:0', 'a:0:0:0'],
  ['m:0:1:0', 'a:0:1:0'],
  ['m:0:7:0', 'a:1:0:0'],
  ['m:0:6:0', 'a:1:1:0'],
  ['m:2:0:7', 'a:2:0:1'],
  ['m:2:1:7', 'a:2:1:1'],
  ['m:2:7:7', 'a:3:0:1'],
  ['m:2:6:7', 'a:3:1:1'],
];

/** @type {Record<number, { low: number, high: number }>} world Y for attack slots */
export const ATTACK_SLOT_HEIGHT = {
  0: { low: 1.8, high: 2.55 },
  1: { low: 1.8, high: 2.55 },
  2: { low: 5.4, high: 6.15 },
  3: { low: 5.4, high: 6.15 },
};

export const MATERIAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export const CAPTURE_SORT = ['q', 'r', 'b', 'n', 'p'];
