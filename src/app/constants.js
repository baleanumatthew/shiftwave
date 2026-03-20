export const AudioContextClass = window.AudioContext || window.webkitAudioContext;
export const OfflineAudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
export const audioCtx = new AudioContextClass();

export const emptyFeatures = {
  tempo: null,
  key: null,
  scale: null,
};

export const audioFileExtensionPattern = /\.(aac|flac|m4a|mp3|ogg|opus|wav|webm)$/i;

const normalizeBaseUrl = (value) => {
  const trimmedValue = String(value ?? '').trim();

  if (!trimmedValue) {
    return null;
  }

  return trimmedValue.replace(/\/+$/u, '');
};

const localYoutubeBridgeBaseUrl = 'http://127.0.0.1:5185';
const configuredYoutubeBridgeBaseUrl = normalizeBaseUrl(import.meta.env.VITE_YOUTUBE_BRIDGE_BASE_URL);

export const youtubeBridgeBaseUrl = configuredYoutubeBridgeBaseUrl
  ?? (import.meta.env.DEV ? localYoutubeBridgeBaseUrl : null);
export const isYouTubeImportAvailable = Boolean(youtubeBridgeBaseUrl);
export const youtubeImportUnavailableMessage = import.meta.env.DEV
  ? 'Start the YouTube bridge to enable URL imports.'
  : 'YouTube URL imports are unavailable on this deployment.';

export const getYoutubeBridgeUrl = (pathname) => {
  if (!youtubeBridgeBaseUrl) {
    throw new Error(youtubeImportUnavailableMessage);
  }

  return new URL(
    pathname.replace(/^\/+/u, ''),
    `${youtubeBridgeBaseUrl}/`,
  ).href;
};

export const defaultGlowPalette = {
  primary: 'rgb(232 232 232)',
  secondary: 'rgb(168 168 168)',
  tertiary: 'rgb(118 118 118)',
};

export const contentRevealAnimationDurationMs = 1000;
export const adjustmentAnimationDurationMs = 360;
export const artworkAnimationDurationMs = contentRevealAnimationDurationMs;
export const metadataAnimationDurationMs = contentRevealAnimationDurationMs;
