function ControlPod({
  canDecrease,
  canIncrease,
  isReady,
  onDecrease,
  onIncrease,
  onReset,
  panelClassName = '',
  resetDisabled,
  resetLabel,
  title,
  value,
}) {
  return (
    <section className={`control-pod${panelClassName}`}>
      <button
        className="control-pod__step"
        type="button"
        onClick={onDecrease}
        disabled={!isReady || !canDecrease}
        aria-label={`Lower ${title.toLowerCase()}`}
      >
        -
      </button>
      <div className="control-pod__center">
        <span className="control-pod__title">{title}</span>
        <span className="control-pod__value">{value}</span>
        <button
          className="control-pod__reset"
          type="button"
          onClick={onReset}
          disabled={!isReady || resetDisabled}
          aria-label={resetLabel}
          title={resetLabel}
        >
          Reset
        </button>
      </div>
      <button
        className="control-pod__step"
        type="button"
        onClick={onIncrease}
        disabled={!isReady || !canIncrease}
        aria-label={`Raise ${title.toLowerCase()}`}
      >
        +
      </button>
    </section>
  );
}

export default ControlPod;
