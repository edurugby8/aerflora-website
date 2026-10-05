import { useLayoutEffect, useRef } from 'react';

// Wide grotesque headline with fraktur capitals, as in the reference.
const F = ({ children }) => <span className="frak">{children}</span>;

/**
 * The CSS size is only a target: the lines never wrap, so if the real
 * rendered width is larger (font fallback, browser text scaling, zoom) the
 * headline is measured and scaled down to always fit between its margins.
 */
function useFitLines(ref) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let raf = 0;
    const fit = () => {
      el.style.fontSize = '';
      const base = parseFloat(getComputedStyle(el).fontSize);
      const avail = el.parentElement.clientWidth - 2 * el.offsetLeft;
      const widest = Math.max(...[...el.querySelectorAll('.line')].map((l) => l.scrollWidth));
      if (widest > avail) el.style.fontSize = `${Math.floor(base * (avail / widest) * 0.98 * 10) / 10}px`;
    };
    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit); };
    fit();
    document.fonts?.ready.then(schedule);
    window.addEventListener('resize', schedule);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', schedule); };
  }, [ref]);
}

export default function Headline() {
  const ref = useRef(null);
  useFitLines(ref);
  return (
    <h1 ref={ref} className="headline" aria-label="Let it bloom above clouds">
      <span className="line" aria-hidden="true"><F>L</F>et it <F>B</F>loom</span>
      <span className="line" aria-hidden="true"><F>A</F>bove <F>C</F>louds</span>
    </h1>
  );
}
