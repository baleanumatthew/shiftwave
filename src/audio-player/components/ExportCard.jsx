function ExportCard({
  exportDisabled,
  exportLabel,
  handleExport,
  isExporting,
  panelClassName = '',
}) {
  return (
    <section className={`export-card${panelClassName}`}>
      <button
        className="export-card__button"
        type="button"
        onClick={handleExport}
        disabled={exportDisabled}
        aria-label="Export the current track as a WAV file"
      >
        {isExporting ? 'Rendering...' : exportLabel}
      </button>
    </section>
  );
}

export default ExportCard;
