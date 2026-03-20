import { SoundTouchNode } from '@soundtouchjs/audio-worklet';
import processorUrl from '@soundtouchjs/audio-worklet/processor?url';

const registrationPromises = new WeakMap();

export const registerProcessor = (audioCtx) => {
  let registrationPromise = registrationPromises.get(audioCtx);

  if (!registrationPromise) {
    registrationPromise = SoundTouchNode.register(audioCtx, processorUrl);
    registrationPromises.set(audioCtx, registrationPromise);
  }

  return registrationPromise;
};

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const formatTime = (seconds = 0) => {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = String(totalSeconds % 60).padStart(2, '0');

  return `${minutes}:${remainingSeconds}`;
};
