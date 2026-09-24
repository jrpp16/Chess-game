/** @typedef {{ score: number, depth: number, flag: 'EXACT'|'LOWER'|'UPPER', moveKey: string }} TTEntry */

export class TranspositionTable {
  constructor(sizePower = 18) {
    this.size = 1 << sizePower;
    this.mask = this.size - 1;
    /** @type {(TTEntry | undefined)[]} */
    this.table = new Array(this.size);
    this.hits = 0;
    this.misses = 0;
  }

  /** @param {number} hash */
  get(hash) {
    const entry = this.table[hash & this.mask];
    if (entry && entry.hash === hash) {
      this.hits += 1;
      return entry;
    }
    this.misses += 1;
    return null;
  }

  /** @param {number} hash @param {TTEntry} entry */
  set(hash, entry) {
    this.table[hash & this.mask] = { ...entry, hash };
  }

  getStats() {
    return { hits: this.hits, misses: this.misses, size: this.table.filter(Boolean).length };
  }

  resetStats() {
    this.hits = 0;
    this.misses = 0;
  }
}

/**
 * @param {import('../rules/moveEngine.js').TriPosition} pos
 */
export function hashPosition(pos) {
  let h = 2166136261;
  const mix = (n) => {
    h ^= n;
    h = Math.imul(h, 16777619);
  };

  mix(pos.turn === 'w' ? 1 : 2);
  mix(pos.status === 'active' ? 0 : pos.status === 'checkmate' ? 3 : 4);
  for (let i = 0; i < pos.attackSlots.length; i += 1) {
    mix((i + 1) * 17 + pos.attackSlots[i]);
  }

  const keys = [...pos.pieces.keys()].sort();
  for (const key of keys) {
    const p = pos.pieces.get(key);
    for (let i = 0; i < key.length; i += 1) {
      mix(key.charCodeAt(i));
    }
    mix(p.color === 'w' ? 10 : 20);
    mix(p.type.charCodeAt(0));
  }

  return h >>> 0;
}

/**
 * @param {object} move
 */
export function moveKey(move) {
  if (move.kind === 'relocate_attack') {
    return `R:${move.boardIndex}:${move.toSlot}`;
  }
  return `${move.from}>${move.to}${move.capture ? 'x' : ''}`;
}
