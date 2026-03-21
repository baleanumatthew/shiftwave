const AdjustmentArrow = () => (
  <svg
    className="dashboard-stat__arrow"
    viewBox="0 0 20 20"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M3.5 10h10.5" />
    <path d="M10.75 5.75 15.25 10l-4.5 4.25" />
  </svg>
);

function AnalysisPanel({
  hasKeyValue,
  hasTempoValue,
  keyAdjustmentDisplay,
  keyValueDisplay,
  originalKeyLabel,
  showKeyAdjustment,
  showTempoAdjustment,
  tempoAdjustmentDisplay,
  tempoLabel,
  tempoValueDisplay,
}) {
  return (
    <div
      className="dashboard-stats dashboard-panel--entering dashboard-stats--panel-entering"
      aria-label="Analysis"
    >
      <span className="dashboard-stats__title">Analysis</span>
      <div className="dashboard-stat">
        <span className="dashboard-stat__label">Tempo</span>
        <p className="dashboard-stat__value">
          {hasTempoValue ? (
            <span className={`dashboard-stat__primary-group dashboard-stat__primary-group--${tempoValueDisplay.phase}`}>
              <span className="dashboard-stat__segment dashboard-stat__segment--primary">
                {tempoLabel}
              </span>
            </span>
          ) : null}
          {showTempoAdjustment ? (
            <span
              className={`dashboard-stat__adjusted dashboard-stat__adjusted--${tempoAdjustmentDisplay.phase}`}
            >
              <AdjustmentArrow />
              <span className="dashboard-stat__segment">{tempoAdjustmentDisplay.adjustedValue}</span>
            </span>
          ) : null}
        </p>
      </div>

      <div className="dashboard-stat">
        <span className="dashboard-stat__label">Key</span>
        <p className="dashboard-stat__value">
          {hasKeyValue ? (
            <span className={`dashboard-stat__primary-group dashboard-stat__primary-group--${keyValueDisplay.phase}`}>
              <span className="dashboard-stat__segment dashboard-stat__segment--primary">
                {originalKeyLabel}
              </span>
            </span>
          ) : null}
          {showKeyAdjustment ? (
            <span
              className={`dashboard-stat__adjusted dashboard-stat__adjusted--${keyAdjustmentDisplay.phase}`}
            >
              <AdjustmentArrow />
              <span className="dashboard-stat__segment">{keyAdjustmentDisplay.adjustedValue}</span>
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}

export default AnalysisPanel;
