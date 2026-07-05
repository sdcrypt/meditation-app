const tones = ["sage", "dusk", "sunrise", "lavender", "ocean"];

export default function MeditationArtwork({
  meditation,
  className = "",
  children,
}) {
  const tone = tones[Math.abs(Number(meditation.id) || 0) % tones.length];

  return (
    <div className={`meditation-art meditation-art--${tone} ${className}`}>
      {meditation.artwork_url ? (
        <img src={meditation.artwork_url} alt={`${meditation.title} artwork`} />
      ) : (
        <div className="meditation-art__fallback" aria-hidden="true">
          <span className="meditation-art__sun" />
          <span className="meditation-art__mountain meditation-art__mountain--back" />
          <span className="meditation-art__mountain meditation-art__mountain--front" />
          <span className="meditation-art__moon-ring" />
        </div>
      )}
      <div className="meditation-art__shade" />
      {children}
    </div>
  );
}
