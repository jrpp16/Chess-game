import { Chess } from 'chess.js';

const PIECE_VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

const CENTER_SQUARES = new Set([
  'd4', 'e4', 'd5', 'e5', 'c3', 'd3', 'e3', 'f3', 'c4', 'f4', 'c5', 'f5', 'c6', 'd6', 'e6', 'f6',
]);

const KING_ZONE = {
  w: new Set(['g1', 'h1', 'f1', 'g2', 'h2', 'f2']),
  b: new Set(['g8', 'h8', 'f8', 'g7', 'h7', 'f7']),
};

function squareFile(sq) {
  return sq.charCodeAt(0) - 97;
}

function materialBalance(chess) {
  let score = 0;
  for (let rank = 1; rank <= 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const sq = `${String.fromCharCode(97 + file)}${rank}`;
      const piece = chess.get(sq);
      if (!piece) continue;
      const value = PIECE_VALUE[piece.type];
      score += piece.color === 'w' ? value : -value;
    }
  }
  return score;
}

function centerControl(chess, color) {
  let score = 0;
  for (const sq of CENTER_SQUARES) {
    const piece = chess.get(sq);
    if (piece && piece.color === color) {
      score += piece.type === 'p' ? 8 : 12;
    }
  }
  return score;
}

function isOpenFile(chess, fileIndex, color) {
  for (let rank = 1; rank <= 8; rank += 1) {
    const sq = `${String.fromCharCode(97 + fileIndex)}${rank}`;
    const piece = chess.get(sq);
    if (piece?.type === 'p' && piece.color === color) {
      return false;
    }
  }
  return true;
}

function pieceActivity(chess, color) {
  let score = 0;
  for (let rank = 1; rank <= 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const sq = `${String.fromCharCode(97 + file)}${rank}`;
      const piece = chess.get(sq);
      if (!piece || piece.color !== color) continue;

      if (piece.type === 'n') {
        const f = squareFile(sq);
        const r = rank;
        if (f >= 2 && f <= 5 && r >= 3 && r <= 6) score += 10;
        if (f === 0 || f === 7 || r === 1 || r === 8) score -= 8;
      }
      if (piece.type === 'b' && CENTER_SQUARES.has(sq)) score += 6;
      if (piece.type === 'r' && isOpenFile(chess, file, color)) score += 14;
      if (piece.type === 'q' && CENTER_SQUARES.has(sq)) score += 4;
    }
  }
  return score;
}

function findKingSquare(chess, color) {
  for (let rank = 1; rank <= 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const sq = `${String.fromCharCode(97 + file)}${rank}`;
      const piece = chess.get(sq);
      if (piece?.type === 'k' && piece.color === color) {
        return sq;
      }
    }
  }
  return null;
}

function kingSafety(chess, color) {
  const kingSq = findKingSquare(chess, color);
  if (!kingSq) return 0;

  let score = KING_ZONE[color].has(kingSq) ? 25 : 0;
  const kingFile = squareFile(kingSq);
  const pawnRanks = color === 'w' ? [2, 3] : [7, 6];

  for (const dr of [-1, 0, 1]) {
    const f = kingFile + dr;
    if (f < 0 || f > 7) continue;
    for (const rank of pawnRanks) {
      const sq = `${String.fromCharCode(97 + f)}${rank}`;
      const piece = chess.get(sq);
      if (piece?.type === 'p' && piece.color === color) score += 10;
    }
  }

  if (chess.inCheck() && chess.turn() === color) {
    score -= 40;
  }

  return score;
}

function sideMobility(chess, color) {
  if (chess.turn() === color) {
    return chess.moves().length;
  }
  const parts = chess.fen().split(' ');
  parts[1] = color;
  // En passant is only valid for the side that just moved two ranks; flipping side
  // without clearing it produces illegal FEN and can abort the entire search.
  parts[3] = '-';
  try {
    return new Chess(parts.join(' ')).moves().length;
  } catch {
    return chess.moves().length;
  }
}

/**
 * @param {import('chess.js').Chess} chess
 * @param {'w'|'b'} perspective
 * @param {number} experienceAdjust centipawns from local experience
 */
export function evaluatePosition(chess, perspective, experienceAdjust = 0) {
  if (chess.isCheckmate()) {
    return chess.turn() === perspective ? -100000 : 100000;
  }
  if (chess.isDraw() || chess.isStalemate()) {
    return 0;
  }

  let score =
    materialBalance(chess) +
    (centerControl(chess, 'w') - centerControl(chess, 'b')) +
    (pieceActivity(chess, 'w') - pieceActivity(chess, 'b')) +
    (kingSafety(chess, 'w') - kingSafety(chess, 'b')) +
    (sideMobility(chess, 'w') - sideMobility(chess, 'b')) * 3;

  score += experienceAdjust;

  return perspective === 'w' ? score : -score;
}

export function positionKey(chess) {
  const parts = chess.fen().split(' ');
  return `${parts[0]} ${parts[1]}`;
}

export function moveKey(chess, moveLan) {
  return `${positionKey(chess)}|${moveLan}`;
}
