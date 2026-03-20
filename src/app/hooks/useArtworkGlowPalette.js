import { useEffect, useState } from 'react';
import { defaultGlowPalette } from '../constants.js';
import { extractGlowPaletteFromArtwork } from '../utils/artwork.js';

export const useArtworkGlowPalette = (artworkDisplayItem) => {
  const [glowPalette, setGlowPalette] = useState(defaultGlowPalette);
  const artworkUrl = artworkDisplayItem.kind === 'image'
    ? artworkDisplayItem.metadata.artworkUrl
    : null;

  useEffect(() => {
    let isCancelled = false;

    if (!artworkUrl) {
      return undefined;
    }

    extractGlowPaletteFromArtwork(artworkUrl)
      .then((nextGlowPalette) => {
        if (!isCancelled) {
          setGlowPalette(nextGlowPalette);
        }
      })
      .catch(() => {
        // Keep the previous palette until a new artwork sample succeeds.
      });

    return () => {
      isCancelled = true;
    };
  }, [artworkUrl]);

  return artworkUrl ? glowPalette : defaultGlowPalette;
};
