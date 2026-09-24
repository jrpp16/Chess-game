/** @typedef {'p'|'n'|'b'|'r'|'q'} PieceSymbol */

const PIECE_UNICODE = {
  wp: '♙',
  wn: '♘',
  wb: '♗',
  wr: '♖',
  wq: '♕',
  bp: '♟',
  bn: '♞',
  bb: '♝',
  br: '♜',
  bq: '♛',
};

/** Material for advantage display (P=1, N/B=3, R=5, Q=9). */
export const MATERIAL_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 };

const SORT_ORDER = { q: 0, r: 1, b: 2, n: 3, p: 4 };

/**
 * Derive captures from chess.js verbose move history (includes en passant & promotions).
 * @param {import('chess.js').Chess} chess
 */
export function computeCapturesFromHistory(chess) {
  /** @type {PieceSymbol[]} black pieces taken by white */
  const capturedByWhite = [];
  /** @type {PieceSymbol[]} white pieces taken by black */
  const capturedByBlack = [];

  for (const move of chess.history({ verbose: true })) {
    if (!move.captured) {
      continue;
    }
    if (move.color === 'w') {
      capturedByWhite.push(move.captured);
    } else {
      capturedByBlack.push(move.captured);
    }
  }

  sortByPieceValue(capturedByWhite);
  sortByPieceValue(capturedByBlack);

  const whitePoints = sumMaterial(capturedByWhite);
  const blackPoints = sumMaterial(capturedByBlack);
  const advantage = whitePoints - blackPoints;

  return {
    capturedByWhite,
    capturedByBlack,
    advantage,
  };
}

/** @param {PieceSymbol[]} pieces */
function sortByPieceValue(pieces) {
  pieces.sort((a, b) => (SORT_ORDER[a] ?? 9) - (SORT_ORDER[b] ?? 9));
}

/** @param {PieceSymbol[]} pieces */
function sumMaterial(pieces) {
  return pieces.reduce((sum, type) => sum + (MATERIAL_VALUE[type] ?? 0), 0);
}

/**
 * @param {PieceSymbol[]} pieceTypes
 * @param {'w'|'b'} pieceColor on board (white or black piece glyph)
 */
function renderPieceSpans(pieceTypes, pieceColor) {
  return pieceTypes
    .map((type) => {
      const key = `${pieceColor}${type}`;
      const symbol = PIECE_UNICODE[key] ?? '?';
      return `<span class="captured-piece ${pieceColor === 'w' ? 'white' : 'black'}" aria-hidden="true">${symbol}</span>`;
    })
    .join('');
}

/**
 * @param {import('chess.js').Chess} chess
 * @param {{ topPiecesEl: HTMLElement, bottomPiecesEl: HTMLElement, topAdvantageEl: HTMLElement, bottomAdvantageEl: HTMLElement }} elements
 */
export function renderCapturedDisplay(chess, elements) {
  const { capturedByWhite, capturedByBlack, advantage } = computeCapturesFromHistory(chess);

  elements.topPiecesEl.innerHTML = renderPieceSpans(capturedByBlack, 'w');
  elements.bottomPiecesEl.innerHTML = renderPieceSpans(capturedByWhite, 'b');

  elements.topAdvantageEl.textContent = '';
  elements.bottomAdvantageEl.textContent = '';
  elements.topAdvantageEl.classList.add('hidden');
  elements.bottomAdvantageEl.classList.add('hidden');

  if (advantage < 0) {
    elements.topAdvantageEl.textContent = `+${-advantage}`;
    elements.topAdvantageEl.classList.remove('hidden');
  } else if (advantage > 0) {
    elements.bottomAdvantageEl.textContent = `+${advantage}`;
    elements.bottomAdvantageEl.classList.remove('hidden');
  }
}
