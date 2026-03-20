import { contentRevealAnimationDurationMs } from '../constants.js';
import {
  useAnimatedAdjustmentDisplay,
  useAnimatedArtworkDisplay,
  useAnimatedMetadataDisplay,
  useAnimatedValueDisplay,
} from './useAnimatedDisplays.js';
import { useArtworkGlowPalette } from './useArtworkGlowPalette.js';
import {
  formatBpm,
  formatDisplayKey,
  formatDisplayScale,
  transposeKey,
} from '../utils/display.js';

export const useDashboardDisplayModel = ({
  features,
  loadError,
  pitchSemitones,
  sourceMetadata,
  tempoMultiplier,
}) => {
  const artworkDisplay = useAnimatedArtworkDisplay(sourceMetadata);
  const metadataDisplay = useAnimatedMetadataDisplay(sourceMetadata);
  const keyValueDisplay = useAnimatedValueDisplay(
    features.key
      ? `${formatDisplayKey(features.key)} ${formatDisplayScale(features.scale)}`
      : '',
  );
  const tempoValueDisplay = useAnimatedValueDisplay(formatBpm(features.tempo));
  const errorDisplay = useAnimatedValueDisplay(loadError, contentRevealAnimationDurationMs);
  const glowPalette = useArtworkGlowPalette(artworkDisplay.item);

  const tempoLabel = tempoValueDisplay.value;
  const adjustedTempoLabel = features.tempo
    ? formatBpm(features.tempo * tempoMultiplier)
    : '';
  const originalKeyLabel = keyValueDisplay.value;
  const adjustedKeyLabel = features.key
    ? `${formatDisplayKey(transposeKey(features.key, pitchSemitones))} ${formatDisplayScale(features.scale)}`
    : '';
  const tempoIsAdjusted = Math.abs(tempoMultiplier - 1) > 0.0001;
  const pitchIsAdjusted = pitchSemitones !== 0;
  const tempoAdjustmentDisplay = useAnimatedAdjustmentDisplay(tempoIsAdjusted, adjustedTempoLabel);
  const keyAdjustmentDisplay = useAnimatedAdjustmentDisplay(pitchIsAdjusted, adjustedKeyLabel);
  const metadataLabelAdjustmentDisplay = useAnimatedAdjustmentDisplay(
    metadataDisplay.item.showsArtistLabelSuffix,
    '- Artist',
  );
  const hasTempoValue = tempoIsAdjusted
    ? tempoValueDisplay.isVisible && Boolean(adjustedTempoLabel)
    : tempoValueDisplay.isVisible;
  const hasKeyValue = pitchIsAdjusted
    ? keyValueDisplay.isVisible && Boolean(adjustedKeyLabel)
    : keyValueDisplay.isVisible;

  return {
    artworkDisplay,
    errorDisplay,
    glowStyle: {
      '--glow-color-primary': glowPalette.primary,
      '--glow-color-secondary': glowPalette.secondary,
      '--glow-color-tertiary': glowPalette.tertiary,
    },
    hasKeyValue,
    hasTempoValue,
    keyAdjustmentDisplay,
    keyValueDisplay,
    metadataDisplay,
    metadataLabelAdjustmentDisplay,
    originalKeyLabel,
    tempoAdjustmentDisplay,
    tempoLabel,
    tempoValueDisplay,
  };
};
