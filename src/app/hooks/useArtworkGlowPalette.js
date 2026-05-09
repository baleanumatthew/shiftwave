import { useEffect, useRef, useState } from 'react';
import { defaultGlowPalette } from '../constants.js';
import { extractGlowPaletteFromArtwork } from '../utils/artwork.js';

const glowPaletteTransitionDurationMs = 560;
const rgbPattern = /^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\)$/u;

const parseRgbColor = (color) => {
  const match = rgbPattern.exec(color);

  if (!match) {
    return null;
  }

  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
  };
};

const formatRgbColor = ({ r, g, b }) => (
  `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`
);

const mixChannel = (fromValue, toValue, progress) => (
  fromValue + ((toValue - fromValue) * progress)
);

const mixRgbColor = (fromColor, toColor, progress) => {
  const parsedFromColor = parseRgbColor(fromColor);
  const parsedToColor = parseRgbColor(toColor);

  if (!parsedFromColor || !parsedToColor) {
    return progress >= 1 ? toColor : fromColor;
  }

  return formatRgbColor({
    r: mixChannel(parsedFromColor.r, parsedToColor.r, progress),
    g: mixChannel(parsedFromColor.g, parsedToColor.g, progress),
    b: mixChannel(parsedFromColor.b, parsedToColor.b, progress),
  });
};

const mixGlowPalette = (fromPalette, toPalette, progress) => ({
  primary: mixRgbColor(fromPalette.primary, toPalette.primary, progress),
  secondary: mixRgbColor(fromPalette.secondary, toPalette.secondary, progress),
  tertiary: mixRgbColor(fromPalette.tertiary, toPalette.tertiary, progress),
});

const easeOut = (progress) => 1 - ((1 - progress) ** 3);

const getPrefersReducedMotion = () => (
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
);

export const useArtworkGlowPalette = (artworkDisplayItem) => {
  const [targetGlowPalette, setTargetGlowPalette] = useState(defaultGlowPalette);
  const [glowPalette, setGlowPalette] = useState(defaultGlowPalette);
  const glowPaletteRef = useRef(defaultGlowPalette);
  const artworkUrl = artworkDisplayItem.kind === 'image'
    ? artworkDisplayItem.metadata.artworkUrl
    : null;

  useEffect(() => {
    let isCancelled = false;

    if (!artworkUrl) {
      const resetAnimationFrameId = requestAnimationFrame(() => {
        setTargetGlowPalette(defaultGlowPalette);
      });

      return () => {
        cancelAnimationFrame(resetAnimationFrameId);
      };
    }

    extractGlowPaletteFromArtwork(artworkUrl)
      .then((nextGlowPalette) => {
        if (!isCancelled) {
          setTargetGlowPalette(nextGlowPalette);
        }
      })
      .catch(() => {
        // Keep the previous palette until a new artwork sample succeeds.
      });

    return () => {
      isCancelled = true;
    };
  }, [artworkUrl]);

  useEffect(() => {
    let animationFrameId = 0;
    const fromGlowPalette = glowPaletteRef.current;
    const animationStartedAt = performance.now();

    const animateGlowPalette = (timestamp) => {
      if (getPrefersReducedMotion()) {
        glowPaletteRef.current = targetGlowPalette;
        setGlowPalette(targetGlowPalette);

        return;
      }

      const elapsedMs = timestamp - animationStartedAt;
      const linearProgress = Math.min(elapsedMs / glowPaletteTransitionDurationMs, 1);
      const nextGlowPalette = mixGlowPalette(fromGlowPalette, targetGlowPalette, easeOut(linearProgress));

      glowPaletteRef.current = nextGlowPalette;
      setGlowPalette(nextGlowPalette);

      if (linearProgress < 1) {
        animationFrameId = requestAnimationFrame(animateGlowPalette);
      }
    };

    animationFrameId = requestAnimationFrame(animateGlowPalette);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [targetGlowPalette]);

  return glowPalette;
};
