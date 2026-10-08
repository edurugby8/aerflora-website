export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-brand">
        <a className="brand" href="#inicio">Aerflora</a>
        <p>Siempre hay una razón para florecer.</p>
      </div>
      <nav className="footer-links" aria-label="Pie de página">
        <a href="#flores">Ramos y flores</a>
        <a href="#ocasiones">Ocasiones</a>
        <a href="#nosotros">Sobre Aerflora</a>
        <a href="#contacto">Contacto</a>
      </nav>
      <p className="footer-meta">© 2026 Aerflora · Floristería</p>
    </footer>
  );
}
