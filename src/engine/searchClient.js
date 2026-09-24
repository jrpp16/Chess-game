import { searchBestMoveTimed, pickRandomMoveFromFen, TIME_LIMIT_MS } from './search.js';

/** @typedef {'beginner'|'medium'|'hard'} Difficulty */

let worker = null;
/** @type {Promise<void> | null} */
let workerReady = null;
/** @type {number} */
let requestId = 0;
/** @type {Map<number, { resolve: Function, reject: Function }>} */
const pending = new Map();

function ensureWorker() {
  if (worker) return workerReady;
  workerReady = new Promise((resolve, reject) => {
    try {
      worker = new Worker(new URL('./searchWorker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (event) => {
        const { id, result, error } = event.data;
        const handler = pending.get(id);
        if (!handler) return;
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
 * @param {object} payload
 */
export async function searchInWorker(payload) {
  await ensureWorker();
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, ...payload });
  });
}

/**
 * @param {string} fen
 * @param {Difficulty} difficulty
 * @param {'w'|'b'} engineColor
 * @param {Record<string, number>} moveBiasMap
 */
export async function chooseComputerMoveAsync(fen, difficulty, engineColor, moveBiasMap = {}) {
  if (difficulty === 'beginner' && Math.random() < 0.4) {
    return { move: pickRandomMoveFromFen(fen), stats: null, random: true };
  }

  try {
    const result = await searchInWorker({ fen, difficulty, engineColor, moveBiasMap });
    if (difficulty === 'beginner' && Math.random() < 0.2 && result.move) {
      return { move: pickRandomMoveFromFen(fen), stats: result.stats, random: true };
    }
    return result;
  } catch {
    return searchBestMoveTimed(fen, difficulty, engineColor, moveBiasMap);
  }
}

export function logSearchStats(stats, difficulty) {
  if (!import.meta.env.DEV || !stats) return;
  console.info('[chess-bot]', {
    difficulty,
    timeLimitMs: TIME_LIMIT_MS[difficulty],
    ...stats,
  });
}

export function defaultPromotion() {
  return 'q';
}

export { TIME_LIMIT_MS };
