import { applyMove, generateLegalMoves } from '../rules/moveEngine.js';
import { searchBestMoveTimed, logTriSearchStats, TIME_LIMIT_MS, pickRandomLegalMove } from './search.js';
import { positionFingerprint, serializePosition } from './positionCodec.js';
import { moveKey } from './transposition.js';

/** @typedef {'easy'|'medium'|'hard'} TriDifficulty */

let worker = null;
/** @type {Promise<void> | null} */
let workerReady = null;
let requestId = 0;
/** @type {Map<number, { resolve: Function, reject: Function }>} */
const pending = new Map();
/** @type {number} */
let activeSearchToken = 0;

function ensureWorker() {
  if (worker) return workerReady;
  workerReady = new Promise((resolve, reject) => {
    try {
      worker = new Worker(new URL('./worker/triSearchWorker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (event) => {
        const { id, result, error } = event.data;
        const handler = pending.get(id);
        if (!handler) return;
        pending.delete(id);
        if (error) handler.reject(new Error(error));
        else handler.resolve(result);
      };
      worker.onerror = (err) => reject(err);
      resolve(undefined);
    } catch (err) {
      reject(err);
    }
  });
  return workerReady;
}

/**
 * @param {object} payload
 */
export async function searchTriInWorker(payload) {
  await ensureWorker();
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, ...payload });
  });
}

export function cancelTriSearch() {
  activeSearchToken += 1;
  pending.forEach(({ reject }) => reject(new Error('search cancelled')));
  pending.clear();
}

export function beginTriSearchToken() {
  activeSearchToken += 1;
  return activeSearchToken;
}

export function isTriSearchTokenCurrent(token) {
  return token === activeSearchToken;
}

/**
 * @param {import('../gameState/triGameState.js').TriGameState} state
 * @param {TriDifficulty} difficulty
 * @param {'w'|'b'} engineColor
 * @param {number} searchToken
 */
export async function chooseTriComputerMove(state, difficulty, engineColor, searchToken) {
  if (!isTriSearchTokenCurrent(searchToken)) {
    return { move: null, stats: null, stale: true };
  }

  const position = serializePosition(state.position);
  const expectedFingerprint = positionFingerprint(state.position);

  if (state.position.status !== 'active' || state.turn !== engineColor) {
    return { move: null, stats: null, stale: true };
  }

  let result;
  try {
    result = await searchTriInWorker({ position, difficulty, engineColor });
  } catch {
    if (!isTriSearchTokenCurrent(searchToken)) {
      return { move: null, stats: null, stale: true };
    }
    result = searchBestMoveTimed(state.position, difficulty, engineColor);
  }

  if (!isTriSearchTokenCurrent(searchToken)) {
    return { move: null, stats: result?.stats ?? null, stale: true };
  }

  if (positionFingerprint(state.position) !== expectedFingerprint) {
    return { move: null, stats: result?.stats ?? null, stale: true };
  }

  if (state.position.status !== 'active' || state.turn !== engineColor) {
    return { move: null, stats: result?.stats ?? null, stale: true };
  }

  const move = result?.move ?? pickRandomLegalMove(state.position);
  if (!move) return { move: null, stats: result?.stats ?? null, stale: false };

  const legal = generateLegalMoves(state.position);
  const isLegal = move.kind === 'relocate_attack'
    ? legal.some((m) => m.kind === 'relocate_attack' && m.boardIndex === move.boardIndex && m.toSlot === move.toSlot)
    : legal.some((m) => m.from === move.from && m.to === move.to);

  if (!isLegal) {
    return { move: pickRandomLegalMove(state.position), stats: result?.stats ?? null, stale: false, fallback: true };
  }

  logTriSearchStats(result?.stats, difficulty);
  return { move, stats: result?.stats ?? null, stale: false, moveKey: moveKey(move) };
}

/**
 * Validates and applies a move to game state (used after chooseTriComputerMove).
 * @param {import('../gameState/triGameState.js').TriGameState} state
 * @param {object} move
 */
export function applyValidatedTriMove(state, move) {
  if (state.position.status !== 'active') return false;
  const applied = applyMove(state.position, move);
  if (!applied) return false;
  state.position = applied;
  state.selectedKey = null;
  if (move.kind === 'relocate_attack') {
    state.moveHistorySan.push(`A${move.boardIndex}:${move.toSlot === 1 ? 'HIGH' : 'LOW'}`);
  } else {
    state.moveHistorySan.push(`${move.from}→${move.to}`);
  }
  return true;
}

export { TIME_LIMIT_MS, logTriSearchStats };
