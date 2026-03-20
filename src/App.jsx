import { useCallback, useState } from 'react';
import AudioPlayerWorklet from './AudioPlayerWorklet.jsx';
import { audioCtx } from './app/constants.js';
import AnalysisPanel from './app/components/AnalysisPanel.jsx';
import ArtworkPanel from './app/components/ArtworkPanel.jsx';
import MetadataPanel from './app/components/MetadataPanel.jsx';
import ShiftwaveTitle from './app/components/ShiftwaveTitle.jsx';
import TopControls from './app/components/TopControls.jsx';
import { useDashboardDisplayModel } from './app/hooks/useDashboardDisplayModel.js';
import { usePlayerPanelAnimation } from './app/hooks/usePlayerPanelAnimation.js';
import { useTrackLoader } from './app/hooks/useTrackLoader.js';

function App() {
  const [tempoMultiplier, setTempoMultiplier] = useState(1);
  const [pitchSemitones, setPitchSemitones] = useState(0);
  const [playerVolume, setPlayerVolume] = useState(0.5);

  const resetTrackAdjustments = useCallback(() => {
    setTempoMultiplier(1);
    setPitchSemitones(0);
  }, []);

  const {
    audioData,
    features,
    handleFileChange,
    handleYoutubeImport,
    handleYouTubeUrlChange,
    hasLoadedTrackEver,
    isImporting,
    loadError,
    playerVersion,
    sourceMetadata,
    youtubeUrl,
  } = useTrackLoader({
    onTrackLoaded: resetTrackAdjustments,
  });

  const {
    artworkDisplay,
    errorDisplay,
    glowStyle,
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
  } = useDashboardDisplayModel({
    features,
    loadError,
    pitchSemitones,
    sourceMetadata,
    tempoMultiplier,
  });

  const { shouldAnimatePanels } = usePlayerPanelAnimation(audioData);

  return (
    <div className="app-shell" style={glowStyle}>
      <main className="dashboard">
        <ShiftwaveTitle />

        <TopControls
          errorDisplay={errorDisplay}
          handleFileChange={handleFileChange}
          handleYoutubeImport={handleYoutubeImport}
          isImporting={isImporting}
          onYouTubeUrlChange={handleYouTubeUrlChange}
          youtubeUrl={youtubeUrl}
        />

        {hasLoadedTrackEver ? (
          <section className="dashboard-middle">
            <ArtworkPanel artworkDisplay={artworkDisplay} />
            <AnalysisPanel
              hasKeyValue={hasKeyValue}
              hasTempoValue={hasTempoValue}
              keyAdjustmentDisplay={keyAdjustmentDisplay}
              keyValueDisplay={keyValueDisplay}
              originalKeyLabel={originalKeyLabel}
              tempoAdjustmentDisplay={tempoAdjustmentDisplay}
              tempoLabel={tempoLabel}
              tempoValueDisplay={tempoValueDisplay}
            />
          </section>
        ) : null}

        {hasLoadedTrackEver ? (
          <section className="dashboard-bottom">
            <MetadataPanel
              metadataDisplay={metadataDisplay}
              metadataLabelAdjustmentDisplay={metadataLabelAdjustmentDisplay}
            />

            <AudioPlayerWorklet
              key={playerVersion}
              audioBuffer={audioData}
              audioCtx={audioCtx}
              onTempoChange={setTempoMultiplier}
              onPitchSemitonesChange={setPitchSemitones}
              onVolumeChange={setPlayerVolume}
              shouldAnimatePanels={shouldAnimatePanels}
              volume={playerVolume}
            />
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default App;
