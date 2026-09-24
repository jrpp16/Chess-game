import { CAPTURE_SORT, MATERIAL, RULESET_NAME } from '../rules/cgTdcV1Rules.js';

const PIECE_UNICODE = {
  wp: '♙',
  wn: '♘',
  wb: '♗',
  wr: '♖',
  wq: '♕',
  wk: '♔',
  bp: '♟',
  bn: '♞',
  bb: '♝',
  br: '♜',
  bq: '♛',
  bk: '♚',
};

function sortCaptured(list) {
  return [...list].sort((a, b) => CAPTURE_SORT.indexOf(a) - CAPTURE_SORT.indexOf(b));
}

export function renderTriCapturedDisplay(state, elements) {
  const byBlack = sortCaptured(state.capturedByBlack);
  const byWhite = sortCaptured(state.capturedByWhite);

  elements.topPiecesEl.innerHTML = byBlack
    .map((t) => `<span class="captured-piece white" aria-hidden="true">${PIECE_UNICODE[`w${t}`]}</span>`)
    .join('');
  elements.bottomPiecesEl.innerHTML = byWhite
    .map((t) => `<span class="captured-piece black" aria-hidden="true">${PIECE_UNICODE[`b${t}`]}</span>`)
    .join('');

  const diff = state.materialDiff();
  elements.topAdvantageEl.classList.add('hidden');
  elements.bottomAdvantageEl.classList.add('hidden');
  elements.topAdvantageEl.textContent = '';
  elements.bottomAdvantageEl.textContent = '';

  if (diff < 0) {
    elements.topAdvantageEl.textContent = `+${-diff}`;
    elements.topAdvantageEl.classList.remove('hidden');
  } else if (diff > 0) {
    elements.bottomAdvantageEl.textContent = `+${diff}`;
    elements.bottomAdvantageEl.classList.remove('hidden');
  }
}

export function renderTriMoveList(state, listEl) {
  listEl.innerHTML = '';
  state.moveHistorySan.forEach((entry) => {
    const li = document.createElement('li');
    li.textContent = entry;
    listEl.appendChild(li);
  });
}

export { RULESET_NAME, MATERIAL };
