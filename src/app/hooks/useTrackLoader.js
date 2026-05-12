import { useCallback, useEffect, useRef, useState } from 'react';
import { useFeatureAnalysis } from './useFeatureAnalysis.js';
import { revokeMetadataArtworkUrl } from '../utils/artwork.js';
import {
  decodeAudioForPlayback,
  extractLocalFileMetadata,
  getLocalFileLoadErrorMessage,
  isLikelyAudioFile,
} from '../utils/imports.js';

const noop = () => {};

export const useTrackLoader = ({ onTrackLoaded = noop } = {}) => {
  const [audioData, setAudioData] = useState(null);
  const [playerVersion, setPlayerVersion] = useState(0);
  const [sourceMetadata, setSourceMetadata] = useState(null);
  const [hasLoadedTrackEver, setHasLoadedTrackEver] = useState(false);
  const [loadError, setLoadError] = useState(null);

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

    return loadId;
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
    hasLoadedTrackEver,
    loadError,
    playerVersion,
    sourceMetadata,
  };
};
