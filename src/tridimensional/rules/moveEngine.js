import { parseCoordKey, coordKey, createCoord } from '../board/coordinates.js';
import { GATEWAYS, MATERIAL } from './cgTdcV1Rules.js';
import { MAIN_BOARD_SIZE, ATTACK_BOARD_SIZE } from '../board/boardLayout.js';

/** @typedef {'w'|'b'} Color */
/** @typedef {'k'|'q'|'r'|'b'|'n'|'p'} PieceType */
/** @typedef {{ color: Color, type: PieceType }} Piece */

const gatewayMap = new Map();
for (const [a, b] of GATEWAYS) {
  gatewayMap.set(a, b);
  gatewayMap.set(b, a);
}

export function clonePosition(pos) {
  return {
    pieces: new Map(pos.pieces),
    turn: pos.turn,
    attackSlots: [...pos.attackSlots],
    status: pos.status,
    winner: pos.winner,
    lastMove: pos.lastMove ? { ...pos.lastMove } : null,
    history: [...pos.history],
    capturedByWhite: [...pos.capturedByWhite],
    capturedByBlack: [...pos.capturedByBlack],
  };
}

function pawnDirection(color) {
  return color === 'w' ? 1 : -1;
}

function inBounds(x, y, size) {
  return x >= 0 && x < size && y >= 0 && y < size;
}

function addMove(moves, fromKey, toKey, pos) {
  const moving = pos.pieces.get(fromKey);
  const target = pos.pieces.get(toKey);
  if (!moving) return;
  if (target && target.color === moving.color) return;
  moves.push({ from: fromKey, to: toKey, capture: Boolean(target) });
}

function rayMoves(pos, fromKey, dx, dy, dz, maxSteps = 7) {
  const moves = [];
  const from = parseCoordKey(fromKey);
  const moving = pos.pieces.get(fromKey);
  if (!from || !moving) return moves;
  const size = from.surface === 'attack' ? ATTACK_BOARD_SIZE : MAIN_BOARD_SIZE;

  for (let step = 1; step <= maxSteps; step += 1) {
    let nx = from.x + dx * step;
    let ny = from.y + dy * step;
    let nz = from.z + dz * step;

    if (from.surface === 'main') {
      if (dx !== 0 || dy !== 0) {
        nz = from.z;
      } else if (dz !== 0) {
        nx = from.x;
        ny = from.y;
      }
      if (nz < 0 || nz > 2) break;
      if (!inBounds(nx, ny, MAIN_BOARD_SIZE)) break;
      const toKey = coordKey(createCoord(nx, ny, nz, 'main'));
      const occupant = pos.pieces.get(toKey);
      if (!occupant) {
        moves.push({ from: fromKey, to: toKey, capture: false });
        continue;
      }
      if (occupant.color !== moving.color) {
        moves.push({ from: fromKey, to: toKey, capture: true });
      }
      break;
    }

    if (!inBounds(nx, ny, size)) break;
    const toKey = coordKey(createCoord(nx, ny, from.z, 'attack'));
    const occupant = pos.pieces.get(toKey);
    if (!occupant) {
      moves.push({ from: fromKey, to: toKey, capture: false });
      continue;
    }
    if (occupant.color !== moving.color) {
      moves.push({ from: fromKey, to: toKey, capture: true });
    }
    break;
  }

  return moves;
}

function knightOffsets() {
  return [
    [1, 2],
    [2, 1],
    [-1, 2],
    [-2, 1],
    [1, -2],
    [2, -1],
    [-1, -2],
    [-2, -1],
  ];
}

export function generatePseudoMovesForPiece(pos, fromKey) {
  const piece = pos.pieces.get(fromKey);
  if (!piece) return [];
  const from = parseCoordKey(fromKey);
  if (!from) return [];

  const size = from.surface === 'attack' ? ATTACK_BOARD_SIZE : MAIN_BOARD_SIZE;
  /** @type {{from:string,to:string,capture:boolean}[]} */
  const moves = [];

  if (piece.type === 'p') {
    const dir = pawnDirection(piece.color);
    const fy = from.y + dir;
    const forwardKey =
      from.surface === 'attack'
        ? coordKey(createCoord(from.x, fy, from.z, 'attack'))
        : coordKey(createCoord(from.x, fy, from.z, 'main'));
    if (inBounds(from.x, fy, size) && !pos.pieces.get(forwardKey)) {
      addMove(moves, fromKey, forwardKey, pos);
      const startRank = piece.color === 'w' ? 1 : 6;
      if (from.surface === 'main' && from.y === startRank) {
        const doubleKey = coordKey(createCoord(from.x, from.y + dir * 2, from.z, 'main'));
        if (!pos.pieces.get(doubleKey)) addMove(moves, fromKey, doubleKey, pos);
      }
    }
    for (const dx of [-1, 1]) {
      const cx = from.x + dx;
      const cy = from.y + dir;
      if (!inBounds(cx, cy, size)) continue;
      const capKey =
        from.surface === 'attack'
          ? coordKey(createCoord(cx, cy, from.z, 'attack'))
          : coordKey(createCoord(cx, cy, from.z, 'main'));
      addMove(moves, fromKey, capKey, pos);
    }
    return moves;
  }

  if (piece.type === 'n') {
    for (const [dx, dy] of knightOffsets()) {
      const nx = from.x + dx;
      const ny = from.y + dy;
      if (!inBounds(nx, ny, size)) continue;
      const toKey =
        from.surface === 'attack'
          ? coordKey(createCoord(nx, ny, from.z, 'attack'))
          : coordKey(createCoord(nx, ny, from.z, 'main'));
      addMove(moves, fromKey, toKey, pos);
    }
  } else if (piece.type === 'b') {
    for (const [dx, dy] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      moves.push(...rayMoves(pos, fromKey, dx, dy, 0, size));
    }
  } else if (piece.type === 'r') {
    for (const [dx, dy, dz] of [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ]) {
      if (from.surface === 'attack' && dz !== 0) continue;
      moves.push(...rayMoves(pos, fromKey, dx, dy, dz, size));
    }
  } else if (piece.type === 'q') {
    for (const [dx, dy, dz] of [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
      [1, 1, 0],
      [1, -1, 0],
      [-1, 1, 0],
      [-1, -1, 0],
    ]) {
      if (from.surface === 'attack' && dz !== 0) continue;
      moves.push(...rayMoves(pos, fromKey, dx, dy, dz, size));
    }
  } else if (piece.type === 'k') {
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          if (dx === 0 && dy === 0 && dz === 0) continue;
          if (from.surface === 'attack' && dz !== 0) continue;
          if (from.surface === 'main') {
            const nx = from.x + dx;
            const ny = from.y + dy;
            const nz = dz === 0 ? from.z : from.z + dz;
            if (dz !== 0 && (dx !== 0 || dy !== 0)) continue;
            if (nz < 0 || nz > 2) continue;
            if (!inBounds(nx, ny, MAIN_BOARD_SIZE)) continue;
            addMove(moves, fromKey, coordKey(createCoord(nx, ny, nz, 'main')), pos);
          } else if (inBounds(from.x + dx, from.y + dy, ATTACK_BOARD_SIZE)) {
            addMove(
              moves,
              fromKey,
              coordKey(createCoord(from.x + dx, from.y + dy, from.z, 'attack')),
              pos,
            );
          }
        }
      }
    }
  }

  const gatewayTarget = gatewayMap.get(fromKey);
  if (gatewayTarget) {
    addMove(moves, fromKey, gatewayTarget, pos);
  }

  return moves;
}

function findKingKey(pos, color) {
  for (const [key, piece] of pos.pieces.entries()) {
    if (piece.type === 'k' && piece.color === color) return key;
  }
  return null;
}

export function isSquareAttacked(pos, targetKey, byColor) {
  for (const [key, piece] of pos.pieces.entries()) {
    if (piece.color !== byColor) continue;
    if (generatePseudoMovesForPiece(pos, key).some((m) => m.to === targetKey)) {
      return true;
    }
  }
  return false;
}

export function isInCheck(pos, color) {
  const kingKey = findKingKey(pos, color);
  if (!kingKey) return false;
  const enemy = color === 'w' ? 'b' : 'w';
  return isSquareAttacked(pos, kingKey, enemy);
}

function maybePromote(piece, toKey) {
  if (piece.type !== 'p') return piece;
  const coord = parseCoordKey(toKey);
  if (!coord || coord.surface !== 'main') return piece;
  const lastRank = piece.color === 'w' ? MAIN_BOARD_SIZE - 1 : 0;
  if (coord.y === lastRank) return { ...piece, type: 'q' };
  return piece;
}

function applyPieceMove(pos, move) {
  const next = clonePosition(pos);
  const piece = next.pieces.get(move.from);
  if (!piece) return next;
  const captured = next.pieces.get(move.to);
  if (captured) {
    if (captured.color === 'b') next.capturedByWhite.push(captured.type);
    else next.capturedByBlack.push(captured.type);
    next.pieces.delete(move.to);
  }
  next.pieces.delete(move.from);
  next.pieces.set(move.to, maybePromote(piece, move.to));
  next.turn = next.turn === 'w' ? 'b' : 'w';
  next.lastMove = move;
  return next;
}

function generateAttackRelocation(pos, boardIndex) {
  let hasFriendly = false;
  for (const [key, piece] of pos.pieces.entries()) {
    const c = parseCoordKey(key);
    if (!c || c.surface !== 'attack' || c.z !== boardIndex) continue;
    if (piece.color !== pos.turn) return null;
    hasFriendly = true;
  }
  if (!hasFriendly) return null;
  const slot = pos.attackSlots[boardIndex] ?? 0;
  return {
    kind: 'relocate_attack',
    boardIndex,
    fromSlot: slot,
    toSlot: slot === 0 ? 1 : 0,
  };
}

export function generateLegalMoves(pos, fromKey = null) {
  if (pos.status !== 'active') return [];

  /** @type {object[]} */
  const legal = [];
  const keys = fromKey
    ? [fromKey]
    : [...pos.pieces.keys()].filter((k) => pos.pieces.get(k)?.color === pos.turn);

  for (const key of keys) {
    const moving = pos.pieces.get(key);
    if (!moving || moving.color !== pos.turn) continue;
    for (const pseudo of generatePseudoMovesForPiece(pos, key)) {
      const trial = applyPieceMove(pos, pseudo);
      trial.turn = pos.turn;
      if (!isInCheck(trial, pos.turn)) legal.push(pseudo);
    }
  }

  if (!fromKey) {
    for (let i = 0; i < pos.attackSlots.length; i += 1) {
      const relocation = generateAttackRelocation(pos, i);
      if (relocation) legal.push(relocation);
    }
  }

  return legal;
}

export function classifyEndStatus(pos, legalMoves) {
  const pieceLegal = legalMoves.filter((m) => !m.kind);
  const check = isInCheck(pos, pos.turn);
  if (pieceLegal.length === 0 && check) {
    return { status: 'checkmate', winner: pos.turn === 'w' ? 'b' : 'w' };
  }
  if (legalMoves.length === 0) {
    return { status: 'stalemate', winner: null };
  }
  return { status: 'active', winner: null };
}

export function updateStatus(pos) {
  if (pos.status === 'resigned') return;
  const legal = generateLegalMoves(pos);
  const outcome = classifyEndStatus(pos, legal);
  pos.status = outcome.status;
  pos.winner = outcome.winner;
}

export function applyMove(pos, move) {
  const snapshot = clonePosition(pos);
  snapshot.history = [];

  if (move.kind === 'relocate_attack') {
    const legal = generateLegalMoves(pos).filter((m) => m.kind === 'relocate_attack');
    if (!legal.some((m) => m.boardIndex === move.boardIndex && m.toSlot === move.toSlot)) {
      return null;
    }
    const next = clonePosition(pos);
    next.history = [...pos.history, snapshot];
    next.attackSlots[move.boardIndex] = move.toSlot;
    next.turn = next.turn === 'w' ? 'b' : 'w';
    next.lastMove = move;
    updateStatus(next);
    return next;
  }

  const legal = generateLegalMoves(pos, move.from);
  if (!legal.some((m) => m.from === move.from && m.to === move.to)) {
    return null;
  }

  const next = applyPieceMove(pos, move);
  next.history = [...pos.history, snapshot];
  updateStatus(next);
  return next;
}

export function undoMove(pos) {
  if (pos.history.length === 0) return null;
  return pos.history[pos.history.length - 1];
}

export function resign(pos, color) {
  const snapshot = clonePosition(pos);
  snapshot.history = [];
  const next = clonePosition(pos);
  next.history = [...pos.history, snapshot];
  next.status = 'resigned';
  next.winner = color === 'w' ? 'b' : 'w';
  return next;
}

export function materialAdvantage(pos) {
  const white = pos.capturedByWhite.reduce((s, t) => s + (MATERIAL[t] ?? 0), 0);
  const black = pos.capturedByBlack.reduce((s, t) => s + (MATERIAL[t] ?? 0), 0);
  return white - black;
}

export function createInitialTriPosition() {
  /** @type {Map<string, Piece>} */
  const pieces = new Map();
  const BACK_RANK = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  for (let x = 0; x < 8; x += 1) {
    pieces.set(coordKey(createCoord(x, 0, 0, 'main')), { color: 'w', type: BACK_RANK[x] });
    pieces.set(coordKey(createCoord(x, 1, 0, 'main')), { color: 'w', type: 'p' });
    pieces.set(coordKey(createCoord(x, 6, 2, 'main')), { color: 'b', type: 'p' });
    pieces.set(coordKey(createCoord(x, 7, 2, 'main')), { color: 'b', type: BACK_RANK[x] });
  }

  return {
    pieces,
    turn: 'w',
    attackSlots: [0, 0, 0, 0],
    status: 'active',
    winner: null,
    lastMove: null,
    history: [],
    capturedByWhite: [],
    capturedByBlack: [],
  };
}
