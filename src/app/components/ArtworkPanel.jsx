function ArtworkPanel({ artworkDisplay }) {
  return (
    <div className="dashboard-artwork dashboard-panel--entering">
      {artworkDisplay.item.kind === 'image' ? (
        <img
          key={artworkDisplay.item.key}
          className={`dashboard-artwork__image dashboard-artwork__media dashboard-artwork__media--${artworkDisplay.phase}`}
          src={artworkDisplay.item.metadata.artworkUrl}
          alt={artworkDisplay.item.alt}
        />
      ) : (
        <div
          key={artworkDisplay.item.key}
          className={`dashboard-artwork__placeholder dashboard-artwork__media dashboard-artwork__media--${artworkDisplay.phase}`}
        >
          {artworkDisplay.item.label}
        </div>
      )}
    </div>
  );
}

export default ArtworkPanel;
