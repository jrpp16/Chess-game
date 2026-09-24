import {
  searchBestMoveTimed,
  pickRandomMoveFromFen,
  pickFirstLegalMoveFromFen,
  TIME_LIMIT_MS,
  HARD_TIMEOUT_MARGIN_MS,
} from './search.js';

/** @typedef {'beginner'|'medium'|'hard'} Difficulty */

let worker = null;
/** @type {Promise<void> | null} */
let workerReady = null;
/** @type {number} */
let requestId = 0;
/** @type {number} */
let searchGeneration = 0;
/** @type {Map<number, { resolve: Function, reject: Function, timer: ReturnType<typeof setTimeout> }>} */
const pending = new Map();

function hardLimitMs(difficulty) {
  const base = TIME_LIMIT_MS[difficulty] ?? TIME_LIMIT_MS.medium;
  const margin = HARD_TIMEOUT_MARGIN_MS[difficulty] ?? HARD_TIMEOUT_MARGIN_MS.medium;
  return base + margin + 50;
}

function terminateWorker() {
  if (!worker) return;
  worker.terminate();
  worker = null;
  workerReady = null;
}

function rejectAllPending(reason) {
  for (const [id, handler] of pending.entries()) {
    clearTimeout(handler.timer);
    handler.reject(reason);
    pending.delete(id);
  }
}

function ensureWorker() {
  if (worker) return workerReady;
  workerReady = new Promise((resolve, reject) => {
    try {
      worker = new Worker(new URL('./searchWorker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (event) => {
        const { id, result, error } = event.data;
        const handler = pending.get(id);
        if (!handler) return;
        clearTimeout(handler.timer);
        pending.delete(id);
        if (error) {
          handler.reject(new Error(error));
        } else {
          handler.resolve(result);
        }
      };
      worker.onerror = (err) => {
        reject(err);
      };
      resolve(undefined);
    } catch (err) {
      reject(err);
    }
  });
  return workerReady;
}

/**
 * Invalidate in-flight worker searches (new game, undo, mode change, new search).
 */
export function invalidateComputerSearch() {
  searchGeneration += 1;
  worker?.postMessage({ type: 'cancel' });
  rejectAllPending(new Error('search invalidated'));
}

/**
 * @param {object} payload
 * @param {Difficulty} difficulty
 */
async function searchInWorker(payload, difficulty) {
  await ensureWorker();
  const id = ++requestId;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      worker?.postMessage({ type: 'cancel' });
      terminateWorker();
      reject(new Error('worker watchdog timeout'));
    }, hardLimitMs(difficulty));

    pending.set(id, { resolve, reject, timer });
    worker.postMessage({ id, ...payload });
  });
}

function fallbackMove(fen) {
  return pickFirstLegalMoveFromFen(fen) ?? pickRandomMoveFromFen(fen);
}

/**
 * @param {string} fen
 * @param {Difficulty} difficulty
 * @param {'w'|'b'} engineColor
 * @param {Record<string, number>} moveBiasMap
 */
export async function chooseComputerMoveAsync(fen, difficulty, engineColor, moveBiasMap = {}) {
  invalidateComputerSearch();
  const generationAtStart = searchGeneration;

  if (difficulty === 'beginner' && Math.random() < 0.4) {
    return { move: pickRandomMoveFromFen(fen), stats: null, random: true };
  }

  try {
    const result = await searchInWorker({ fen, difficulty, engineColor, moveBiasMap }, difficulty);
    if (generationAtStart !== searchGeneration || result.stale) {
      return { move: null, stats: result.stats ?? null, stale: true };
    }
    if (difficulty === 'beginner' && Math.random() < 0.2 && result.move) {
      return { move: pickRandomMoveFromFen(fen), stats: result.stats, random: true };
    }
    return result;
  } catch {
    if (generationAtStart !== searchGeneration) {
      return { move: null, stats: null, stale: true };
    }
    try {
      const result = searchBestMoveTimed(fen, difficulty, engineColor, moveBiasMap);
      return { move: result.move ?? fallbackMove(fen), stats: result.stats, timeout: true };
    } catch {
      return { move: fallbackMove(fen), stats: null, timeout: true };
    }
  }
}

export function logSearchStats(stats, difficulty) {
  if (!import.meta.env.DEV || !stats) return;
  console.info(
    [
      'AI SEARCH',
      `Time: ${stats.timeMs} ms`,
      `Depth: ${stats.depth}`,
      `Nodes: ${stats.nodes}`,
      `Nodes/sec: ${stats.nps}`,
      `AlphaBeta Cutoffs: ${stats.cutoffs ?? 0}`,
      `TT Hits: ${stats.ttHits}`,
      `Quiescence Nodes: ${stats.quiescenceNodes ?? 0}`,
      `Best Move: ${stats.bestMoveLan ?? '?'}`,
      `Timeout: ${stats.timeout ? 'true' : 'false'}`,
    ].join('\n'),
  );
  console.info('[chess-bot]', {
    difficulty,
    timeLimitMs: TIME_LIMIT_MS[difficulty],
    hardLimitMs: hardLimitMs(difficulty),
    ...stats,
  });
}

export function defaultPromotion() {
  return 'q';
}

export { TIME_LIMIT_MS, HARD_TIMEOUT_MARGIN_MS };
