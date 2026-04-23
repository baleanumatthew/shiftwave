import { getEssentiaInstance, getWorkerErrorMessage } from './audio-worker-essentia.js';

const extractTempo = (audioSource, sampleRate) => {
  const essentia = getEssentiaInstance();
  const audioVector = essentia.arrayToVector(audioSource);

  try {
    const tempo = essentia.RhythmExtractor2013(
      audioVector,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      sampleRate,
    );

    return { tempo: tempo.bpm };
  } finally {
    audioVector.delete();
  }
};

self.onmessage = ({ data }) => {
  try {
    const tempo = extractTempo(data.audio, data.sr);

    self.postMessage({
      tempo: tempo.tempo,
    });
  } catch (error) {
    self.postMessage({
      error: getWorkerErrorMessage(error),
    });
  }
};
