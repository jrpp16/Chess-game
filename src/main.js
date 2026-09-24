import { Chess } from 'chess.js';
import './styles.css';
import { chooseComputerMoveAsync, defaultPromotion, logSearchStats } from './engine/computer.js';
import { moveKey } from './engine/evaluation.js';
import {
  getExperienceRepository,
  persistFinishedGame,
} from './learning/experienceStore.js';

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
const thinkingBanner = document.getElementById('thinking-banner');
const computerOptions = document.getElementById('computer-options');
const difficultyEl = document.getElementById('difficulty');
const statsLine = document.getElementById('stats-line');
const promotionModal = document.getElementById('promotion-modal');

const experienceRepo = getExperienceRepository();

let chess = new Chess();
let selectedSquare = null;
let legalTargets = new Map();
let gameMode = 'human';
let playerColor = 'w';
let computerColor = 'b';
let difficulty = 'medium';
let isComputerThinking = false;
let gameResultRecorded = false;
/** @type {{ from: string, to: string } | null} */
let pendingPromotion = null;

function squareId(file, rank) {
  return `${file}${rank}`;
}

function getViewOrder() {
  const flip = gameMode === 'computer' && playerColor === 'b';
  return {
    ranks: flip ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1],
    files: flip ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] : FILES,
  };
}

function canHumanInteract() {
  if (chess.isGameOver() || isComputerThinking) return false;
  if (gameMode === 'human') return true;
  return chess.turn() === playerColor;
}

function renderBoard() {
  boardEl.innerHTML = '';
  legalTargets = new Map();

  if (selectedSquare && canHumanInteract()) {
    for (const move of chess.moves({ square: selectedSquare, verbose: true })) {
      legalTargets.set(move.to, move);
    }
  }

  const { ranks, files } = getViewOrder();

  for (const rank of ranks) {
    for (const file of files) {
      const sq = squareId(file, rank);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'square';
      cell.dataset.square = sq;
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', sq);
      cell.disabled = !canHumanInteract();

      const isLight = (file.charCodeAt(0) - 97 + rank) % 2 === 0;
      cell.classList.add(isLight ? 'light' : 'dark');

      if (sq === selectedSquare) {
        cell.classList.add('selected');
      }

      const move = legalTargets.get(sq);
      if (move) {
        cell.classList.add('target');
        if (String(move.flags).includes('c')) {
          cell.classList.add('capture');
        }
      }

      if (chess.inCheck()) {
        const kingSquare = findKingSquare(chess.turn());
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
      if (p?.type === 'k' && p.color === color) {
        return sq;
      }
    }
  }
  return null;
}

function executeMove(from, to, promotion) {
  const move = { from, to };
  if (promotion) move.promotion = promotion;
  chess.move(move);
  selectedSquare = null;
  updateUI();
  afterMove();
}

function showPromotionDialog(from, to) {
  pendingPromotion = { from, to };
  promotionModal.classList.remove('hidden');
}

function hidePromotionDialog() {
  pendingPromotion = null;
  promotionModal.classList.add('hidden');
}

function onSquareClick(sq) {
  if (!canHumanInteract()) {
    return;
  }

  const piece = chess.get(sq);

  if (selectedSquare && legalTargets.has(sq)) {
    const move = legalTargets.get(sq);
    if (String(move.flags).includes('p')) {
      showPromotionDialog(selectedSquare, sq);
      return;
    }
    executeMove(selectedSquare, sq);
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

function afterMove() {
  if (chess.isGameOver()) {
    recordGameIfNeeded();
    return;
  }
  if (gameMode === 'computer' && chess.turn() === computerColor) {
    scheduleComputerMove();
  }
}

async function buildMoveBiasMap(chessBoard) {
  const moves = chessBoard.moves({ verbose: true });
  /** @type {Record<string, number>} */
  const map = {};
  await experienceRepo.init();
  for (const move of moves) {
    const key = `${move.from}${move.to}${move.promotion ?? ''}`;
    map[key] = await experienceRepo.getMoveBias(moveKey(chessBoard, move.lan));
  }
  return map;
}

function scheduleComputerMove() {
  runComputerMove();
}

async function runComputerMove() {
  if (gameMode !== 'computer' || chess.isGameOver()) return;
  if (chess.turn() !== computerColor) return;

  isComputerThinking = true;
  thinkingBanner.classList.remove('hidden');
  updateUI();

  const moveBiasMap = await buildMoveBiasMap(chess);
  const { move, stats } = await chooseComputerMoveAsync(
    chess.fen(),
    difficulty,
    computerColor,
    moveBiasMap,
  );

  logSearchStats(stats, difficulty);

  isComputerThinking = false;
  thinkingBanner.classList.add('hidden');

  if (!move) {
    updateUI();
    return;
  }

  chess.move({ from: move.from, to: move.to, promotion: move.promotion ?? defaultPromotion() });
  selectedSquare = null;
  updateUI();

  if (chess.isGameOver()) {
    recordGameIfNeeded();
  }
}

function resolvePlayerResult() {
  if (chess.isCheckmate()) {
    const winner = chess.turn() === 'w' ? 'b' : 'w';
    if (winner === playerColor) return 'win';
    return 'loss';
  }
  return 'draw';
}

function endingLabel() {
  if (chess.isCheckmate()) return 'checkmate';
  if (chess.isStalemate()) return 'stalemate';
  if (chess.isDraw()) return 'draw';
  return 'unknown';
}

async function recordGameIfNeeded() {
  if (gameMode !== 'computer' || gameResultRecorded) return;
  gameResultRecorded = true;
  const result = resolvePlayerResult();
  await persistFinishedGame(chess, playerColor, result, {
    mode: gameMode,
    difficulty,
    ending: endingLabel(),
  }, experienceRepo);
  await refreshStats();
}

async function refreshStats() {
  const stats = await experienceRepo.getStats();
  if (!stats) return;
  statsLine.textContent = `Siege ${stats.wins} · Niederlagen ${stats.losses} · Remis ${stats.draws}`;
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
  turnIndicator.textContent = isComputerThinking ? 'Computer …' : turn;
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
  btnUndo.disabled = chess.history().length === 0 || isComputerThinking;
}

function updateUI() {
  renderBoard();
  formatMoveHistory();
  updateStatus();
}

function resolvePlayerColorChoice() {
  const selected = document.querySelector('input[name="player-color"]:checked');
  if (!selected || selected.value === 'random') {
    return Math.random() < 0.5 ? 'w' : 'b';
  }
  return selected.value;
}

function applyModeFromUI() {
  const modeInput = document.querySelector('input[name="mode"]:checked');
  gameMode = modeInput?.value === 'computer' ? 'computer' : 'human';
  difficulty = difficultyEl.value;
  computerOptions.classList.toggle('hidden', gameMode !== 'computer');
  difficultyEl.disabled = gameMode !== 'computer';

  if (gameMode === 'computer') {
    playerColor = resolvePlayerColorChoice();
    computerColor = playerColor === 'w' ? 'b' : 'w';
  }
}

function startNewGame() {
  applyModeFromUI();
  chess = new Chess();
  selectedSquare = null;
  gameResultRecorded = false;
  isComputerThinking = false;
  thinkingBanner.classList.add('hidden');
  hidePromotionDialog();
  updateUI();

  if (gameMode === 'computer' && chess.turn() === computerColor) {
    scheduleComputerMove();
  }
}

btnUndo.addEventListener('click', () => {
  if (isComputerThinking) return;
  if (gameMode === 'computer' && chess.history().length >= 2) {
    chess.undo();
    chess.undo();
  } else if (chess.history().length >= 1) {
    chess.undo();
  }
  selectedSquare = null;
  gameResultRecorded = false;
  updateUI();
});

btnNew.addEventListener('click', startNewGame);

document.querySelectorAll('input[name="mode"]').forEach((el) => {
  el.addEventListener('change', () => {
    applyModeFromUI();
    updateUI();
  });
});

difficultyEl.addEventListener('change', () => {
  difficulty = difficultyEl.value;
});

document.querySelectorAll('input[name="player-color"]').forEach((el) => {
  el.addEventListener('change', () => {
    if (gameMode === 'computer') {
      playerColor = resolvePlayerColorChoice();
      computerColor = playerColor === 'w' ? 'b' : 'w';
      updateUI();
    }
  });
});

promotionModal.querySelectorAll('[data-piece]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!pendingPromotion) return;
    executeMove(pendingPromotion.from, pendingPromotion.to, btn.dataset.piece);
    hidePromotionDialog();
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    selectedSquare = null;
    hidePromotionDialog();
    updateUI();
  }
});

applyModeFromUI();
refreshStats();
updateUI();
