// "Haz florecer lo que sientes": three quick choices reveal a bouquet.
import { useEffect, useMemo, useRef, useState } from 'react';
import { EMOTIONS, STYLES, SIZES, CONTEXTS, FLOWERS, compose, contextPrefix, dedicationFor, summary, photo, photoKey } from '../lib/bouquets.js';
import { renderBoardingCard, download, cardFilename } from '../lib/boardingCard.js';
import { setLocation } from '../lib/navigate.js';

const STEPS = [
  { key: 'emotion', label: 'Emoción', question: '¿Qué quieres expresar?', options: EMOTIONS },
  { key: 'style', label: 'Estilo', question: '¿Qué estilo imaginas?', options: STYLES },
  { key: 'size', label: 'Tamaño', question: '¿Qué tamaño prefieres?', options: SIZES },
];
const EMPTY = { emotion: null, style: null, size: null };
const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const CARD_SIZES = '(max-width: 760px) 46vw, 240px';
const RESULT_SIZES = '(max-width: 900px) 92vw, 520px';
const labelOf = (key, id) => STEPS.find((s) => s.key === key).options.find((o) => o.id === id)?.label;

function Photo({ k, sizes, className, alt = '', ...rest }) {
  const p = photo(k);
  return <img className={className} src={p.src} srcSet={p.srcSet} sizes={sizes} alt={alt} width="480" height="600" decoding="async" {...rest} />;
}

// sizes as a simple silhouette against a ruler (30, 45 or 60 cm)
const SIZE_CM = { detalle: 30, abrazo: 45, celebracion: 60 };
function SizeIcon({ size }) {
  const k = 1.25, ground = 94, cm = SIZE_CM[size], w = cm * 0.8, top = ground - cm * k, dome = top + w * 0.3;
  return (
    <svg className="size-icon" viewBox="0 0 120 100" aria-hidden="true">
      <line className="ruler" x1="18" x2="18" y1={ground - 62 * k} y2={ground} />
      {[0, 15, 30, 45, 60].map((c) => (
        <g key={c}>
          <line className="tick" x1="14" x2="22" y1={ground - c * k} y2={ground - c * k} />
          <text x="25" y={ground - c * k + 2.4}>{c}{c === 60 ? ' cm' : ''}</text>
        </g>
      ))}
      <path className="shape" d={`M${72 - w * 0.1} ${ground} L${72 - w * 0.4} ${dome + w * 0.1} L${72 + w * 0.4} ${dome + w * 0.1} L${72 + w * 0.1} ${ground} Z`} />
      <ellipse className="shape shape-dome" cx="72" cy={dome} rx={w / 2} ry={w * 0.3} />
    </svg>
  );
}

// option cards: each emotion as a romantic bouquet, each style in the emotion already
// chosen, and each size as a silhouette with its height
function OptionArt({ stepKey, option, answers }) {
  if (stepKey === 'emotion') return <Photo k={`${option.id}-romantico`} sizes={CARD_SIZES} className="option-photo" loading="lazy" />;
  if (stepKey === 'style') return <Photo k={`${answers.emotion ?? 'amor'}-${option.id}`} sizes={CARD_SIZES} className="option-photo" loading="lazy" />;
  return <SizeIcon size={option.id} />;
}

function SizeScale({ size }) {
  const s = SIZES.find((x) => x.id === size);
  return (
    <p className="size-scale">
      <span className="size-bars" aria-hidden="true">{SIZES.map((x) => <i key={x.id} className={x.id === size ? 'is-on' : ''} />)}</span>
      <span><strong>{s.label}</strong> · {s.hint.toLowerCase()} · {s.height} de alto</span>
    </p>
  );
}

/** The bouquet's image, revealed like a print coming up once it has loaded. */
function ResultPhoto({ proposal }) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef(null);
  useEffect(() => { if (ref.current?.complete) setLoaded(true); }, []);
  // the renders show each emotion × style; the caption never claims a size
  const alt = `Recreación 3D de un ramo de estilo ${proposal.style.label.toLowerCase()} en tonos ${proposal.palette.slice(0, 3).map((c) => c.name.toLowerCase()).join(', ')}.`;
  return (
    <figure className="result-art">
      <div className={`result-frame${loaded ? ' is-loaded' : ''}`}>
        <Photo k={photoKey(proposal)} sizes={RESULT_SIZES} className="result-photo" alt={alt} ref={ref} onLoad={() => setLoaded(true)} onError={() => setLoaded(true)} />
      </div>
      <figcaption>
        <SizeScale size={proposal.size.id} />
        <span className="result-note">Recreación 3D orientativa del estilo y la paleta. Cada ramo se compone a mano con flor de temporada.</span>
      </figcaption>
    </figure>
  );
}

export default function BouquetFinder() {
  const [answers, setAnswers] = useState(EMPTY);
  const [step, setStep] = useState(0); // 0–2 questions, 3 = the bouquet
  const [editing, setEditing] = useState(false); // came back from the result to change one answer
  const [context, setContext] = useState(null); // an occasion or collection the visitor came from
  const [dedication, setDedication] = useState('');
  const [dedicationEdited, setDedicationEdited] = useState(false);
  const [copyState, setCopyState] = useState(null); // 'ok' | 'manual'
  const [card, setCard] = useState(null); // { state: 'working' | 'ok' | 'error', url?, filename? }
  const sectionRef = useRef(null);
  const focusRef = useRef(null);
  const manualRef = useRef(null);
  const moved = useRef(false);
  const [jump, setJump] = useState(0); // occasions re-scroll even when the step stays the same

  const complete = STEPS.every((s) => answers[s.key]);
  const firstMissing = STEPS.findIndex((s) => !answers[s.key]);
  const proposal = useMemo(() => (complete ? compose(answers, context) : null), [answers, context, complete]);

  // the suggested dedication follows the emotion until the visitor writes their own
  useEffect(() => {
    if (!dedicationEdited) setDedication(dedicationFor(answers.emotion));
  }, [answers.emotion, dedicationEdited]);

  // fetch the bouquet's image as soon as emotion and style are known
  useEffect(() => {
    if (!answers.emotion || !answers.style) return;
    const p = photo(`${answers.emotion}-${answers.style}`), img = new Image();
    img.sizes = RESULT_SIZES; img.srcset = p.srcSet; img.src = p.src;
  }, [answers.emotion, answers.style]);

  // a saved card belongs to one bouquet and one dedication
  useEffect(() => { setCard(null); setCopyState(null); }, [proposal?.key, context, dedication]);
  useEffect(() => () => { if (card?.url) URL.revokeObjectURL(card.url); }, [card]);

  // move focus to the new question / result (and bring it into view)
  useEffect(() => {
    if (!moved.current) return;
    const el = focusRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const top = sectionRef.current.querySelector('.finder-top');
    const y = top.getBoundingClientRect().top;
    // from far away (an occasion further down) it jumps, like the menu; close by it glides
    const far = Math.abs(y) > window.innerHeight * 1.2;
    if (y < 60 || y > window.innerHeight * 0.5) top.scrollIntoView({ block: 'start', behavior: far || prefersReduced() ? 'auto' : 'smooth' });
  }, [step, jump]);

  // occasions and the seasonal collection open the finder with answers preselected
  useEffect(() => {
    const onOpen = (ev) => {
      const id = ev.detail?.context;
      const c = CONTEXTS[id];
      if (!c) return;
      const next = { ...EMPTY, ...c.preset };
      setContext(id);
      setAnswers(next);
      setEditing(false);
      setDedicationEdited(false); // a new bouquet for a new occasion
      const missing = STEPS.findIndex((s) => !next[s.key]);
      moved.current = true;
      setLocation('#tu-ramo');
      setStep(missing === -1 ? 3 : missing); // the step effect scrolls the progress bar into view
      setJump((j) => j + 1);
    };
    window.addEventListener('aerflora:finder', onOpen);
    return () => window.removeEventListener('aerflora:finder', onOpen);
  }, []);

  const go = (s) => { moved.current = true; setStep(s); };
  const choose = (key, id) => setAnswers((a) => ({ ...a, [key]: id }));
  const next = () => go(step === 2 || (editing && complete) ? 3 : step + 1);
  const back = () => go(Math.max(0, step - 1));
  // changing one answer keeps the others and the dedication; starting again is a clean slate
  const change = (i) => { setEditing(true); go(i); };
  const restart = () => { setAnswers(EMPTY); setContext(null); setEditing(false); setDedicationEdited(false); go(0); };

  const text = proposal ? summary(proposal, dedication) : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('ok');
    } catch {
      // clipboard blocked: show the text selected so it can be copied by hand
      setCopyState('manual');
      requestAnimationFrame(() => manualRef.current?.select());
    }
  };
  const save = async () => {
    setCard({ state: 'working' });
    try {
      const blob = await renderBoardingCard({ proposal, dedication, photoSrc: photo(photoKey(proposal)).src });
      const filename = cardFilename(proposal);
      download(blob, filename);
      setCard({ state: 'ok', url: URL.createObjectURL(blob), filename });
    } catch {
      setCard({ state: 'error' });
    }
  };

  const current = STEPS[step];
  const nextLabel = step === 2 || (editing && complete) ? 'Ver mi ramo' : 'Siguiente';
  const picks = STEPS.map((s) => labelOf(s.key, answers[s.key])).filter(Boolean);
  const ctx = context ? CONTEXTS[context] : null;

  return (
    <section className="section finder" id="tu-ramo" ref={sectionRef} aria-labelledby="finder-title">
      <header className="section-head">
        <p className="eyebrow">Atelier Aerflora</p>
        <h2 className="section-title" id="finder-title">Haz florecer lo que sientes</h2>
        <p className="section-intro">Tres preguntas, menos de un minuto. Te proponemos un ramo pensado para lo que quieres decir.</p>
      </header>

      <div className="finder-top">
        {ctx && (
          <p className="finder-occasion">
            {contextPrefix(ctx)}: <strong>{ctx.label}</strong>
            <button type="button" className="link-btn" onClick={() => setContext(null)}>Quitar</button>
          </p>
        )}
        <ol className="stepper" aria-label="Progreso">
          {[...STEPS, { key: 'result', label: 'Tu ramo' }].map((s, i) => {
            const reachable = i === 3 ? complete : i <= (firstMissing === -1 ? 3 : firstMissing);
            const value = s.options?.find((o) => o.id === answers[s.key])?.label;
            return (
              <li key={s.key} className={`${i === step ? 'is-current' : ''} ${i < 3 && answers[s.key] ? 'is-done' : ''}`}>
                <button type="button" disabled={!reachable} aria-current={i === step ? 'step' : undefined} onClick={() => (i === 3 ? go(3) : change(i))}>
                  <span className="stepper-num" aria-hidden="true">{i < 3 ? i + 1 : '✿'}</span>
                  <span className="stepper-text"><span>{s.label}</span>{value && <small>{value}</small>}</span>
                </button>
              </li>
            );
          })}
        </ol>
        {/* phones hide the answers inside the progress bar: a compact line keeps them in sight */}
        {picks.length > 0 && step < 3 && (
          <p className="finder-picks"><span>Tu ramo</span>{picks.join(' · ')}</p>
        )}
      </div>

      {step < 3 ? (
        <fieldset className="finder-step" key={current.key}>
          <legend ref={focusRef} tabIndex={-1}>
            <span className="finder-count">Paso {step + 1} de 3</span>
            {current.question}
          </legend>
          <div className={`options options-${current.options.length}`}>
            {current.options.map((o) => (
              <label key={o.id} className={`option${answers[current.key] === o.id ? ' is-selected' : ''}`}>
                <input type="radio" name={`finder-${current.key}`} value={o.id} checked={answers[current.key] === o.id} onChange={() => choose(current.key, o.id)} />
                <span className="option-art"><OptionArt stepKey={current.key} option={o} answers={answers} /></span>
                <span className="option-label">{o.label}</span>
                <span className="option-hint">{o.hint}</span>
              </label>
            ))}
          </div>
          <div className="finder-nav">
            <button type="button" className="btn btn-outline" onClick={back} disabled={step === 0}>Volver</button>
            <button type="button" className="btn btn-primary" onClick={next} disabled={!answers[current.key]}>{nextLabel}</button>
          </div>
        </fieldset>
      ) : proposal && (
        <div className="result" key={proposal.key}>
          <ResultPhoto proposal={proposal} key={photoKey(proposal)} />
          <div className="result-copy">
            <p className="eyebrow">Tu ramo Aerflora{ctx ? ` · ${ctx.label}` : ''}</p>
            <h3 className="result-name" ref={focusRef} tabIndex={-1}>{proposal.name}</h3>
            <p className="result-desc">{proposal.description}</p>

            <ul className="result-choices">
              {STEPS.map((s, i) => (
                <li key={s.key}>
                  <span>{s.label}</span>
                  <strong>{labelOf(s.key, answers[s.key])}</strong>
                  <button type="button" className="link-btn" onClick={() => change(i)} aria-label={`Cambiar ${s.label.toLowerCase()}`}>Cambiar</button>
                </li>
              ))}
            </ul>

            <div className="result-grid">
              <div>
                <h4>Flores sugeridas</h4>
                <ul className="flower-list">{proposal.flowers.map((f) => <li key={f}>{FLOWERS[f]}</li>)}</ul>
                <p className="result-size">{proposal.size.format[0].toUpperCase() + proposal.size.format.slice(1)} · {proposal.size.hint.toLowerCase()}</p>
              </div>
              <div>
                <h4>Paleta</h4>
                <ul className="palette">{proposal.palette.map((c) => <li key={c.name}><span className="swatch" style={{ background: c.hex }} />{c.name}</li>)}</ul>
              </div>
            </div>

            <label className="dedication">
              <span>Tu dedicatoria</span>
              <textarea rows={2} maxLength={160} value={dedication} onChange={(e) => { setDedication(e.target.value); setDedicationEdited(true); }} />
              <small>{dedication.length}/160</small>
            </label>

            <div className="result-actions">
              <button type="button" className="btn btn-primary" onClick={save} disabled={card?.state === 'working'} aria-describedby="card-hint">
                {card?.state === 'working' ? 'Preparando tu tarjeta…' : 'Guardar mi ramo'}
              </button>
              <button type="button" className="btn btn-outline" onClick={copy}>Copiar mi propuesta</button>
              <button type="button" className="btn btn-text" onClick={restart}>Volver a crear</button>
            </div>
            <p className="result-hint" id="card-hint">Te llevas tu ramo y tu dedicatoria en una tarjeta de embarque floral (PNG).</p>

            <div className="result-status" role="status">
              {copyState === 'ok' && <p className="confirm"><span aria-hidden="true">✓</span> Propuesta copiada. Ya puedes pegarla donde quieras.</p>}
              {card?.state === 'ok' && (
                <div className="confirm confirm-card">
                  <img src={card.url} alt={`Tarjeta de embarque floral del ramo ${proposal.name}`} width="108" height="172" />
                  <p><span aria-hidden="true">✓</span> Tarjeta guardada como <strong>{card.filename}</strong>. <a href={card.url} download={card.filename}>Descargarla de nuevo</a></p>
                </div>
              )}
              {card?.state === 'error' && <p className="confirm confirm-error">No hemos podido preparar la tarjeta en este navegador. Prueba de nuevo o copia tu propuesta.</p>}
            </div>
            {copyState === 'manual' && (
              <div className="manual-copy">
                <p>Tu navegador no nos deja copiar directamente: el texto está seleccionado, cópialo con Ctrl+C o mantén pulsado.</p>
                <textarea ref={manualRef} readOnly rows={6} value={text} aria-label="Resumen de tu propuesta" />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
