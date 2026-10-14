// The florist's content: collections, occasions, about and the closing call.
import { useState } from 'react';
import { photo } from '../lib/bouquets.js';

const IMG = `${import.meta.env.BASE_URL}images/`;

// Seasonal bouquets can be made in the atelier; preserved flowers and bespoke
// pieces are not bouquets it could draw, so their cards open a short
// presentation of the collection instead.
const COLLECTIONS = [
  {
    art: 'temporada', name: 'Colección Cielo Abierto', title: 'Ramos de temporada',
    text: 'Peonías, ranúnculos y verdes frescos que cambian con cada estación. Cada ramo se compone a mano el mismo día en que sale de nuestro taller.',
    tag: 'Cambia cada estación', alt: 'Ramo de temporada en papel kraft con peonías, ranúnculos, margaritas, tulipanes y espigas',
    create: true,
  },
  {
    art: 'preservadas', name: 'Colección Nube Eterna', title: 'Flores preservadas',
    text: 'Rosas y espigas tratadas para conservar su color y su forma durante meses, sin agua ni cuidados. Un recuerdo que se queda contigo.',
    tag: 'Duran meses', alt: 'Rosas preservadas en tonos empolvados bajo una campana de cristal',
    details: [
      ['Qué incluye', 'Rosas, ranúnculos, lavanda y espigas en tonos empolvados.'],
      ['Formatos', 'Campana de cristal, ramillete seco o caja regalo.'],
      ['Cuidados', 'Lejos del agua y del sol directo; se mantienen como el primer día.'],
    ],
  },
  {
    art: 'composiciones', name: 'Colección Puerta del Cielo', title: 'Composiciones especiales',
    text: 'Centros de mesa, arcos y piezas a medida para espacios y momentos únicos. Las diseñamos contigo, de la primera idea al último pétalo.',
    tag: 'Diseño a medida', alt: 'Centro de mesa bajo de rosas, peonías y anémonas con dos velas encendidas',
    details: [
      ['Qué incluye', 'Centros de mesa, arcos florales e instalaciones para celebraciones.'],
      ['Cómo trabajamos', 'Boceto, prueba de color y montaje en el lugar.'],
      ['Paleta', 'Blancos, rosas empolvados y verdes suaves, o los colores de tu fiesta.'],
    ],
  },
];

const OCCASIONS = [
  { id: 'cumpleanos', title: 'Cumpleaños', text: 'Color y alegría para soplar las velas: ramos vivos que se recuerdan mucho después de la fiesta.', alt: 'Gerberas, tulipanes y cosmos de colores en un tarro de cristal, con confeti sobre la mesa' },
  { id: 'aniversarios', title: 'Aniversarios', text: 'Rosas, recuerdos compartidos y una nota escrita a mano para celebrar el camino recorrido.', alt: 'Ramo de rosas rojas y peonías rosas envuelto en papel de seda' },
  { id: 'bodas', title: 'Bodas', text: 'Ramos de novia, centros y detalles que acompañan el sí quiero de principio a fin.', alt: 'Ramo de novia blanco con peonías, rosas, anémonas y calas, atado con cinta de raso' },
  { id: 'detalles', title: 'Pequeños detalles', text: 'Un gesto sin motivo: una flor, unas palabras y una sonrisa inesperada.', alt: 'Un tulipán rosa y una anémona blanca en un pequeño búcaro de cristal' },
];

const openFinder = (context) => window.dispatchEvent(new CustomEvent('aerflora:finder', { detail: { context } }));

function CardPhoto({ k, alt, sizes }) {
  const p = photo(k);
  return <img src={p.src} srcSet={p.srcSet} sizes={sizes} alt={alt} loading="lazy" decoding="async" width="480" height="600" />;
}

function SectionHead({ eyebrow, title, intro }) {
  return (
    <header className="section-head">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="section-title">{title}</h2>
      {intro && <p className="section-intro">{intro}</p>}
    </header>
  );
}

function Collection({ c }) {
  const [open, setOpen] = useState(false);
  const panel = `coleccion-${c.art}`;
  return (
    <article className={`card${open ? ' is-open' : ''}`}>
      <div className="card-media"><CardPhoto k={c.art} alt={c.alt} sizes="(max-width: 760px) 92vw, (max-width: 1080px) 46vw, 380px" /></div>
      <div className="card-body">
        <p className="card-kicker">{c.name}</p>
        <h3 className="card-title">{c.title}</h3>
        <p className="card-text">{c.text}</p>
        {c.details && (
          <dl className="card-details" id={panel} hidden={!open}>
            {c.details.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        )}
        <div className="card-foot">
          <span className="card-tag">{c.tag}</span>
          {c.create
            ? <button type="button" className="card-cta" onClick={() => openFinder(c.art)}>Crear el mío <span aria-hidden="true">→</span></button>
            : (
              <button type="button" className="card-cta" aria-expanded={open} aria-controls={panel} onClick={() => setOpen((v) => !v)}>
                {open ? 'Ocultar' : 'Ver la colección'} <span aria-hidden="true">{open ? '↑' : '↓'}</span>
              </button>
            )}
        </div>
      </div>
    </article>
  );
}

export default function Shop() {
  return (
    <>
      <section className="section" id="flores">
        <SectionHead
          eyebrow="Ramos y flores"
          title="Nuestras colecciones"
          intro="Tres maneras de regalar flores: frescas y de temporada, preservadas para que duren, o diseñadas a medida para un momento único."
        />
        <div className="cards cards-3">
          {COLLECTIONS.map((c) => <Collection key={c.art} c={c} />)}
        </div>
      </section>

      <section className="section section-tint" id="ocasiones">
        <SectionHead
          eyebrow="Flores para cada ocasión"
          title="Siempre hay un motivo"
          intro="Elige la ocasión y te ayudamos a crear el ramo: empezamos con lo que quieres celebrar ya seleccionado."
        />
        <div className="cards cards-4">
          {OCCASIONS.map((o) => (
            <article className="card card-occasion" key={o.id}>
              <div className="card-media"><CardPhoto k={o.id} alt={o.alt} sizes="(max-width: 760px) 38vw, (max-width: 1080px) 46vw, 280px" /></div>
              <div className="card-body">
                <h3 className="card-title">{o.title}</h3>
                <p className="card-text">{o.text}</p>
                <button type="button" className="card-cta" onClick={() => openFinder(o.id)}>
                  Crear este ramo <span aria-hidden="true">→</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section about" id="nosotros">
        <div className="about-media"><img src={`${IMG}sobre-aerflora.webp`} alt="Un cerezo en flor sobre las nubes, visto a través de una puerta abierta" loading="lazy" decoding="async" width="900" height="1125" /></div>
        <div className="about-copy">
          <p className="eyebrow">Sobre Aerflora</p>
          <h2 className="section-title">Flores que viajan entre nubes</h2>
          <p>
            Creemos que las flores tienen el don de detener el tiempo. Un ramo bien hecho cambia una mañana,
            acompaña una despedida o convierte un martes cualquiera en una pequeña celebración.
          </p>
          <p>
            Elegimos cada tallo a mano y cuidamos el color, el aroma y el equilibrio de cada composición,
            como si fuera la primera. Detrás de cada encargo hay una historia, y queremos que florezca.
          </p>
          <ul className="about-points">
            <li>Flor fresca elegida a mano</li>
            <li>Composición artesanal</li>
            <li>Envoltorio cuidado y sostenible</li>
          </ul>
        </div>
      </section>

      <section className="section contact" id="llevate-tu-ramo" aria-labelledby="llevate-title">
        <img className="contact-bg" src={`${IMG}contacto.webp`} alt="" loading="lazy" decoding="async" width="900" height="1125" />
        <div className="contact-card">
          <p className="eyebrow">Llévate tu ramo</p>
          <h2 className="section-title" id="llevate-title">Listo para embarcar</h2>
          <p className="section-intro">
            Crea tu propuesta floral en menos de un minuto y guárdala como tarjeta de embarque: tus flores,
            tu paleta y tu dedicatoria, listas para regalar o compartir.
          </p>
          <div className="contact-actions">
            <a className="btn btn-primary" href="#tu-ramo">Crear mi ramo</a>
            <a className="btn btn-outline" href="#flores">Ver colecciones</a>
          </div>
          <p className="demo-note">Experiencia de demostración. No se realizan pedidos reales.</p>
        </div>
      </section>
    </>
  );
}
