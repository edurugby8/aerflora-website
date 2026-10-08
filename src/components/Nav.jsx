import { useEffect, useState } from 'react';

const LINKS = [
  ['#flores', 'Flores'],
  ['#ocasiones', 'Ocasiones'],
  ['#nosotros', 'Nosotros'],
  ['#contacto', 'Contacto'],
];

// Transparent over the cabin; once the journey is behind us it becomes a
// solid cream bar so it never sits on top of the shop content.
export default function Nav() {
  const [open, setOpen] = useState(false);
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const journey = document.querySelector('.journey, .static-hero');
      const end = journey ? journey.offsetTop + journey.offsetHeight - 90 : 0;
      setSolid(window.scrollY > end);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, []);

  const close = () => setOpen(false);

  return (
    <header className={`nav${solid || open ? ' is-solid' : ''}${open ? ' is-open' : ''}`}>
      <a className="brand" href="#inicio" onClick={close} aria-label="Aerflora, inicio">
        Aerflora
      </a>
      <nav id="nav-links" className="nav-links" aria-label="Principal">
        {LINKS.map(([href, label]) => <a key={href} href={href} onClick={close}>{label}</a>)}
        <a className="btn btn-primary btn-small nav-cta" href="#contacto" onClick={close}>Encargar</a>
      </nav>
      <button
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls="nav-links"
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={open ? 'icon-x' : 'icon-menu'} aria-hidden="true" />
      </button>
    </header>
  );
}
