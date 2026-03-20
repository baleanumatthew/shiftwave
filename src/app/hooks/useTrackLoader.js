import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getYoutubeBridgeUrl,
  isYouTubeImportAvailable,
  youtubeImportUnavailableMessage,
} from '../constants.js';
import { useFeatureAnalysis } from './useFeatureAnalysis.js';
import { revokeMetadataArtworkUrl } from '../utils/artwork.js';
import {
  decodeAudioForPlayback,
  extractLocalFileMetadata,
  extractYouTubeVideoId,
  getLocalFileLoadErrorMessage,
  getYoutubeImportErrorMessage,
  isLikelyAudioFile,
  wait,
} from '../utils/imports.js';

const noop = () => {};
const isAbsoluteUrl = (value) => /^https?:\/\//iu.test(String(value ?? ''));

export const useTrackLoader = ({ onTrackLoaded = noop } = {}) => {
  const [audioData, setAudioData] = useState(null);
  const [playerVersion, setPlayerVersion] = useState(0);
  const [sourceMetadata, setSourceMetadata] = useState(null);
  const [hasLoadedTrackEver, setHasLoadedTrackEver] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');

  const activeLoadIdRef = useRef(0);
  const sourceMetadataRef = useRef(null);

  const isCurrentLoad = useCallback(
    (loadId) => loadId === activeLoadIdRef.current,
    [],
  );

  const {
    features,
    resetFeatures,
    runFeatureAnalysis,
    stopActiveWorkers,
  } = useFeatureAnalysis(isCurrentLoad);

  useEffect(() => {
    sourceMetadataRef.current = sourceMetadata;
  }, [sourceMetadata]);

  useEffect(() => () => {
    revokeMetadataArtworkUrl(sourceMetadataRef.current);
  }, []);

  const beginLoadingAttempt = useCallback(() => {
    activeLoadIdRef.current += 1;
    const loadId = activeLoadIdRef.current;

    setLoadError(null);
    setIsImporting(false);

    return loadId;
  }, []);

  const handleYouTubeUrlChange = useCallback((nextUrl) => {
    setLoadError(null);
    setYoutubeUrl(nextUrl);
  }, []);

  const loadAudioFromArrayBuffer = useCallback(async (
    arrayBuffer,
    loadId,
    nextSourceMetadata = null,
  ) => {
    let audioBuffer;

    try {
      audioBuffer = await decodeAudioForPlayback(arrayBuffer, nextSourceMetadata);
    } catch (error) {
      revokeMetadataArtworkUrl(nextSourceMetadata);
      throw error;
    }

    if (!isCurrentLoad(loadId)) {
      revokeMetadataArtworkUrl(nextSourceMetadata);
      return;
    }

    const resolvedSourceMetadata = nextSourceMetadata
      ? { ...nextSourceMetadata }
      : null;

    stopActiveWorkers();
    resetFeatures();
    onTrackLoaded();
    setAudioData(audioBuffer);
    setHasLoadedTrackEver(true);
    setSourceMetadata(resolvedSourceMetadata);
    setPlayerVersion((currentVersion) => currentVersion + 1);

    runFeatureAnalysis(audioBuffer, loadId);
  }, [isCurrentLoad, onTrackLoaded, resetFeatures, runFeatureAnalysis, stopActiveWorkers]);

  const fetchYoutubeBridgeResource = useCallback(async (resource, options = {}) => {
    const headers = new Headers(options.headers ?? {});

    headers.set('ngrok-skip-browser-warning', 'true');

    return fetch(
      isAbsoluteUrl(resource) ? resource : getYoutubeBridgeUrl(resource),
      {
        ...options,
        cache: 'no-store',
        headers,
      },
    );
  }, []);

  const waitForYoutubeImport = useCallback(async (statusUrl, loadId) => {
    while (isCurrentLoad(loadId)) {
      let statusResponse;

      try {
        statusResponse = await fetchYoutubeBridgeResource(statusUrl);
      } catch (error) {
        if (error instanceof TypeError) {
          throw new Error(
            'The bridge accepted the import, but status polling failed. Check the ngrok tunnel and browser network access.',
          );
        }

        throw error;
      }

      const statusPayload = await statusResponse.json().catch(() => ({}));

      if (!statusResponse.ok) {
        throw new Error(
          typeof statusPayload?.error === 'string'
            ? statusPayload.error
            : 'The YouTube bridge could not find that import job.',
        );
      }

      if (statusPayload?.state === 'ready') {
        return statusPayload;
      }

      if (statusPayload?.state === 'error') {
        throw new Error(
          typeof statusPayload?.error === 'string'
            ? statusPayload.error
            : (typeof statusPayload?.message === 'string'
                ? statusPayload.message
                : 'The YouTube bridge could not finish the mp3 download.'),
        );
      }

      await wait(750);
    }

    throw new Error('A newer audio load replaced this YouTube import.');
  }, [fetchYoutubeBridgeResource, isCurrentLoad]);

  const handleYoutubeImport = useCallback(async (event) => {
    event.preventDefault();

    if (!isYouTubeImportAvailable) {
      setLoadError(youtubeImportUnavailableMessage);
      return;
    }

    const trimmedUrl = youtubeUrl.trim();

    if (!trimmedUrl) {
      setLoadError('Paste a YouTube URL to import.');
      return;
    }

    if (!extractYouTubeVideoId(trimmedUrl)) {
      setLoadError('Paste a valid YouTube watch, short, live, embed, or youtu.be link.');
      return;
    }

    const loadId = beginLoadingAttempt();
    setIsImporting(true);

    try {
      const ingestResponse = await fetchYoutubeBridgeResource('/ingest/youtube', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: trimmedUrl }),
      });
      const ingestPayload = await ingestResponse.json().catch(() => ({}));

      if (!ingestResponse.ok) {
        throw new Error(
          typeof ingestPayload?.error === 'string'
            ? ingestPayload.error
            : 'The YouTube bridge could not resolve that video.',
        );
      }

      const jobId = typeof ingestPayload?.jobId === 'string'
        ? ingestPayload.jobId
        : null;
      const statusUrl = typeof ingestPayload?.statusUrl === 'string'
        ? ingestPayload.statusUrl
        : (jobId ? getYoutubeBridgeUrl(`/imports/${jobId}`) : null);

      if (!jobId) {
        throw new Error('The YouTube bridge did not return an import job ID.');
      }

      if (!statusUrl) {
        throw new Error('The YouTube bridge did not return an import status URL.');
      }

      const readyJob = await waitForYoutubeImport(statusUrl, loadId);
      const audioUrl = typeof readyJob?.mediaUrl === 'string'
        ? readyJob.mediaUrl
        : getYoutubeBridgeUrl(`/media/${jobId}`);
      const title = typeof readyJob?.title === 'string' ? readyJob.title : 'YouTube audio';
      const uploader = typeof readyJob?.artist === 'string' ? readyJob.artist : '';
      const channel = readyJob?.metadata && typeof readyJob.metadata === 'object'
        && typeof readyJob.metadata.channel === 'string'
        ? readyJob.metadata.channel
        : '';
      const author = channel || uploader;
      const metadata = readyJob?.metadata && typeof readyJob.metadata === 'object'
        ? {
            artworkIsObjectUrl: false,
            artworkUrl: typeof readyJob.metadata.thumbnailUrl === 'string'
              ? readyJob.metadata.thumbnailUrl
              : null,
            artist: author || null,
            sourceType: 'youtube',
            title,
          }
        : {
            artworkIsObjectUrl: false,
            artworkUrl: null,
            artist: author || null,
            sourceType: 'youtube',
            title,
          };

      let audioResponse;

      try {
        audioResponse = await fetchYoutubeBridgeResource(audioUrl);
      } catch (error) {
        if (error instanceof TypeError) {
          throw new Error(
            'The import finished, but the browser could not fetch the audio file from the bridge.',
          );
        }

        throw error;
      }

      if (!audioResponse.ok) {
        const audioPayload = await audioResponse.json().catch(() => ({}));
        throw new Error(
          typeof audioPayload?.error === 'string'
            ? audioPayload.error
            : 'The bridge could not stream the resolved YouTube audio.',
        );
      }

      const arrayBuffer = await audioResponse.arrayBuffer();
      await loadAudioFromArrayBuffer(arrayBuffer, loadId, metadata);

      if (!isCurrentLoad(loadId)) {
        return;
      }

      setYoutubeUrl('');
    } catch (error) {
      if (!isCurrentLoad(loadId)) {
        return;
      }

      console.error('Failed to import audio from YouTube.', error);
      setLoadError(getYoutubeImportErrorMessage(error));
    } finally {
      if (isCurrentLoad(loadId)) {
        setIsImporting(false);
      }
    }
  }, [
    beginLoadingAttempt,
    fetchYoutubeBridgeResource,
    isCurrentLoad,
    loadAudioFromArrayBuffer,
    waitForYoutubeImport,
    youtubeUrl,
  ]);

  const handleFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!isLikelyAudioFile(file)) {
      setLoadError('Please select a supported audio file.');
      return;
    }

    const loadId = beginLoadingAttempt();

    try {
      const [arrayBuffer, metadata] = await Promise.all([
        file.arrayBuffer(),
        extractLocalFileMetadata(file),
      ]);

      if (!isCurrentLoad(loadId)) {
        revokeMetadataArtworkUrl(metadata);
        return;
      }

      await loadAudioFromArrayBuffer(arrayBuffer, loadId, metadata);
    } catch (error) {
      if (!isCurrentLoad(loadId)) {
        return;
      }

      console.error('Failed to decode the selected audio file.', error);
      setLoadError(getLocalFileLoadErrorMessage(error));
    }
  }, [beginLoadingAttempt, isCurrentLoad, loadAudioFromArrayBuffer]);

  return {
    audioData,
    features,
    handleFileChange,
    handleYoutubeImport,
    handleYouTubeUrlChange,
    hasLoadedTrackEver,
    isImporting,
    loadError,
    playerVersion,
    sourceMetadata,
    isYouTubeImportAvailable,
    youtubeImportUnavailableMessage,
    youtubeUrl,
  };
};
