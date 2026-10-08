import { posterUrl } from '../lib/manifest.js';
import HeroCopy from './HeroCopy.jsx';

// Used with prefers-reduced-motion, or when the sequence cannot load:
// a still of the cabin with the opening text, no scroll-driven motion.
export default function StaticScene({ manifest }) {
  const start = posterUrl(manifest, 'start');
  return (
    <section className="static-hero" id="inicio">
      <div className="static-shot" style={start ? { backgroundImage: `url(${start})` } : undefined}>
        <div className="stage-shade" />
        <HeroCopy />
      </div>
    </section>
  );
}
