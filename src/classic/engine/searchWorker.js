import { searchBestMoveTimed } from './search.js';

let abortCurrentSearch = false;

self.onmessage = (event) => {
  const data = event.data ?? {};
  if (data.type === 'cancel') {
    abortCurrentSearch = true;
    return;
  }

  const { id, fen, difficulty, engineColor, moveBiasMap } = data;
  abortCurrentSearch = false;

  try {
    const result = searchBestMoveTimed(fen, difficulty, engineColor, moveBiasMap ?? {}, {
      isAborted: () => abortCurrentSearch,
    });
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error?.message ?? 'search failed' });
  }
};
