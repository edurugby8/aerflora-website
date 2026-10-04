import { posterUrl } from '../lib/manifest.js';
import Headline from './Headline.jsx';
import Manifesto from './Manifesto.jsx';

// Used with prefers-reduced-motion, or when the sequence cannot load:
// two still moments of the journey, no scroll-driven motion.
export default function StaticScene({ manifest }) {
  const start = posterUrl(manifest, 'start');
  const end = posterUrl(manifest, 'end');
  return (
    <section className="static" id="home">
      <div className="static-shot" style={start ? { backgroundImage: `url(${start})` } : undefined}>
        <div className="stage-shade" />
        <Headline />
      </div>
      <div className="static-shot is-door" style={end ? { backgroundImage: `url(${end})` } : undefined}>
        <div className="stage-shade" />
        <div className="welcome is-static">
          <p className="welcome-title">Welcome aboard.</p>
          <p className="welcome-sub">Floral atelier · Cabins in bloom</p>
        </div>
      </div>
      <Manifesto />
    </section>
  );
}
