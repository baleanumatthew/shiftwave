export const AudioContextClass = window.AudioContext || window.webkitAudioContext;
export const OfflineAudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
export const audioCtx = new AudioContextClass();

export const emptyFeatures = {
  tempo: null,
  key: null,
  scale: null,
};

export const audioFileExtensionPattern = /\.(aac|flac|m4a|mp3|ogg|opus|wav|webm)$/i;

export const youtubeBridgeBaseUrl = (
  import.meta.env.VITE_YOUTUBE_BRIDGE_BASE_URL ?? 'http://127.0.0.1:5185'
).replace(/\/+$/u, '');

export const getYoutubeBridgeUrl = (pathname) => new URL(
  pathname.replace(/^\/+/u, ''),
  `${youtubeBridgeBaseUrl}/`,
).href;

export const defaultGlowPalette = {
  primary: 'rgb(232 232 232)',
  secondary: 'rgb(168 168 168)',
  tertiary: 'rgb(118 118 118)',
};

export const contentRevealAnimationDurationMs = 1000;
export const adjustmentAnimationDurationMs = 360;
export const artworkAnimationDurationMs = contentRevealAnimationDurationMs;
export const metadataAnimationDurationMs = contentRevealAnimationDurationMs;
