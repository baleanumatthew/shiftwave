import { useCallback, useEffect, useRef, useState } from 'react';
import { SoundTouchNode } from '@soundtouchjs/audio-worklet';
import {
  DEFAULT_PITCH,
  DEFAULT_PITCH_SEMITONES,
  DEFAULT_TEMPO,
  END_EPSILON_SECONDS,
} from '../constants.js';
import {
  clamp,
  formatTime,
  registerProcessor,
} from '../utils.js';

export const useSoundTouchPlayer = ({
  audioBuffer,
  audioCtx,
  volume,
}) => {
  const workletNodeRef = useRef(null);
  const gainNodeRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const animationFrameRef = useRef(null);
  const progressInputRef = useRef(null);
  const startContextTimeRef = useRef(0);
  const startOffsetRef = useRef(0);
  const currentOffsetRef = useRef(0);
  const tempoRef = useRef(DEFAULT_TEMPO);
  const pitchSemitonesRef = useRef(DEFAULT_PITCH_SEMITONES);
  const volumeRef = useRef(volume);
  const isPlayingRef = useRef(false);
  const isScrubbingRef = useRef(false);
  const scrubProgressRef = useRef(0);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [timePlayed, setTimePlayed] = useState('0:00');
  const [tempo, setTempo] = useState(DEFAULT_TEMPO);
  const [pitchSemitones, setPitchSemitones] = useState(DEFAULT_PITCH_SEMITONES);

  const durationSeconds = audioBuffer?.duration ?? 0;
  const duration = formatTime(durationSeconds);

  const stopProgressLoop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const syncUiToOffset = useCallback((offsetSeconds) => {
    const clampedOffset = clamp(offsetSeconds, 0, durationSeconds);
    const nextProgress = durationSeconds > 0
      ? (clampedOffset / durationSeconds) * 100
      : 0;

    currentOffsetRef.current = clampedOffset;

    if (!isScrubbingRef.current) {
      scrubProgressRef.current = nextProgress;

      if (progressInputRef.current) {
        progressInputRef.current.value = String(nextProgress);
      }
    }

    setTimePlayed(formatTime(clampedOffset));
  }, [durationSeconds]);

  const getCurrentOffset = useCallback(() => {
    if (!audioBuffer) {
      return 0;
    }

    if (!isPlayingRef.current || !sourceNodeRef.current) {
      return currentOffsetRef.current;
    }

    const elapsedSeconds = (audioCtx.currentTime - startContextTimeRef.current) * tempoRef.current;

    return clamp(startOffsetRef.current + elapsedSeconds, 0, audioBuffer.duration);
  }, [audioBuffer, audioCtx]);

  const destroySourceNode = useCallback(() => {
    const sourceNode = sourceNodeRef.current;

    if (!sourceNode) {
      return;
    }

    sourceNode.onended = null;

    try {
      sourceNode.stop();
    } catch {
      // The source may have already ended.
    }

    try {
      sourceNode.disconnect();
    } catch {
      // The source may already be disconnected.
    }

    sourceNodeRef.current = null;
  }, []);

  const finishPlayback = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    stopProgressLoop();
    destroySourceNode();
    startContextTimeRef.current = 0;
    startOffsetRef.current = 0;
    syncUiToOffset(0);
  }, [destroySourceNode, stopProgressLoop, syncUiToOffset]);

  const startProgressLoop = useCallback(() => {
    stopProgressLoop();

    const tick = () => {
      if (!isPlayingRef.current) {
        animationFrameRef.current = null;
        return;
      }

      const currentOffset = getCurrentOffset();

      if (durationSeconds > 0 && currentOffset >= durationSeconds - END_EPSILON_SECONDS) {
        finishPlayback();
        return;
      }

      syncUiToOffset(currentOffset);
      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);
  }, [durationSeconds, finishPlayback, getCurrentOffset, stopProgressLoop, syncUiToOffset]);

  const ensureAudioContextIsRunning = useCallback(async () => {
    if (audioCtx?.state === 'suspended') {
      await audioCtx.resume();
    }
  }, [audioCtx]);

  const createAndStartSource = useCallback((offsetSeconds) => {
    if (!audioBuffer || !audioCtx || !workletNodeRef.current) {
      return;
    }

    const clampedOffset = clamp(offsetSeconds, 0, audioBuffer.duration);

    if (clampedOffset >= audioBuffer.duration - END_EPSILON_SECONDS) {
      finishPlayback();
      return;
    }

    destroySourceNode();

    const sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.playbackRate.value = tempoRef.current;
    sourceNode.connect(workletNodeRef.current);
    sourceNode.onended = () => {
      if (sourceNodeRef.current !== sourceNode || !isPlayingRef.current) {
        return;
      }

      const currentOffset = getCurrentOffset();

      if (currentOffset >= audioBuffer.duration - END_EPSILON_SECONDS) {
        finishPlayback();
      }
    };

    startOffsetRef.current = clampedOffset;
    startContextTimeRef.current = audioCtx.currentTime;
    currentOffsetRef.current = clampedOffset;
    sourceNodeRef.current = sourceNode;

    workletNodeRef.current.playbackRate.value = tempoRef.current;
    workletNodeRef.current.pitch.value = DEFAULT_PITCH;
    workletNodeRef.current.pitchSemitones.value = pitchSemitonesRef.current;

    sourceNode.start(0, clampedOffset);
    isPlayingRef.current = true;
    setIsPlaying(true);
    syncUiToOffset(clampedOffset);
    startProgressLoop();
  }, [audioBuffer, audioCtx, destroySourceNode, finishPlayback, getCurrentOffset, startProgressLoop, syncUiToOffset]);

  const pausePlayback = useCallback(() => {
    const currentOffset = getCurrentOffset();

    isPlayingRef.current = false;
    setIsPlaying(false);
    stopProgressLoop();
    destroySourceNode();
    startOffsetRef.current = currentOffset;
    syncUiToOffset(currentOffset);
  }, [destroySourceNode, getCurrentOffset, stopProgressLoop, syncUiToOffset]);

  const commitScrub = useCallback(async (nextProgress = scrubProgressRef.current) => {
    if (!audioBuffer) {
      isScrubbingRef.current = false;
      setIsScrubbing(false);
      scrubProgressRef.current = 0;
      return;
    }

    const clampedProgress = clamp(nextProgress, 0, 100);
    scrubProgressRef.current = clampedProgress;
    const nextOffset = (clampedProgress / 100) * audioBuffer.duration;

    isScrubbingRef.current = false;
    setIsScrubbing(false);

    if (!isPlayingRef.current) {
      startOffsetRef.current = nextOffset;
      syncUiToOffset(nextOffset);
      return;
    }

    pausePlayback();
    await ensureAudioContextIsRunning();
    createAndStartSource(nextOffset);
  }, [audioBuffer, createAndStartSource, ensureAudioContextIsRunning, pausePlayback, syncUiToOffset]);

  useEffect(() => {
    let disposed = false;

    isPlayingRef.current = false;
    isScrubbingRef.current = false;
    setIsReady(false);
    setIsPlaying(false);
    setIsScrubbing(false);
    setLoadError(null);
    setTimePlayed('0:00');
    scrubProgressRef.current = 0;
    stopProgressLoop();
    destroySourceNode();

    if (progressInputRef.current) {
      progressInputRef.current.value = '0';
    }

    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.disconnect();
      } catch {
        // The node may already be disconnected during teardown.
      }

      workletNodeRef.current = null;
    }

    if (gainNodeRef.current) {
      try {
        gainNodeRef.current.disconnect();
      } catch {
        // The node may already be disconnected during teardown.
      }

      gainNodeRef.current = null;
    }

    startContextTimeRef.current = 0;
    startOffsetRef.current = 0;
    currentOffsetRef.current = 0;

    if (!audioBuffer || !audioCtx) {
      return undefined;
    }

    const setupWorklet = async () => {
      try {
        await registerProcessor(audioCtx);

        if (disposed) {
          return;
        }

        const workletNode = new SoundTouchNode(audioCtx);
        const gainNode = audioCtx.createGain();

        workletNode.playbackRate.value = tempoRef.current;
        workletNode.pitch.value = DEFAULT_PITCH;
        workletNode.pitchSemitones.value = pitchSemitonesRef.current;
        gainNode.gain.value = volumeRef.current;
        workletNode.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        workletNodeRef.current = workletNode;
        gainNodeRef.current = gainNode;
        setIsReady(true);
      } catch (error) {
        if (disposed) {
          return;
        }

        console.error('Failed to initialize the SoundTouch audio worklet.', error);
        setLoadError('The SoundTouch worklet failed to load.');
      }
    };

    void setupWorklet();

    return () => {
      disposed = true;
      isPlayingRef.current = false;
      stopProgressLoop();
      destroySourceNode();

      if (workletNodeRef.current) {
        try {
          workletNodeRef.current.disconnect();
        } catch {
          // The node may already be disconnected during teardown.
        }

        workletNodeRef.current = null;
      }

      if (gainNodeRef.current) {
        try {
          gainNodeRef.current.disconnect();
        } catch {
          // The node may already be disconnected during teardown.
        }

        gainNodeRef.current = null;
      }
    };
  }, [audioBuffer, audioCtx, destroySourceNode, stopProgressLoop]);

  useEffect(() => {
    if (!isScrubbing) {
      return undefined;
    }

    const handlePointerRelease = () => {
      void commitScrub();
    };

    window.addEventListener('pointerup', handlePointerRelease);
    window.addEventListener('pointercancel', handlePointerRelease);

    return () => {
      window.removeEventListener('pointerup', handlePointerRelease);
      window.removeEventListener('pointercancel', handlePointerRelease);
    };
  }, [commitScrub, isScrubbing]);

  useEffect(() => {
    tempoRef.current = tempo;

    if (workletNodeRef.current) {
      workletNodeRef.current.playbackRate.value = tempo;
    }

    if (sourceNodeRef.current) {
      const currentOffset = getCurrentOffset();

      startOffsetRef.current = currentOffset;
      startContextTimeRef.current = audioCtx.currentTime;
      sourceNodeRef.current.playbackRate.value = tempo;
    }
  }, [audioCtx, getCurrentOffset, tempo]);

  useEffect(() => {
    pitchSemitonesRef.current = pitchSemitones;

    if (workletNodeRef.current) {
      workletNodeRef.current.pitchSemitones.value = pitchSemitones;
    }
  }, [pitchSemitones]);

  useEffect(() => {
    volumeRef.current = volume;

    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);

  const handlePlayPause = useCallback(async () => {
    if (!audioBuffer || !audioCtx || !workletNodeRef.current) {
      return;
    }

    if (isPlayingRef.current) {
      pausePlayback();
      return;
    }

    const nextOffset = currentOffsetRef.current >= durationSeconds - END_EPSILON_SECONDS
      ? 0
      : currentOffsetRef.current;

    await ensureAudioContextIsRunning();
    createAndStartSource(nextOffset);
  }, [audioBuffer, audioCtx, createAndStartSource, durationSeconds, ensureAudioContextIsRunning, pausePlayback]);

  const beginScrub = useCallback(() => {
    if (!audioBuffer) {
      return;
    }

    isScrubbingRef.current = true;
    setIsScrubbing(true);
    scrubProgressRef.current = Number(progressInputRef.current?.value ?? '0');
  }, [audioBuffer]);

  const handleSeekChange = useCallback(async (event) => {
    const nextProgress = Number(event.target.value);

    scrubProgressRef.current = nextProgress;

    if (!isScrubbingRef.current) {
      await commitScrub(nextProgress);
    }
  }, [commitScrub]);

  return {
    beginScrub,
    commitScrub,
    duration,
    durationSeconds,
    handlePlayPause,
    handleSeekChange,
    isPlaying,
    isReady,
    isScrubbing,
    loadError,
    pitchSemitones,
    progressInputRef,
    setPitchSemitones,
    setTempo,
    tempo,
    timePlayed,
  };
};
