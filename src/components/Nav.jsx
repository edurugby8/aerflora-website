import { useState } from 'react';

export default function Nav({ row }) {
  const [open, setOpen] = useState(true);
  return (
    <header className="nav">
      <p className="nav-flight"><span className="dot" />Flight AF-01 · Boarding now</p>
      <nav className="nav-center" aria-label="Main">
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="nav-links"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
        >
          <span className={open ? 'icon-x' : 'icon-menu'} aria-hidden="true" />
        </button>
        <ul id="nav-links" className={`nav-links${open ? '' : ' is-hidden'}`}>
          <li><a href="#home">Home</a></li>
          <li><a href="#about">About</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
      </nav>
      {row != null && (
        <p className="nav-row" aria-label={`Row ${row}`}>
          <span>Row</span>
          <strong>{row}</strong>
        </p>
      )}
    </header>
  );
}
