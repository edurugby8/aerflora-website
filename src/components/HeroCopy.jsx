// Opening text over the cabin: brand, main phrase, support line and the two
// ways in (the flowers, or straight to ordering).
export default function HeroCopy() {
  return (
    <div className="hero-copy">
      <p className="hero-eyebrow">Floristería<span className="hero-eyebrow-more"> · Flores que viajan entre nubes</span></p>
      <h1 className="hero-title">Siempre hay una razón para florecer.</h1>
      <p className="hero-invite">Hay cosas que se dicen mejor con flores.</p>
      <p className="hero-lead">Flores para celebrar, acompañar y convertir cualquier día en algo especial.</p>
      <div className="hero-actions">
        <a className="btn btn-primary btn-hero" href="#tu-ramo">Encuentra tu ramo</a>
        <a className="btn btn-ghost" href="#flores">Ver colecciones</a>
      </div>
    </div>
  );
}
