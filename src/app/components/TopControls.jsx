function TopControls({
  errorDisplay,
  handleFileChange,
  handleYoutubeImport,
  isImporting,
  isYouTubeImportAvailable,
  onYouTubeUrlChange,
  youtubeImportUnavailableMessage,
  youtubeUrl,
}) {
  const youtubeImportStatusId = 'youtube-import-status';

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

      <form
        className={`dashboard-url${isYouTubeImportAvailable ? '' : ' dashboard-url--disabled'}`}
        onSubmit={handleYoutubeImport}
      >
        <input
          className="dashboard-url__input"
          id="youtube-url"
          type="url"
          value={youtubeUrl}
          placeholder={isYouTubeImportAvailable ? 'YouTube URL' : 'YouTube import unavailable'}
          aria-label="YouTube URL"
          aria-describedby={isYouTubeImportAvailable ? undefined : youtubeImportStatusId}
          disabled={!isYouTubeImportAvailable}
          onChange={(event) => onYouTubeUrlChange(event.target.value)}
        />
        <button
          className="dashboard-url__submit"
          type="submit"
          disabled={isImporting || !isYouTubeImportAvailable}
        >
          {isImporting ? '...' : (isYouTubeImportAvailable ? 'Go' : 'Off')}
        </button>
      </form>

      {!isYouTubeImportAvailable ? (
        <p className="dashboard-helper" id={youtubeImportStatusId}>
          {youtubeImportUnavailableMessage}
        </p>
      ) : null}

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
