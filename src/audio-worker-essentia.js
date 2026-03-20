import Essentia from 'essentia.js/dist/essentia.js-core.es.js';
import { EssentiaWASM } from 'essentia.js/dist/essentia-wasm.es.js';

let essentiaInstance = null;

export const getEssentiaInstance = () => {
  if (!essentiaInstance) {
    essentiaInstance = new Essentia(EssentiaWASM, false);
  }

  return essentiaInstance;
};

export const getWorkerErrorMessage = (error) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error) {
    return error;
  }

  return 'Analysis worker failed to initialize.';
};
