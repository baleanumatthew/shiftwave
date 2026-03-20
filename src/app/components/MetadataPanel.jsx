function MetadataPanel({
  metadataDisplay,
  metadataLabelAdjustmentDisplay,
}) {
  return (
    <div className="dashboard-meta dashboard-panel--entering">
      <div className="dashboard-meta__center">
        <span className="dashboard-meta__label">
          <span className="dashboard-meta__label-base">{metadataDisplay.item.label}</span>
          {metadataLabelAdjustmentDisplay.isVisible ? (
            <span
              className={`dashboard-meta__label-adjusted dashboard-meta__label-adjusted--${metadataLabelAdjustmentDisplay.phase}`}
            >
              {metadataLabelAdjustmentDisplay.adjustedValue}
            </span>
          ) : null}
        </span>
        <span
          className={`dashboard-meta__text dashboard-meta__text--${metadataDisplay.phase}`}
        >
          {metadataDisplay.item.summary}
        </span>
      </div>
    </div>
  );
}

export default MetadataPanel;
