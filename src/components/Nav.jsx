import { useEffect, useRef, useState } from 'react';

// the closing section ("Llévate tu ramo") is not in the menu: "Encuentra tu ramo" already leads there
const LINKS = [
  ['#flores', 'Colecciones'],
  ['#ocasiones', 'Ocasiones'],
  ['#nosotros', 'Nosotros'],
];
const SECTIONS = ['tu-ramo', 'flores', 'ocasiones', 'nosotros'];

// Floats in an ivory haze over the cabin; once the journey is behind us it
// becomes a solid cream bar so it never sits on top of the shop content. The
// link of the section in view is marked as the current location.
export default function Nav() {
  const [open, setOpen] = useState(false);
  const [solid, setSolid] = useState(false);
  const [active, setActive] = useState(null);
  const toggleRef = useRef(null);
  const headerRef = useRef(null);

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

  // which section crosses the middle of the screen
  useEffect(() => {
    const seen = new Map();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => seen.set(e.target.id, e.isIntersecting));
      setActive(SECTIONS.find((id) => seen.get(id)) ?? null);
    }, { rootMargin: '-45% 0px -50% 0px' });
    SECTIONS.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);

  // the mobile menu closes with Escape or a tap outside, and gives focus back to its button
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); toggleRef.current?.focus(); } };
    const onDown = (e) => { if (!headerRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [open]);

  const close = () => setOpen(false);
  const current = (href) => (active && href === `#${active}` ? 'location' : undefined);

  return (
    <header ref={headerRef} className={`nav${solid || open ? ' is-solid' : ''}${open ? ' is-open' : ''}`}>
      <a className="brand" href="#inicio" onClick={close} aria-label="Aerflora, inicio">
        Aerflora
      </a>
      <nav id="nav-links" className="nav-links" aria-label="Principal">
        {LINKS.map(([href, label]) => <a key={href} href={href} onClick={close} aria-current={current(href)}>{label}</a>)}
        <a className="btn btn-primary btn-small nav-cta" href="#tu-ramo" onClick={close} aria-current={current('#tu-ramo')}>Encuentra tu ramo</a>
      </nav>
      <button
        ref={toggleRef}
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
