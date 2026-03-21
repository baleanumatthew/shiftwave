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
  const keyResultLabel = features.key
    ? `${formatDisplayKey(features.key)} ${formatDisplayScale(features.scale)}`.trim()
    : '';
  const tempoResultLabel = formatBpm(features.tempo);
  const hasCalculatedKey = Boolean(keyResultLabel);
  const hasCalculatedTempo = Boolean(tempoResultLabel);
  const keyValueDisplay = useAnimatedValueDisplay(keyResultLabel);
  const tempoValueDisplay = useAnimatedValueDisplay(tempoResultLabel);
  const errorDisplay = useAnimatedValueDisplay(loadError, contentRevealAnimationDurationMs);
  const glowPalette = useArtworkGlowPalette(artworkDisplay.item);
  const tempoDisplayMatchesResult = tempoValueDisplay.value === tempoResultLabel;
  const keyDisplayMatchesResult = keyValueDisplay.value === keyResultLabel;
  const hasTempoValue = tempoValueDisplay.phase !== 'hidden'
    && (hasCalculatedTempo ? tempoDisplayMatchesResult : Boolean(tempoValueDisplay.value));
  const hasKeyValue = keyValueDisplay.phase !== 'hidden'
    && (hasCalculatedKey ? keyDisplayMatchesResult : Boolean(keyValueDisplay.value));

  const tempoLabel = hasTempoValue ? tempoValueDisplay.value : '';
  const adjustedTempoLabel = hasCalculatedTempo
    ? formatBpm(features.tempo * tempoMultiplier)
    : '';
  const originalKeyLabel = hasKeyValue ? keyValueDisplay.value : '';
  const adjustedKeyLabel = hasCalculatedKey
    ? `${formatDisplayKey(transposeKey(features.key, pitchSemitones))} ${formatDisplayScale(features.scale)}`.trim()
    : '';
  const tempoIsAdjusted = Math.abs(tempoMultiplier - 1) > 0.0001;
  const pitchIsAdjusted = pitchSemitones !== 0;
  const tempoPrimaryReadyForAdjustment = hasCalculatedTempo
    && tempoValueDisplay.phase !== 'hidden'
    && tempoValueDisplay.phase !== 'exiting'
    && tempoDisplayMatchesResult;
  const keyPrimaryReadyForAdjustment = hasCalculatedKey
    && keyValueDisplay.phase !== 'hidden'
    && keyValueDisplay.phase !== 'exiting'
    && keyDisplayMatchesResult;
  const tempoAdjustmentDisplay = useAnimatedAdjustmentDisplay(
    tempoIsAdjusted && tempoPrimaryReadyForAdjustment,
    adjustedTempoLabel,
  );
  const keyAdjustmentDisplay = useAnimatedAdjustmentDisplay(
    pitchIsAdjusted && keyPrimaryReadyForAdjustment,
    adjustedKeyLabel,
  );
  const metadataLabelAdjustmentDisplay = useAnimatedAdjustmentDisplay(
    metadataDisplay.item.showsArtistLabelSuffix,
    '- Artist',
  );
  const showTempoAdjustment = tempoPrimaryReadyForAdjustment && tempoAdjustmentDisplay.isVisible;
  const showKeyAdjustment = keyPrimaryReadyForAdjustment && keyAdjustmentDisplay.isVisible;

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
    showKeyAdjustment,
    showTempoAdjustment,
    tempoAdjustmentDisplay,
    tempoLabel,
    tempoValueDisplay,
  };
};
