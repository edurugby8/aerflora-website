// Real progress: share of the essential frames actually decoded.
export default function Loader({ progress, done }) {
  const pct = Math.round(progress * 100);
  return (
    <div className={`loader${done ? ' is-done' : ''}`} role="progressbar" aria-label="Loading the journey"
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-hidden={done}>
      <p className="loader-word">Aerflora</p>
      <div className="loader-bar"><span style={{ transform: `scaleX(${progress})` }} /></div>
      <p className="loader-meta"><span>Boarding</span><span>{String(pct).padStart(2, '0')}%</span></p>
    </div>
  );
}
