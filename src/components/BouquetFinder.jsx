// "Haz florecer lo que sientes": three quick choices reveal a bouquet.
import { useEffect, useMemo, useRef, useState } from 'react';
import BouquetArt, { Bloom } from './BouquetArt.jsx';
import { EMOTIONS, STYLES, SIZES, OCCASIONS, FLOWERS, compose, artFor, dedicationFor, summary } from '../lib/bouquets.js';
import { hasRealContact, mailto } from '../lib/contact.js';

const STEPS = [
  { key: 'emotion', label: 'Emoción', question: '¿Qué quieres expresar?', options: EMOTIONS },
  { key: 'style', label: 'Estilo', question: '¿Qué estilo imaginas?', options: STYLES },
  { key: 'size', label: 'Tamaño', question: '¿Qué tamaño prefieres?', options: SIZES },
];
const EMPTY = { emotion: null, style: null, size: null };
const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// small illustrations for the option cards
const STYLE_ART = {
  silvestre: { seed: 5, arrangement: 'wild', count: 6, wrap: 'twine', flowers: ['margarita', 'cosmos'], fillers: ['espigas', 'paniculata'], colors: ['#f6e7cf', '#e8c4c2', '#c9afe0'] },
  romantico: { seed: 6, arrangement: 'dome', count: 8, wrap: 'tissue', flowers: ['rosa', 'peonia', 'ranunculo'], fillers: ['eucalipto'], colors: ['#f4c9d2', '#e8c4c2', '#f6e7cf'] },
  minimalista: { seed: 7, arrangement: 'line', count: 3, wrap: 'vase', flowers: ['cala', 'anemona'], fillers: ['olivo'], colors: ['#efe9dd', '#ffffff', '#e8c4c2'] },
};
const SIZE_ART = {
  detalle: { seed: 9, arrangement: 'dome', count: 3, wrap: 'kraft', flowers: ['ranunculo', 'rosa'], fillers: ['eucalipto'], colors: ['#f4c9d2', '#f6e7cf'], scale: 0.62 },
  abrazo: { seed: 10, arrangement: 'dome', count: 8, wrap: 'kraft', flowers: ['ranunculo', 'rosa', 'peonia'], fillers: ['eucalipto'], colors: ['#f4c9d2', '#f6e7cf', '#e58fa6'], scale: 0.9 },
  celebracion: { seed: 12, arrangement: 'dome', count: 16, wrap: 'kraft', flowers: ['ranunculo', 'rosa', 'peonia'], fillers: ['eucalipto', 'paniculata'], colors: ['#f4c9d2', '#f6e7cf', '#e58fa6', '#ffffff'], scale: 1.18 },
};

function EmotionArt({ e }) {
  return (
    <svg viewBox="-60 -50 120 100" className="option-svg" aria-hidden="true">
      <g transform="translate(-24 6)"><Bloom type={e.flowers[0]} r={24} c={e.palette[1][1]} /></g>
      <g transform="translate(24 10)"><Bloom type={e.flowers[0]} r={20} c={e.palette[2][1]} /></g>
      <g transform="translate(0 -12)"><Bloom type={e.flowers[0]} r={28} c={e.palette[0][1]} /></g>
    </svg>
  );
}

function OptionArt({ stepKey, option }) {
  if (stepKey === 'emotion') return <EmotionArt e={option} />;
  const recipe = stepKey === 'style' ? STYLE_ART[option.id] : SIZE_ART[option.id];
  return <BouquetArt recipe={recipe} className="option-svg" title="" />;
}

export default function BouquetFinder() {
  const [answers, setAnswers] = useState(EMPTY);
  const [step, setStep] = useState(0); // 0–2 questions, 3 = the bouquet
  const [editing, setEditing] = useState(false); // came back from the result to change one answer
  const [occasion, setOccasion] = useState(null);
  const [dedication, setDedication] = useState('');
  const [dedicationEdited, setDedicationEdited] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [copyState, setCopyState] = useState(null);
  const sectionRef = useRef(null);
  const focusRef = useRef(null);
  const summaryRef = useRef(null);
  const moved = useRef(false);
  const [jump, setJump] = useState(0); // occasions re-scroll even when the step stays the same

  const complete = STEPS.every((s) => answers[s.key]);
  const firstMissing = STEPS.findIndex((s) => !answers[s.key]);
  const proposal = useMemo(() => (complete ? compose(answers, occasion) : null), [answers, occasion, complete]);
  const art = useMemo(() => (proposal ? artFor(proposal) : null), [proposal]);

  // the suggested dedication follows the emotion until the visitor writes their own
  useEffect(() => {
    if (!dedicationEdited) setDedication(dedicationFor(answers.emotion));
  }, [answers.emotion, dedicationEdited]);

  // move focus to the new question / result (and bring it into view)
  useEffect(() => {
    if (!moved.current) return;
    const el = focusRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const top = sectionRef.current.querySelector('.finder-top');
    const y = top.getBoundingClientRect().top;
    if (y < 60 || y > window.innerHeight * 0.5) top.scrollIntoView({ block: 'start', behavior: prefersReduced() ? 'auto' : 'smooth' });
  }, [step, jump]);

  // occasions elsewhere on the page open the finder with answers preselected
  useEffect(() => {
    const onOpen = (ev) => {
      const id = ev.detail?.occasion;
      const o = OCCASIONS[id];
      if (!o) return;
      const next = { ...EMPTY, ...o.preset };
      setOccasion(id);
      setAnswers(next);
      setDedicationEdited(false);
      setShowSummary(false); setCopyState(null); setEditing(false);
      const missing = STEPS.findIndex((s) => !next[s.key]);
      moved.current = true;
      setStep(missing === -1 ? 3 : missing); // the step effect scrolls the progress bar into view
      setJump((j) => j + 1);
    };
    window.addEventListener('aerflora:finder', onOpen);
    return () => window.removeEventListener('aerflora:finder', onOpen);
  }, []);

  const go = (s) => { moved.current = true; setStep(s); setShowSummary(false); setCopyState(null); };
  const choose = (key, id) => setAnswers((a) => ({ ...a, [key]: id }));
  const next = () => go(step === 2 || (editing && complete) ? 3 : step + 1);
  const back = () => go(Math.max(0, step - 1));
  const change = (i) => { setEditing(true); go(i); };
  const restart = () => {
    setAnswers(EMPTY); setOccasion(null); setDedicationEdited(false); setEditing(false);
    go(0);
  };

  const text = proposal ? summary(proposal, dedication) : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('ok');
    } catch {
      // clipboard blocked: select the text so it can be copied by hand
      summaryRef.current?.select();
      setCopyState('manual');
    }
  };

  const current = STEPS[step];
  const nextLabel = step === 2 || (editing && complete) ? 'Ver mi ramo' : 'Siguiente';

  return (
    <section className="section finder" id="tu-ramo" ref={sectionRef} aria-labelledby="finder-title">
      <header className="section-head">
        <p className="eyebrow">Atelier Aerflora</p>
        <h2 className="section-title" id="finder-title">Haz florecer lo que sientes</h2>
        <p className="section-intro">Tres preguntas, menos de un minuto. Te proponemos un ramo pensado para lo que quieres decir.</p>
      </header>

      <div className="finder-top">
      {occasion && (
        <p className="finder-occasion">
          Para: <strong>{OCCASIONS[occasion].label}</strong>
          <button type="button" className="link-btn" onClick={() => setOccasion(null)}>Quitar</button>
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
                <span className="option-art"><OptionArt stepKey={current.key} option={o} /></span>
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
          <div className="result-art">
            <BouquetArt recipe={art} animate title={`Ilustración del ramo ${proposal.name}`} />
          </div>
          <div className="result-copy">
            <p className="eyebrow">Tu ramo Aerflora{proposal.occasion ? ` · ${proposal.occasion}` : ''}</p>
            <h3 className="result-name" ref={focusRef} tabIndex={-1}>{proposal.name}</h3>
            <p className="result-desc">{proposal.description}</p>

            <ul className="result-choices">
              {STEPS.map((s, i) => (
                <li key={s.key}>
                  <span>{s.label}</span>
                  <strong>{s.options.find((o) => o.id === answers[s.key]).label}</strong>
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
              <small aria-live="polite">{dedication.length}/160</small>
            </label>

            <div className="result-actions">
              {hasRealContact
                ? <a className="btn btn-primary" href={mailto(`Consulta: ramo «${proposal.name}»`, text)}>Consultar este ramo</a>
                : <button type="button" className="btn btn-primary" aria-expanded={showSummary} aria-controls="finder-summary" onClick={() => { setShowSummary((v) => !v); setCopyState(null); }}>Consultar este ramo</button>}
              <button type="button" className="btn btn-outline" onClick={restart}>Volver a crear</button>
            </div>

            {(showSummary || hasRealContact) && (
              <div className="summary" id="finder-summary">
                {!hasRealContact && (
                  <p className="summary-note">Aún no hemos publicado nuestro correo de encargos. Copia tu propuesta y envíanosla cuando quieras: la tendremos lista para preparar tu ramo.</p>
                )}
                <textarea ref={summaryRef} className="summary-text" readOnly rows={6} value={text} aria-label="Resumen de tu propuesta" />
                <button type="button" className="btn btn-small btn-outline" onClick={copy}>Copiar mi propuesta</button>
                <p className="summary-status" role="status">
                  {copyState === 'ok' && 'Propuesta copiada. Ya puedes pegarla donde quieras.'}
                  {copyState === 'manual' && 'No hemos podido copiarla automáticamente: el texto está seleccionado, cópialo con Ctrl+C o mantén pulsado.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
