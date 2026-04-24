import { getEssentiaInstance, getWorkerErrorMessage } from './audio-worker-essentia.js';

const extractTempo = (audioSource, sampleRate) => {
  const essentia = getEssentiaInstance();
  const audioVector = essentia.arrayToVector(audioSource);
  const extractRhythm = sampleRate === 44100
    ? () => essentia.RhythmExtractor2013(audioVector)
    : () => essentia.RhythmExtractor(
      audioVector,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      sampleRate
    );

  try {
    const tempo = extractRhythm();

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
