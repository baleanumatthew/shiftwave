import { useEffect, useRef, useState } from 'react';
import {
  adjustmentAnimationDurationMs,
  artworkAnimationDurationMs,
  contentRevealAnimationDurationMs,
  metadataAnimationDurationMs,
} from '../constants.js';
import {
  createArtworkDisplayTarget,
  createMetadataDisplayTarget,
} from '../utils/display.js';
import { revokeArtworkDisplayTarget } from '../utils/artwork.js';

export const useAnimatedAdjustmentDisplay = (isAdjusted, value) => {
  const [displayState, setDisplayState] = useState({
    phase: 'hidden',
    value: '',
  });
  const frameRef = useRef();
  const timeoutRef = useRef();

  useEffect(() => () => {
    window.cancelAnimationFrame(frameRef.current);
    window.clearTimeout(timeoutRef.current);
  }, []);

  useEffect(() => {
    window.cancelAnimationFrame(frameRef.current);
    window.clearTimeout(timeoutRef.current);

    if (isAdjusted && value) {
      frameRef.current = window.requestAnimationFrame(() => {
        setDisplayState((currentState) => ({
          phase: currentState.phase === 'active' ? 'active' : 'entering',
          value,
        }));

        timeoutRef.current = window.setTimeout(() => {
          setDisplayState((currentState) => (
            currentState.value === value
              ? {
                  ...currentState,
                  phase: 'active',
                }
              : currentState
          ));
        }, adjustmentAnimationDurationMs);
      });

      return undefined;
    }

    frameRef.current = window.requestAnimationFrame(() => {
      setDisplayState((currentState) => {
        if (currentState.phase === 'hidden') {
          return currentState;
        }

        return {
          ...currentState,
          phase: 'exiting',
        };
      });

      timeoutRef.current = window.setTimeout(() => {
        setDisplayState({
          phase: 'hidden',
          value: '',
        });
      }, adjustmentAnimationDurationMs);
    });

    return undefined;
  }, [isAdjusted, value]);

  return {
    adjustedValue: displayState.value,
    isVisible: displayState.phase !== 'hidden',
    phase: displayState.phase,
  };
};

export const useAnimatedArtworkDisplay = (metadata) => {
  const initialTarget = createArtworkDisplayTarget(metadata);
  const [displayState, setDisplayState] = useState({
    item: initialTarget,
    phase: 'active',
  });
  const currentTargetRef = useRef(initialTarget);
  const pendingTargetRef = useRef(initialTarget);
  const frameRef = useRef();
  const timeoutRef = useRef();

  useEffect(() => () => {
    window.cancelAnimationFrame(frameRef.current);
    window.clearTimeout(timeoutRef.current);
    revokeArtworkDisplayTarget(currentTargetRef.current);
  }, []);

  useEffect(() => {
    window.cancelAnimationFrame(frameRef.current);
    window.clearTimeout(timeoutRef.current);

    const currentTarget = currentTargetRef.current;
    const nextTarget = createArtworkDisplayTarget(metadata);
    pendingTargetRef.current = nextTarget;
    const beginEntry = (target, animate) => {
      currentTargetRef.current = target;
      frameRef.current = window.requestAnimationFrame(() => {
        setDisplayState({
          item: target,
          phase: animate ? 'entering' : 'active',
        });

        if (!animate) {
          return;
        }

        timeoutRef.current = window.setTimeout(() => {
          setDisplayState((currentState) => (
            currentState.item.key === target.key
              ? {
                  ...currentState,
                  phase: 'active',
                }
              : currentState
          ));
        }, artworkAnimationDurationMs);
      });
    };

    if (currentTarget.key === nextTarget.key) {
      currentTargetRef.current = nextTarget;
      frameRef.current = window.requestAnimationFrame(() => {
        setDisplayState((currentState) => ({
          ...currentState,
          item: nextTarget,
        }));
      });
      return undefined;
    }

    frameRef.current = window.requestAnimationFrame(() => {
      setDisplayState((currentState) => ({
        ...currentState,
        phase: 'exiting',
      }));

      timeoutRef.current = window.setTimeout(() => {
        revokeArtworkDisplayTarget(currentTarget);
        beginEntry(
          pendingTargetRef.current,
          pendingTargetRef.current.key !== 'placeholder:blank:initial',
        );
      }, artworkAnimationDurationMs);
    });

    return undefined;
  }, [metadata]);

  return displayState;
};

export const useAnimatedValueDisplay = (value, durationMs = contentRevealAnimationDurationMs) => {
  const [displayState, setDisplayState] = useState({
    phase: value ? 'active' : 'hidden',
    value: value ?? '',
  });
  const currentValueRef = useRef(value ?? '');
  const pendingValueRef = useRef(value ?? '');
  const frameRef = useRef();
  const timeoutRef = useRef();

  useEffect(() => () => {
    window.cancelAnimationFrame(frameRef.current);
    window.clearTimeout(timeoutRef.current);
  }, []);

  useEffect(() => {
    const nextValue = value ?? '';
    pendingValueRef.current = nextValue;
    window.cancelAnimationFrame(frameRef.current);
    window.clearTimeout(timeoutRef.current);

    const currentValue = currentValueRef.current;
    const beginEntry = (entryValue, animate) => {
      currentValueRef.current = entryValue;
      frameRef.current = window.requestAnimationFrame(() => {
        setDisplayState({
          phase: animate ? 'entering' : 'active',
          value: entryValue,
        });

        if (!animate) {
          return;
        }

        timeoutRef.current = window.setTimeout(() => {
          setDisplayState((currentState) => (
            currentState.value === entryValue
              ? {
                  ...currentState,
                  phase: 'active',
                }
              : currentState
          ));
        }, durationMs);
      });
    };

    if (currentValue === nextValue) {
      currentValueRef.current = nextValue;
      frameRef.current = window.requestAnimationFrame(() => {
        setDisplayState((currentState) => ({
          ...currentState,
          value: nextValue,
        }));
      });
      return undefined;
    }

    if (!currentValue && nextValue) {
      beginEntry(nextValue, true);
      return undefined;
    }

    frameRef.current = window.requestAnimationFrame(() => {
      setDisplayState((currentState) => (
        currentState.phase === 'hidden'
          ? currentState
          : {
              ...currentState,
              phase: 'exiting',
            }
      ));
      // Clear the logical current value as soon as exit begins so a fresh
      // result for the next track can re-enter even if its label matches.
      currentValueRef.current = '';

      timeoutRef.current = window.setTimeout(() => {
        if (pendingValueRef.current) {
          beginEntry(pendingValueRef.current, true);
          return;
        }

        currentValueRef.current = '';
        setDisplayState({
          phase: 'hidden',
          value: '',
        });
      }, durationMs);
    });

    return undefined;
  }, [durationMs, value]);

  return {
    isVisible: displayState.phase !== 'hidden',
    phase: displayState.phase,
    value: displayState.value,
  };
};

export const useAnimatedMetadataDisplay = (metadata) => {
  const initialTarget = createMetadataDisplayTarget(metadata);
  const [displayState, setDisplayState] = useState({
    item: initialTarget,
    phase: 'active',
  });
  const currentTargetRef = useRef(initialTarget);
  const pendingTargetRef = useRef(initialTarget);
  const frameRef = useRef();
  const timeoutRef = useRef();

  useEffect(() => () => {
    window.cancelAnimationFrame(frameRef.current);
    window.clearTimeout(timeoutRef.current);
  }, []);

  useEffect(() => {
    const nextTarget = createMetadataDisplayTarget(metadata);
    pendingTargetRef.current = nextTarget;
    window.cancelAnimationFrame(frameRef.current);
    window.clearTimeout(timeoutRef.current);

    const currentTarget = currentTargetRef.current;
    const beginEntry = (target, animate) => {
      currentTargetRef.current = target;
      frameRef.current = window.requestAnimationFrame(() => {
        setDisplayState({
          item: target,
          phase: animate ? 'entering' : 'active',
        });

        if (!animate) {
          return;
        }

        timeoutRef.current = window.setTimeout(() => {
          setDisplayState((currentState) => (
            currentState.item.key === target.key
              ? {
                  ...currentState,
                  phase: 'active',
                }
              : currentState
          ));
        }, metadataAnimationDurationMs);
      });
    };

    if (currentTarget.key === nextTarget.key) {
      currentTargetRef.current = nextTarget;
      frameRef.current = window.requestAnimationFrame(() => {
        setDisplayState((currentState) => ({
          ...currentState,
          item: nextTarget,
        }));
      });
      return undefined;
    }

    frameRef.current = window.requestAnimationFrame(() => {
      setDisplayState((currentState) => ({
        ...currentState,
        phase: 'exiting',
      }));

      timeoutRef.current = window.setTimeout(() => {
        beginEntry(
          pendingTargetRef.current,
          Boolean(pendingTargetRef.current.summary),
        );
      }, metadataAnimationDurationMs);
    });

    return undefined;
  }, [metadata]);

  return displayState;
};
