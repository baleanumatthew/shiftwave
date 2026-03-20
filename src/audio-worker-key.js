import { getEssentiaInstance, getWorkerErrorMessage } from './audio-worker-essentia.js';

const extractKey = (audioSource, sampleRate) => {
  const essentia = getEssentiaInstance();
  const audioVector = essentia.arrayToVector(audioSource);

  try {
    const key = essentia.KeyExtractor(
      audioVector,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      sampleRate,
    );

    return {
      key: key.key,
      scale: key.scale,
    };
  } finally {
    audioVector.delete();
  }
};

self.onmessage = ({ data }) => {
  try {
    const key = extractKey(data.audio, data.sr);

    self.postMessage({
      key: key.key,
      scale: key.scale,
    });
  } catch (error) {
    self.postMessage({
      error: getWorkerErrorMessage(error),
    });
  }
};
