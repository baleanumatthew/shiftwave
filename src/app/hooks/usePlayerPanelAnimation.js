import { useEffect, useState } from 'react';
import { contentRevealAnimationDurationMs } from '../constants.js';

export const usePlayerPanelAnimation = (audioData) => {
  const [hasAnimatedPlayerPanelsEver, setHasAnimatedPlayerPanelsEver] = useState(false);

  useEffect(() => {
    if (!audioData || hasAnimatedPlayerPanelsEver) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setHasAnimatedPlayerPanelsEver(true);
    }, contentRevealAnimationDurationMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [audioData, hasAnimatedPlayerPanelsEver]);

  return {
    hasAnimatedPlayerPanelsEver,
    shouldAnimatePanels: !hasAnimatedPlayerPanelsEver,
  };
};
