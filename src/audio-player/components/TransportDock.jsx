import {
  VOLUME_MAX,
  VOLUME_MIN,
  VOLUME_SLIDER_STEP,
} from '../constants.js';
import {
  TransportToggleIcon,
  VolumeIcon,
} from './PlayerIcons.jsx';

function TransportDock({
  commitScrub,
  duration,
  handlePlayPause,
  handleSeekChange,
  isPlaying,
  isReady,
  isScrubbing,
  onVolumeChange,
  panelClassName = '',
  progressInputRef,
  timePlayed,
  valueVolume,
  beginScrub,
}) {
  return (
    <section className={`transport-dock${panelClassName}`}>
      <div className="transport-dock__play">
        <button
          className="transport-button"
          type="button"
          onClick={handlePlayPause}
          disabled={!isReady}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          <TransportToggleIcon isPlaying={isPlaying} />
        </button>
      </div>

      <div className="transport-dock__progress">
        <input
          ref={progressInputRef}
          className="range-input range-input--progress"
          id="worklet-progress"
          type="range"
          min="0"
          max="100"
          step="0.1"
          defaultValue="0"
          onPointerDown={beginScrub}
          onBlur={() => {
            if (isScrubbing) {
              void commitScrub();
            }
          }}
          onChange={handleSeekChange}
          disabled={!isReady}
        />
      </div>

      <div className="transport-dock__time">
        <span>{timePlayed}</span>
        <span className="transport-dock__divider">/</span>
        <span>{duration}</span>
      </div>

      <div className="transport-dock__volume">
        <span className="transport-dock__volume-label">
          <VolumeIcon />
        </span>
        <input
          className="range-input range-input--volume"
          aria-label="Volume"
          type="range"
          min={VOLUME_MIN}
          max={VOLUME_MAX}
          step={VOLUME_SLIDER_STEP}
          value={valueVolume}
          onChange={(event) => onVolumeChange?.(Number(event.target.value))}
          disabled={!isReady}
        />
      </div>
    </section>
  );
}

export default TransportDock;
