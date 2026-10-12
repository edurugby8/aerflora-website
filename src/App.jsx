import { useCallback, useEffect, useState } from 'react';
import { loadManifest } from './lib/manifest.js';
import { goTo, installAnchorNavigation } from './lib/navigate.js';
import Nav from './components/Nav.jsx';
import Loader from './components/Loader.jsx';
import ScrollScene from './components/ScrollScene.jsx';
import StaticScene from './components/StaticScene.jsx';
import Shop from './components/Shop.jsx';
import BouquetFinder from './components/BouquetFinder.jsx';
import Footer from './components/Footer.jsx';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
// the opening never waits longer than this for the first frame; the poster covers it
const MAX_WAIT_MS = 2500;

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia(reducedMotionQuery).matches);
  useEffect(() => {
    const mq = window.matchMedia(reducedMotionQuery);
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

export default function App() {
  const reduced = useReducedMotion();
  const [manifest, setManifest] = useState(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [waited, setWaited] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    loadManifest().then(setManifest).catch(() => setFailed(true));
    const t = setTimeout(() => setWaited(true), MAX_WAIT_MS);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => installAnchorNavigation(), []);

  const staticMode = reduced || failed;
  const loading = !staticMode && !ready && !waited;

  useEffect(() => {
    document.documentElement.classList.toggle('is-loading', loading);
    if (loading) return;
    // a shared link to a section (#tu-ramo, #flores…) lands there directly
    if (location.hash && location.hash !== '#inicio') requestAnimationFrame(() => goTo(location.hash, { instant: true }));
  }, [loading]);

  const onReady = useCallback(() => setReady(true), []);
  const onFail = useCallback(() => setFailed(true), []);

  return (
    <>
      <Loader progress={progress} done={!loading} />
      <Nav />
      <main>
        {staticMode
          ? <StaticScene manifest={manifest} />
          : manifest && (
            <ScrollScene
              manifest={manifest}
              ready={ready}
              onProgress={setProgress}
              onReady={onReady}
              onFail={onFail}
            />
          )}
        <div className="shop">
          <BouquetFinder />
          <Shop />
        </div>
      </main>
      <Footer />
    </>
  );
}
