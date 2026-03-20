function TransportToggleIcon({ isPlaying }) {
  return (
    <svg
      className="transport-button__icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="transport-icon-gradient" x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="var(--glow-color-primary)" />
          <stop offset="48%" stopColor="var(--glow-color-secondary)" />
          <stop offset="100%" stopColor="var(--glow-color-tertiary)" />
        </linearGradient>
      </defs>
      {isPlaying ? (
        <>
          <rect x="6.6" y="5.75" width="4.2" height="12.5" rx="1.15" fill="url(#transport-icon-gradient)" />
          <rect x="13.2" y="5.75" width="4.2" height="12.5" rx="1.15" fill="url(#transport-icon-gradient)" />
        </>
      ) : (
        <path d="M7.15 5.45v13.1l11.05-6.55-11.05-6.55Z" fill="url(#transport-icon-gradient)" />
      )}
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg
      className="transport-dock__volume-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="volume-icon-gradient" x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="var(--glow-color-primary)" />
          <stop offset="48%" stopColor="var(--glow-color-secondary)" />
          <stop offset="100%" stopColor="var(--glow-color-tertiary)" />
        </linearGradient>
      </defs>
      <path
        d="M4.75 9.4h3.55l4.55-3.9v13l-4.55-3.9H4.75a1 1 0 0 1-1-1V10.4a1 1 0 0 1 1-1Z"
        fill="url(#volume-icon-gradient)"
      />
      <path
        d="M15.35 9.25Q18.35 12 15.35 14.75"
        fill="none"
        stroke="url(#volume-icon-gradient)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17.55 6.95Q22.05 12 17.55 17.05"
        fill="none"
        stroke="url(#volume-icon-gradient)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export {
  TransportToggleIcon,
  VolumeIcon,
};
