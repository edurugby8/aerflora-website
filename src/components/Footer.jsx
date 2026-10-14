export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-brand">
        <a className="brand" href="#inicio">Aerflora</a>
        <p>Siempre hay una razón para florecer.</p>
      </div>
      <nav className="footer-links" aria-label="Pie de página">
        <a href="#tu-ramo">Encuentra tu ramo</a>
        <a href="#flores">Ramos y flores</a>
        <a href="#ocasiones">Ocasiones</a>
        <a href="#nosotros">Sobre Aerflora</a>
      </nav>
      <div className="footer-meta">
        <p>© 2026 Aerflora · Floristería imaginaria</p>
        <p>Demo creada por Codecraft</p>
      </div>
    </footer>
  );
}
