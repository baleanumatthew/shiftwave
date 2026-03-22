import { useCallback, useEffect, useRef, useState } from 'react';
import { SoundTouchNode } from '@soundtouchjs/audio-worklet';
import { OfflineAudioContextClass } from '../../app/constants.js';
import { DEFAULT_PITCH } from '../constants.js';
import { registerProcessor } from '../utils.js';

const EXPORT_PADDING_SECONDS = 1;
const EXPORT_SIGNAL_THRESHOLD = 1 / 32768;
const FILE_NAME_PART_MAX_LENGTH = 72;
const FILE_NAME_MAX_LENGTH = 160;

const isInvalidFileNameCharacter = (character) => {
  const codePoint = character.codePointAt(0);

  return (
    codePoint !== undefined
    && (codePoint < 0x20 || '<>:"/\\|?*'.includes(character))
  );
};

const normalizeFileNamePart = (value) => (
  Array.from(String(value ?? '').normalize('NFKC'))
    .map((character) => (isInvalidFileNameCharacter(character) ? ' ' : character))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, FILE_NAME_PART_MAX_LENGTH)
);

const buildAdjustmentLabel = (tempo, pitchSemitones) => {
  const segments = [];

  if (Number.isFinite(tempo) && Math.abs(tempo - 1) > Number.EPSILON) {
    segments.push(`${tempo.toFixed(2)}x`);
  }

  if (Number.isFinite(pitchSemitones) && pitchSemitones !== 0) {
    segments.push(`${pitchSemitones > 0 ? '+' : ''}${pitchSemitones}st`);
  }

  return segments.length ? segments.join(' ') : 'original';
};

const createExportFileName = (metadata, tempo, pitchSemitones) => {
  const title = normalizeFileNamePart(metadata?.title);
  const artist = normalizeFileNamePart(metadata?.artist);
  const normalizedTitle = title.toLowerCase();
  const normalizedArtist = artist.toLowerCase();
  const includeArtist = Boolean(artist) && !normalizedTitle.includes(normalizedArtist);
  const baseName = title
    ? (includeArtist ? `${artist} - ${title}` : title)
    : (artist || 'shiftwave-export');
  const fileName = `${baseName} (${buildAdjustmentLabel(tempo, pitchSemitones)}).wav`;

  return fileName.slice(0, FILE_NAME_MAX_LENGTH);
};

const getExpectedFrameLength = (audioBuffer, tempo) => {
  const resolvedTempo = Number.isFinite(tempo) && tempo > 0 ? tempo : 1;

  return Math.max(1, Math.ceil(audioBuffer.length / resolvedTempo));
};

const resolveRenderedFrameLength = (audioBuffer, expectedFrameLength) => {
  const channelData = Array.from(
    { length: audioBuffer.numberOfChannels },
    (_, channelIndex) => audioBuffer.getChannelData(channelIndex),
  );

  if (audioBuffer.length <= expectedFrameLength) {
    return audioBuffer.length;
  }

  for (let frameIndex = audioBuffer.length - 1; frameIndex >= expectedFrameLength; frameIndex -= 1) {
    for (let channelIndex = 0; channelIndex < channelData.length; channelIndex += 1) {
      if (Math.abs(channelData[channelIndex][frameIndex]) > EXPORT_SIGNAL_THRESHOLD) {
        return frameIndex + 1;
      }
    }
  }

  return expectedFrameLength;
};

const writeAsciiString = (view, offset, value) => {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
};

const encodeAudioBufferToWav = (audioBuffer, frameLength = audioBuffer.length) => {
  const resolvedFrameLength = Math.max(1, Math.min(frameLength, audioBuffer.length));
  const { numberOfChannels, sampleRate } = audioBuffer;
  const blockAlign = numberOfChannels * 2;
  const dataLength = resolvedFrameLength * blockAlign;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  const channelData = Array.from(
    { length: numberOfChannels },
    (_, channelIndex) => audioBuffer.getChannelData(channelIndex),
  );

  writeAsciiString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeAsciiString(view, 8, 'WAVE');
  writeAsciiString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAsciiString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;

  for (let frameIndex = 0; frameIndex < resolvedFrameLength; frameIndex += 1) {
    for (let channelIndex = 0; channelIndex < numberOfChannels; channelIndex += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channelIndex][frameIndex]));
      const intSample = sample < 0
        ? Math.round(sample * 0x8000)
        : Math.round(sample * 0x7fff);

      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

const downloadBlob = (blob, fileName) => {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = fileName;
  link.rel = 'noopener';
  link.style.display = 'none';

  document.body.append(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
};

const renderAdjustedAudio = async ({
  audioBuffer,
  pitchSemitones,
  tempo,
}) => {
  if (!OfflineAudioContextClass) {
    throw new Error('This browser cannot export processed audio.');
  }

  const sampleRate = audioBuffer.sampleRate;
  const expectedFrameLength = getExpectedFrameLength(audioBuffer, tempo);
  const paddingFrames = Math.ceil(sampleRate * EXPORT_PADDING_SECONDS);
  const offlineContext = new OfflineAudioContextClass(
    2,
    expectedFrameLength + paddingFrames,
    sampleRate,
  );

  await registerProcessor(offlineContext);

  const workletNode = new SoundTouchNode(offlineContext);
  const sourceNode = offlineContext.createBufferSource();

  workletNode.connect(offlineContext.destination);
  workletNode.playbackRate.value = tempo;
  workletNode.pitch.value = DEFAULT_PITCH;
  workletNode.pitchSemitones.value = pitchSemitones;

  sourceNode.buffer = audioBuffer;
  sourceNode.playbackRate.value = tempo;
  sourceNode.connect(workletNode);
  sourceNode.start(0);

  const renderedBuffer = await offlineContext.startRendering();
  const resolvedFrameLength = resolveRenderedFrameLength(renderedBuffer, expectedFrameLength);

  return {
    frameLength: resolvedFrameLength,
    renderedBuffer,
  };
};

const getExportErrorMessage = (error) => (
  error instanceof Error && error.message
    ? error.message
    : 'Shiftwave could not export this track.'
);

export const useAudioExport = ({
  audioBuffer,
  pitchSemitones,
  sourceMetadata,
  tempo,
}) => {
  const [exportError, setExportError] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleExport = useCallback(async () => {
    if (!audioBuffer || isExporting) {
      return;
    }

    const resolvedTempo = Number.isFinite(tempo) && tempo > 0 ? tempo : 1;
    const resolvedPitchSemitones = Number.isFinite(pitchSemitones)
      ? Math.round(pitchSemitones)
      : 0;

    setExportError(null);
    setIsExporting(true);

    try {
      const { frameLength, renderedBuffer } = await renderAdjustedAudio({
        audioBuffer,
        pitchSemitones: resolvedPitchSemitones,
        tempo: resolvedTempo,
      });
      const wavBlob = encodeAudioBufferToWav(renderedBuffer, frameLength);
      const fileName = createExportFileName(
        sourceMetadata,
        resolvedTempo,
        resolvedPitchSemitones,
      );

      downloadBlob(wavBlob, fileName);
    } catch (error) {
      console.error('Failed to export the adjusted track.', error);

      if (isMountedRef.current) {
        setExportError(getExportErrorMessage(error));
      }
    } finally {
      if (isMountedRef.current) {
        setIsExporting(false);
      }
    }
  }, [audioBuffer, isExporting, pitchSemitones, sourceMetadata, tempo]);

  return {
    exportError,
    handleExport,
    isExporting,
  };
};
