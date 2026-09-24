import { searchBestMoveTimed } from './search.js';

self.onmessage = (event) => {
  const { id, fen, difficulty, engineColor, moveBiasMap } = event.data;

  try {
    const result = searchBestMoveTimed(fen, difficulty, engineColor, moveBiasMap ?? {});
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error?.message ?? 'search failed' });
  }
};
