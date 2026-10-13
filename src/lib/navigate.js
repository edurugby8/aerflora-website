// In-page navigation. The cabin journey is several screens tall, so a menu
// link to a section further down jumps there at once instead of scrolling
// through the whole flight; short hops still glide. Scrolling by hand keeps
// the journey exactly as before.

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const headerHeight = () => document.querySelector('.nav')?.offsetHeight ?? 0;

/** Keeps the address bar in step with where the visitor is (no extra history entries). */
export function setLocation(hash) {
  if (location.hash !== hash) history.replaceState(null, '', hash || location.pathname + location.search);
}

export function goTo(hash, { instant = false } = {}) {
  const el = hash && hash !== '#' ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
  if (!el && hash !== '#inicio') return false;
  const top = !el || el.id === 'inicio' ? 0 : Math.max(0, el.getBoundingClientRect().top + window.scrollY - headerHeight());
  const far = Math.abs(top - window.scrollY) > window.innerHeight * 1.2;
  window.scrollTo({ top, behavior: instant || far || reduced() ? 'auto' : 'smooth' });
  setLocation(hash);
  // keyboard and screen-reader users continue from the section they asked for
  if (el && el.id !== 'inicio') {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }
  return true;
}

/** Same-page links (menu, buttons, footer) go through goTo. */
export function installAnchorNavigation() {
  const onClick = (ev) => {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    const a = ev.target.closest?.('a[href^="#"]');
    if (!a || a.hasAttribute('download')) return;
    if (goTo(a.getAttribute('href'))) ev.preventDefault();
  };
  document.addEventListener('click', onClick);
  return () => document.removeEventListener('click', onClick);
}
