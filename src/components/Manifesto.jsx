const CLIENTS = ['Maison Céleste', 'Ligne Verte', 'hôtel brume', 'ATELIER NORD', 'Voyages Iris'];

export default function Manifesto() {
  return (
    <section className="manifesto" id="about">
      <div className="manifesto-panel">
        <p className="eyebrow">About us</p>
        <p className="manifesto-text">
          Aerflora is a floral atelier for journeys. We plant whole <em>gardens</em> where
          people are only meant to wait — cabins, carriages, lounges — composed by season and
          tended by hand, so every departure smells of <em>spring</em>. Take your seat and
          let it <em>bloom</em>.
        </p>
        <ul className="clients" aria-label="Selected clients">
          {CLIENTS.map((c) => <li key={c}>{c}</li>)}
        </ul>
      </div>
    </section>
  );
}
