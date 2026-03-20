function TopControls({
  errorDisplay,
  handleFileChange,
  handleYoutubeImport,
  isImporting,
  onYouTubeUrlChange,
  youtubeUrl,
}) {
  return (
    <section className="dashboard-top">
      <label className="dashboard-action dashboard-action--file" htmlFor="local-audio-file">
        <span>Upload File</span>
      </label>
      <input
        className="dashboard-hidden-input"
        id="local-audio-file"
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
      />

      <form className="dashboard-url" onSubmit={handleYoutubeImport}>
        <input
          className="dashboard-url__input"
          id="youtube-url"
          type="url"
          value={youtubeUrl}
          placeholder="YouTube URL"
          aria-label="YouTube URL"
          onChange={(event) => onYouTubeUrlChange(event.target.value)}
        />
        <button className="dashboard-url__submit" type="submit" disabled={isImporting}>
          {isImporting ? '...' : 'Go'}
        </button>
      </form>

      <div
        className={`dashboard-error-slot dashboard-error-slot--${errorDisplay.phase}`}
        aria-live="polite"
      >
        {errorDisplay.isVisible ? (
          <p
            className={`dashboard-error dashboard-error--${errorDisplay.phase}`}
            role="alert"
          >
            {errorDisplay.value}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export default TopControls;
