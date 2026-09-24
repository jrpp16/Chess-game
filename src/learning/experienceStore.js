const DB_NAME = 'chess-game-experience';
const DB_VERSION = 1;

/**
 * Local persistence for game results and position/move experience.
 * Interface is intentionally backend-ready: swap implementation later.
 */
export class ExperienceRepository {
  /** @type {IDBDatabase | null} */
  #db = null;

  async init() {
    if (this.#db) return this.#db;

    this.#db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('games')) {
          db.createObjectStore('games', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('stats')) {
          db.createObjectStore('stats', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('moveExperience')) {
          db.createObjectStore('moveExperience', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('positionExperience')) {
          db.createObjectStore('positionExperience', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    await this.#ensureStats();
    return this.#db;
  }

  async #ensureStats() {
    const stats = await this.getStats();
    if (stats) return;
    await this.#put('stats', { key: 'player', wins: 0, losses: 0, draws: 0 });
  }

  #put(storeName, value) {
    return new Promise((resolve, reject) => {
      const tx = this.#db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
    });
  }

  #get(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this.#db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async getStats() {
    await this.init();
    return this.#get('stats', 'player');
  }

  /**
   * @param {'win'|'loss'|'draw'} result from human player perspective
   */
  async recordPlayerResult(result) {
    await this.init();
    const stats = (await this.getStats()) ?? { key: 'player', wins: 0, losses: 0, draws: 0 };
    if (result === 'win') stats.wins += 1;
    if (result === 'loss') stats.losses += 1;
    if (result === 'draw') stats.draws += 1;
    await this.#put('stats', stats);
    return stats;
  }

  /**
   * @param {object} gameRecord
   */
  async saveGame(gameRecord) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.#db.transaction('games', 'readwrite');
      const req = tx.objectStore('games').add({
        ...gameRecord,
        savedAt: Date.now(),
      });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async #adjustExperience(storeName, key, deltaGood, deltaBad) {
    const existing = (await this.#get(storeName, key)) ?? {
      key,
      good: 0,
      bad: 0,
      samples: 0,
    };
    existing.good += deltaGood;
    existing.bad += deltaBad;
    existing.samples += 1;
    await this.#put(storeName, existing);
    return existing;
  }

  /**
   * Record whether a position/move correlated with a good or bad outcome for the engine.
   * @param {'good'|'bad'|'neutral'} outcome
   */
  async recordMoveExperience(key, outcome) {
    const deltaGood = outcome === 'good' ? 1 : 0;
    const deltaBad = outcome === 'bad' ? 1 : 0;
    return this.#adjustExperience('moveExperience', key, deltaGood, deltaBad);
  }

  async recordPositionExperience(key, outcome) {
    const deltaGood = outcome === 'good' ? 1 : 0;
    const deltaBad = outcome === 'bad' ? 1 : 0;
    return this.#adjustExperience('positionExperience', key, deltaGood, deltaBad);
  }

  async getMoveBias(key) {
    const row = await this.#get('moveExperience', key);
    if (!row) return 0;
    return (row.good - row.bad) * 4;
  }
}

/** @type {ExperienceRepository | null} */
let defaultRepo = null;

export function getExperienceRepository() {
  if (!defaultRepo) {
    defaultRepo = new ExperienceRepository();
  }
  return defaultRepo;
}

/**
 * @param {import('chess.js').Chess} chess
 * @param {'w'|'b'} playerColor
 * @param {'win'|'loss'|'draw'} result
 * @param {object} meta
 * @param {ExperienceRepository} repo
 */
export async function persistFinishedGame(chess, playerColor, result, meta, repo = getExperienceRepository()) {
  await repo.init();

  const history = chess.history({ verbose: true });
  const engineColor = playerColor === 'w' ? 'b' : 'w';
  const engineOutcome =
    result === 'win' ? 'bad' : result === 'loss' ? 'good' : 'neutral';

  for (const move of history) {
    if (move.color !== engineColor) continue;
    const key = `${move.before}|${move.lan}`;
    await repo.recordMoveExperience(key, engineOutcome);
  }

  await repo.recordPlayerResult(result);
  await repo.saveGame({
    mode: meta.mode,
    difficulty: meta.difficulty,
    playerColor,
    result,
    moveCount: history.length,
    ending: meta.ending,
    pgn: chess.pgn(),
  });
}
