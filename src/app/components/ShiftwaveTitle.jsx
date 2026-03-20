function ShiftwaveTitle() {
  return (
    <div className="dashboard-title" aria-label="SHIFTWAVE">
      <svg
        className="dashboard-title__svg"
        viewBox="0 0 1100 180"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id="shiftwave-title-gradient" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop className="dashboard-title__stop dashboard-title__stop--primary" offset="0%" />
            <stop className="dashboard-title__stop dashboard-title__stop--secondary" offset="50%" />
            <stop className="dashboard-title__stop dashboard-title__stop--tertiary" offset="100%" />
          </linearGradient>
        </defs>

        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          lengthAdjust="spacingAndGlyphs"
          textLength="930"
          className="dashboard-title__text"
        >
            SHIFTWAVE
        </text>
      </svg>
    </div>
  );
}

export default ShiftwaveTitle;
