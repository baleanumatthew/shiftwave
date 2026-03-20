import { useCallback, useEffect, useRef, useState } from 'react';
import { emptyFeatures } from '../constants.js';

const downMix = (audioBuffer) => {
  const left = audioBuffer.getChannelData(0);
  const right = audioBuffer.numberOfChannels > 1
    ? audioBuffer.getChannelData(1)
    : left;
  const length = Math.min(left.length, right.length);
  const mono = new Float32Array(length);

  for (let index = 0; index < length; index += 1) {
    mono[index] = 0.5 * (left[index] + right[index]);
  }

  return mono;
};

export const useFeatureAnalysis = (isCurrentLoad) => {
  const [features, setFeatures] = useState(emptyFeatures);
  const activeWorkersRef = useRef([]);

  const mergeFeatures = useCallback((partialFeatures) => {
    setFeatures((currentFeatures) => ({
      ...currentFeatures,
      ...partialFeatures,
    }));
  }, []);

  const releaseWorker = useCallback((worker) => {
    activeWorkersRef.current = activeWorkersRef.current.filter((candidate) => candidate !== worker);

    try {
      worker.terminate();
    } catch {
      // The worker may already be shut down.
    }
  }, []);

  const stopActiveWorkers = useCallback(() => {
    activeWorkersRef.current.forEach((worker) => {
      try {
        worker.terminate();
      } catch {
        // The worker may already be shutting down.
      }
    });

    activeWorkersRef.current = [];
  }, []);

  useEffect(() => () => {
    stopActiveWorkers();
  }, [stopActiveWorkers]);

  const resetFeatures = useCallback(() => {
    setFeatures(emptyFeatures);
  }, []);

  const runFeatureAnalysis = useCallback((audioBuffer, loadId) => {
    const monoAudio = downMix(audioBuffer);
    const bpmWorker = new Worker(new URL('../../audio-worker-bpm.js', import.meta.url), {
      type: 'module',
    });
    const keyWorker = new Worker(new URL('../../audio-worker-key.js', import.meta.url), {
      type: 'module',
    });

    activeWorkersRef.current = [bpmWorker, keyWorker];

    bpmWorker.onmessage = (message) => {
      if (!isCurrentLoad(loadId)) {
        releaseWorker(bpmWorker);
        return;
      }

      if (message.data.error) {
        console.error('Tempo extraction failed:', message.data.error);
        mergeFeatures({ tempo: null });
        releaseWorker(bpmWorker);
        return;
      }

      mergeFeatures({ tempo: message.data.tempo });
      releaseWorker(bpmWorker);
    };

    bpmWorker.onerror = (workerError) => {
      if (!isCurrentLoad(loadId)) {
        releaseWorker(bpmWorker);
        return;
      }

      console.error('Tempo extraction worker crashed.', workerError);
      mergeFeatures({ tempo: null });
      releaseWorker(bpmWorker);
    };

    keyWorker.onmessage = (message) => {
      if (!isCurrentLoad(loadId)) {
        releaseWorker(keyWorker);
        return;
      }

      if (message.data.error) {
        console.error('Key extraction failed:', message.data.error);
        mergeFeatures({
          key: null,
          scale: null,
        });
        releaseWorker(keyWorker);
        return;
      }

      mergeFeatures({
        key: message.data.key,
        scale: message.data.scale,
      });
      releaseWorker(keyWorker);
    };

    keyWorker.onerror = (workerError) => {
      if (!isCurrentLoad(loadId)) {
        releaseWorker(keyWorker);
        return;
      }

      console.error('Key extraction worker crashed.', workerError);
      mergeFeatures({
        key: null,
        scale: null,
      });
      releaseWorker(keyWorker);
    };

    bpmWorker.postMessage({
      audio: monoAudio,
      sr: audioBuffer.sampleRate,
    });

    keyWorker.postMessage({
      audio: monoAudio,
      sr: audioBuffer.sampleRate,
    });
  }, [isCurrentLoad, mergeFeatures, releaseWorker]);

  return {
    features,
    resetFeatures,
    runFeatureAnalysis,
    stopActiveWorkers,
  };
};
