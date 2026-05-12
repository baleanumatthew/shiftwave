function TopControls({
  errorDisplay,
  handleFileChange,
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
