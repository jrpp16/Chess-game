import { Chess } from 'chess.js';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
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

const boardEl = document.getElementById('board');
const turnIndicator = document.getElementById('turn-indicator');
const gameStatusEl = document.getElementById('game-status');
const moveListEl = document.getElementById('move-list');
const btnUndo = document.getElementById('btn-undo');
const btnNew = document.getElementById('btn-new');

let chess = new Chess();
let selectedSquare = null;
let legalTargets = new Map();

function squareId(file, rank) {
  return `${file}${rank}`;
}

function parseSquare(el) {
  return el.dataset.square;
}

function renderBoard() {
  boardEl.innerHTML = '';
  legalTargets = new Map();

  if (selectedSquare) {
    for (const move of chess.moves({ square: selectedSquare, verbose: true })) {
      legalTargets.set(move.to, move);
    }
  }

  for (let rank = 8; rank >= 1; rank -= 1) {
    for (const file of FILES) {
      const sq = squareId(file, rank);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'square';
      cell.dataset.square = sq;
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', sq);

      const isLight = (file.charCodeAt(0) - 97 + rank) % 2 === 0;
      cell.classList.add(isLight ? 'light' : 'dark');

      if (sq === selectedSquare) {
        cell.classList.add('selected');
      }

      const move = legalTargets.get(sq);
      if (move) {
        cell.classList.add('target');
        if (move.flags.includes('c')) {
          cell.classList.add('capture');
        }
        if (move.flags.includes('e')) {
          cell.classList.add('en-passant');
        }
      }

      if (chess.inCheck()) {
        const kingSquare =
          chess.turn() === 'w'
            ? findKingSquare('w')
            : findKingSquare('b');
        if (sq === kingSquare) {
          cell.classList.add('in-check');
        }
      }

      const piece = chess.get(sq);
      if (piece) {
        const span = document.createElement('span');
        span.className = `piece ${piece.color === 'w' ? 'white' : 'black'}`;
        span.textContent = PIECE_UNICODE[`${piece.color}${piece.type}`];
        span.setAttribute('aria-hidden', 'true');
        cell.appendChild(span);
      }

      cell.addEventListener('click', () => onSquareClick(sq));
      boardEl.appendChild(cell);
    }
  }
}

function findKingSquare(color) {
  for (let rank = 1; rank <= 8; rank += 1) {
    for (const file of FILES) {
      const sq = squareId(file, rank);
      const p = chess.get(sq);
      if (p && p.type === 'k' && p.color === color) {
        return sq;
      }
    }
  }
  return null;
}

function onSquareClick(sq) {
  if (chess.isGameOver()) {
    return;
  }

  const piece = chess.get(sq);

  if (selectedSquare && legalTargets.has(sq)) {
    const move = legalTargets.get(sq);
    if (move.flags.includes('p')) {
      const promotion = prompt(
        'Umwandlung (q= Dame, r= Turm, b= Läufer, n= Springer)',
        'q',
      );
      const map = { q: 'q', r: 'r', b: 'b', n: 'n', d: 'q', t: 'r', l: 'b', s: 'n' };
      const key = (promotion || 'q').toLowerCase().charAt(0);
      chess.move({ from: selectedSquare, to: sq, promotion: map[key] || 'q' });
    } else {
      chess.move({ from: selectedSquare, to: sq });
    }
    selectedSquare = null;
    updateUI();
    return;
  }

  if (piece && piece.color === chess.turn()) {
    selectedSquare = selectedSquare === sq ? null : sq;
    updateUI();
    return;
  }

  selectedSquare = null;
  updateUI();
}

function formatMoveHistory() {
  moveListEl.innerHTML = '';
  const history = chess.history();
  for (let i = 0; i < history.length; i += 2) {
    const li = document.createElement('li');
    const num = Math.floor(i / 2) + 1;
    const white = history[i] ?? '';
    const black = history[i + 1] ?? '';
    li.textContent = black ? `${num}. ${white} ${black}` : `${num}. ${white}`;
    moveListEl.appendChild(li);
  }
  if (moveListEl.lastElementChild) {
    moveListEl.lastElementChild.scrollIntoView({ block: 'nearest' });
  }
}

function updateStatus() {
  const turn = chess.turn() === 'w' ? 'Weiß' : 'Schwarz';
  turnIndicator.textContent = turn;
  turnIndicator.className = `turn-indicator ${chess.turn() === 'w' ? 'white-turn' : 'black-turn'}`;

  let status = '';
  if (chess.isCheckmate()) {
    status = `Schachmatt — ${chess.turn() === 'w' ? 'Schwarz' : 'Weiß'} gewinnt`;
  } else if (chess.isStalemate()) {
    status = 'Patt — Remis';
  } else if (chess.isDraw()) {
    status = 'Remis';
  } else if (chess.inCheck()) {
    status = 'Schach!';
  }
  gameStatusEl.textContent = status;
  btnUndo.disabled = chess.history().length === 0;
}

function updateUI() {
  renderBoard();
  formatMoveHistory();
  updateStatus();
}

btnUndo.addEventListener('click', () => {
  chess.undo();
  selectedSquare = null;
  updateUI();
});

btnNew.addEventListener('click', () => {
  chess = new Chess();
  selectedSquare = null;
  updateUI();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    selectedSquare = null;
    updateUI();
  }
});

updateUI();
