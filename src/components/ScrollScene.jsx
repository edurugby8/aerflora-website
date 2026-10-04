import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FrameSequence } from '../lib/FrameSequence.js';
import { CanvasPainter } from '../lib/CanvasPainter.js';
import { frameUrl, pickSet, posterUrl } from '../lib/manifest.js';
import Headline from './Headline.jsx';
import Manifesto from './Manifesto.jsx';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

// Share of the pinned track spent on the frame sequence; the rest holds the
// final frame so "Welcome aboard." can be read before the manifesto rises.
const FRAME_END = 0.88;

export default function ScrollScene({ manifest, ready, onProgress, onReady, onFail, onRow }) {
  const canvasRef = useRef(null);
  const trackRef = useRef(null);
  const stageRef = useRef(null);
  const painterRef = useRef(null);
  const [streamed, setStreamed] = useState(0);

  // 1. load the sequence (runs behind the loader)
  useEffect(() => {
    const set = pickSet(manifest);
    const seq = new FrameSequence({
      count: manifest.frameCount,
      urlFor: (i) => frameUrl(manifest, set, i),
    });
    let painter;
    try {
      painter = new CanvasPainter(canvasRef.current, seq, manifest.focus);
    } catch {
      onFail();
      return () => seq.dispose();
    }
    painterRef.current = painter;
    seq.load(({ essential, total }) => { onProgress(essential); setStreamed(total); })
      .then(onReady)
      .catch(onFail);
    const onResize = () => painter.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      painter.dispose();
      seq.dispose();
      painterRef.current = null;
    };
  }, [manifest]); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. scroll → frame + texts, once the essential frames are in
  useLayoutEffect(() => {
    if (!ready) return;
    const last = manifest.frameCount - 1;
    const { arrive, doorOpenStart, doorOpenEnd } = manifest.markers;
    const [rowFrom, rowTo] = manifest.rows ?? [32, 10];
    const at = (frame) => (frame / last) * FRAME_END; // frame index → timeline position

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'none' } });
      tl.set({}, {}, 1); // timeline spans exactly 0..1 of the track
      tl.to('.headline .line', { yPercent: -18, opacity: 0, stagger: 0.012, duration: at(16) }, at(3))
        .to('.scroll-cue', { opacity: 0, duration: at(5) }, 0)
        .fromTo('.stage-shade', { opacity: 1 }, { opacity: 0.35, duration: at(18) }, at(2))
        .to('.stage-shade', { opacity: 0.9, duration: at(doorOpenEnd) - at(doorOpenStart) }, at(doorOpenStart))
        .fromTo('.welcome-title', { opacity: 0, y: 24, filter: 'blur(8px)' },
          { opacity: 1, y: 0, filter: 'blur(0px)', duration: at(doorOpenEnd) - at((doorOpenStart + doorOpenEnd) / 2) },
          at((doorOpenStart + doorOpenEnd) / 2))
        .fromTo('.welcome-sub', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.04 }, at(doorOpenEnd) - 0.01);

      ScrollTrigger.create({
        trigger: trackRef.current,
        start: 'top top',
        end: 'bottom bottom',
        animation: tl,
        scrub: true, // direct: stops the instant scrolling stops
        onUpdate(self) {
          const f = Math.min(1, self.progress / FRAME_END) * last;
          painterRef.current?.setFrame(Math.round(f));
          const walk = Math.min(1, f / arrive);
          onRow(Math.round(rowFrom + (rowTo - rowFrom) * walk));
        },
      });
    }, stageRef.current?.parentNode ?? undefined);
    ScrollTrigger.refresh();
    return () => ctx.revert();
  }, [ready, manifest]); // eslint-disable-line react-hooks/exhaustive-deps

  const poster = posterUrl(manifest, 'start');

  return (
    <section className="journey" id="home">
      <div className="stage" ref={stageRef}>
        <div className="stage-poster" style={poster ? { backgroundImage: `url(${poster})` } : undefined} />
        <canvas ref={canvasRef} className="stage-canvas" aria-hidden="true" />
        <div className="stage-shade" />
        <Headline />
        <div className="welcome" aria-live="polite">
          <p className="welcome-title">Welcome aboard.</p>
          <p className="welcome-sub">Floral atelier · Cabins in bloom</p>
        </div>
        <p className="scroll-cue">Scroll to board</p>
        {manifest.provisional && (
          <p className="provisional-badge" title={manifest.note}>
            Secuencia provisional — pendiente de recursos finales
          </p>
        )}
        <div className="stream-bar" style={{ transform: `scaleX(${streamed})`, opacity: streamed < 1 ? 1 : 0 }} />
      </div>
      <div className="track" ref={trackRef} />
      <Manifesto />
    </section>
  );
}
