import { parseBlob } from 'music-metadata';
import {
  audioCtx,
  audioFileExtensionPattern,
  OfflineAudioContextClass,
} from '../constants.js';
import { createArtworkObjectUrl } from './artwork.js';
import {
  formatMetadataList,
  getLocalFileTitleFallback,
  normalizeMetadataText,
} from './display.js';

export const extractLocalFileMetadata = async (file) => {
  const fallbackTitle = getLocalFileTitleFallback(file.name);
  const fallbackMetadata = {
    artworkIsObjectUrl: false,
    artworkUrl: null,
    artist: null,
    sampleRate: null,
    sourceType: 'local',
    title: fallbackTitle,
  };

  try {
    const metadata = await parseBlob(file, {
      duration: true,
    });
    const picture = Array.isArray(metadata.common.picture) ? metadata.common.picture[0] : null;
    const artworkUrl = createArtworkObjectUrl(picture);

    return {
      ...fallbackMetadata,
      artworkIsObjectUrl: Boolean(artworkUrl),
      artworkUrl,
      artist: normalizeMetadataText(
        metadata.common.artist
          ?? metadata.common.albumartist
          ?? formatMetadataList(metadata.common.artists),
      ),
      sampleRate: Number.isFinite(metadata.format.sampleRate) ? metadata.format.sampleRate : null,
      title: normalizeMetadataText(metadata.common.title) ?? fallbackTitle,
    };
  } catch {
    return fallbackMetadata;
  }
};

const resolvePreferredDecodeSampleRate = (metadata) => {
  if (metadata?.sourceType !== 'local') {
    return null;
  }

  const sampleRate = Number(metadata.sampleRate);

  return Number.isFinite(sampleRate) && sampleRate > 0
    ? sampleRate
    : null;
};

export const decodeAudioForPlayback = async (arrayBuffer, sourceMetadata = null) => {
  const preferredSampleRate = resolvePreferredDecodeSampleRate(sourceMetadata);

  if (
    !preferredSampleRate
    || !OfflineAudioContextClass
    || preferredSampleRate === audioCtx.sampleRate
  ) {
    return audioCtx.decodeAudioData(arrayBuffer);
  }

  try {
    const offlineContext = new OfflineAudioContextClass(
      2,
      Math.max(1, Math.ceil(preferredSampleRate)),
      preferredSampleRate,
    );

    return await offlineContext.decodeAudioData(arrayBuffer.slice(0));
  } catch {
    return audioCtx.decodeAudioData(arrayBuffer);
  }
};

const isAudioDecodeError = (error) => (
  (error instanceof DOMException
    && ['EncodingError', 'NotSupportedError', 'InvalidStateError', 'AbortError'].includes(error.name))
  || (error instanceof Error
    && /decode|encoding|unsupported|codec|corrupt|format/u.test(String(error.message ?? '').toLowerCase()))
);

export const getLocalFileLoadErrorMessage = (error) => {
  if (isAudioDecodeError(error)) {
    return 'That audio file appears to be corrupted or uses an unsupported encoding.';
  }

  return error instanceof Error && error.message
    ? error.message
    : 'Failed to load the selected audio file.';
};

export const isLikelyAudioFile = (file) => (
  file.type
    ? file.type.startsWith('audio/')
    : audioFileExtensionPattern.test(file.name)
);
