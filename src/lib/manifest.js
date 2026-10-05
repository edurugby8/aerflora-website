// The frame manifest is written by scripts/extract-frames.mjs (real footage)
// or scripts/make-placeholder-frames.mjs (provisional). Texts are synced to
// its `markers`, so swapping the footage only means regenerating this file.

export const FRAMES_BASE = `${import.meta.env.BASE_URL}frames/`;

export async function loadManifest() {
  const res = await fetch(`${FRAMES_BASE}manifest.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`manifest ${res.status}`);
  const m = await res.json();
  if (!m.frameCount || !m.sets?.length) throw new Error('manifest incomplete');
  return m;
}

export function frameUrl(manifest, set, i) {
  const n = String(i + 1).padStart(manifest.pad ?? 4, '0');
  return FRAMES_BASE + set.path.replace('{i}', n) + versionQuery(manifest);
}

// cache-busting: frames are content-hashed per render (manifest.version)
const versionQuery = (manifest) => (manifest?.version ? `?v=${manifest.version}` : '');

export const isPortraitViewport = () => window.innerWidth / window.innerHeight < 0.8;

/**
 * Picks the lightest set that still covers the viewport at the (capped)
 * device pixel ratio. Portrait screens use a portrait set when one exists so
 * the aisle stays centred without upscaling a narrow slice of a wide frame.
 */
export function pickSet(manifest) {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  const vw = window.innerWidth * dpr, vh = window.innerHeight * dpr;
  const portrait = isPortraitViewport();
  let pool = manifest.sets.filter((s) => (s.height > s.width) === portrait);
  if (!pool.length) pool = manifest.sets;
  pool = [...pool].sort((a, b) => a.width * a.height - b.width * b.height);
  // cover-fit scale needed for each set
  return pool.find((s) => Math.max(vw / s.width, vh / s.height) <= 1.15) ?? pool[pool.length - 1];
}

export function posterUrl(manifest, which) {
  const p = manifest?.posters ?? {};
  const name = isPortraitViewport() ? p[`${which}Portrait`] ?? p[which] : p[which];
  return name ? FRAMES_BASE + name + versionQuery(manifest) : null;
}
