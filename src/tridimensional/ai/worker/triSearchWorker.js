import { searchBestMoveTimed } from '../search.js';
import { deserializePosition } from '../positionCodec.js';

self.onmessage = (event) => {
  const { id, position, difficulty, engineColor } = event.data;
  try {
    const pos = deserializePosition(position);
    const result = searchBestMoveTimed(pos, difficulty, engineColor);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error?.message ?? 'tri search failed' });
  }
};
