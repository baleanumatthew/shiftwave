import { useEffect } from 'react';
import ControlPod from './audio-player/components/ControlPod.jsx';
import TransportDock from './audio-player/components/TransportDock.jsx';
import {
  DEFAULT_PITCH_SEMITONES,
  DEFAULT_TEMPO,
  DEFAULT_VOLUME,
  PITCH_MAX,
  PITCH_MIN,
  PITCH_STEP,
  TEMPO_BUTTON_STEP,
  TEMPO_MAX,
  TEMPO_MIN,
} from './audio-player/constants.js';
import { useSoundTouchPlayer } from './audio-player/hooks/useSoundTouchPlayer.js';
import { clamp } from './audio-player/utils.js';

function AudioPlayerWorklet({
  audioBuffer,
  audioCtx,
  onPitchSemitonesChange,
  onTempoChange,
  onVolumeChange,
  shouldAnimatePanels = false,
  volume = DEFAULT_VOLUME,
}) {
  const {
    beginScrub,
    commitScrub,
    duration,
    handlePlayPause,
    handleSeekChange,
    isPlaying,
    isReady,
    isScrubbing,
    loadError,
    pitchSemitones,
    progressInputRef,
    setPitchSemitones,
    setTempo,
    tempo,
    timePlayed,
  } = useSoundTouchPlayer({
    audioBuffer,
    audioCtx,
    volume,
  });

  useEffect(() => {
    onPitchSemitonesChange?.(pitchSemitones);
  }, [onPitchSemitonesChange, pitchSemitones]);

  useEffect(() => {
    onTempoChange?.(tempo);
  }, [onTempoChange, tempo]);

  const adjustTempo = (delta) => {
    setTempo((currentTempo) => clamp(currentTempo + delta, TEMPO_MIN, TEMPO_MAX));
  };

  const adjustPitch = (delta) => {
    setPitchSemitones((currentPitch) => clamp(currentPitch + delta, PITCH_MIN, PITCH_MAX));
  };

  const resetTempo = () => {
    setTempo(DEFAULT_TEMPO);
  };

  const resetPitch = () => {
    setPitchSemitones(DEFAULT_PITCH_SEMITONES);
  };

  const pitchReadout = `${pitchSemitones > 0 ? '+' : ''}${pitchSemitones} st`;
  const tempoReadout = `${tempo.toFixed(2)}x`;
  const panelClassName = shouldAnimatePanels ? ' dashboard-panel--entering' : '';

  return (
    <>
      <ControlPod
        canDecrease={pitchSemitones > PITCH_MIN}
        canIncrease={pitchSemitones < PITCH_MAX}
        isReady={isReady}
        onDecrease={() => adjustPitch(-PITCH_STEP)}
        onIncrease={() => adjustPitch(PITCH_STEP)}
        onReset={resetPitch}
        panelClassName={panelClassName}
        resetDisabled={pitchSemitones === DEFAULT_PITCH_SEMITONES}
        resetLabel="Reset pitch"
        title="Pitch"
        value={pitchReadout}
      />

      <ControlPod
        canDecrease={tempo > TEMPO_MIN}
        canIncrease={tempo < TEMPO_MAX}
        isReady={isReady}
        onDecrease={() => adjustTempo(-TEMPO_BUTTON_STEP)}
        onIncrease={() => adjustTempo(TEMPO_BUTTON_STEP)}
        onReset={resetTempo}
        panelClassName={panelClassName}
        resetDisabled={tempo === DEFAULT_TEMPO}
        resetLabel="Reset tempo"
        title="Tempo"
        value={tempoReadout}
      />

      {loadError ? <p className="player-inline-error" role="alert">{loadError}</p> : null}

      <TransportDock
        beginScrub={beginScrub}
        commitScrub={commitScrub}
        duration={duration}
        handlePlayPause={handlePlayPause}
        handleSeekChange={handleSeekChange}
        isPlaying={isPlaying}
        isReady={isReady}
        isScrubbing={isScrubbing}
        onVolumeChange={onVolumeChange}
        panelClassName={panelClassName}
        progressInputRef={progressInputRef}
        timePlayed={timePlayed}
        valueVolume={volume}
      />
    </>
  );
}

export default AudioPlayerWorklet;
