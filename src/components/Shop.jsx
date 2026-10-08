// The florist's content: collections, occasions, about and contact.
import BouquetArt from './BouquetArt.jsx';
import { ART } from '../lib/bouquets.js';
import { CONTACT_EMAIL, hasRealContact, mailto } from '../lib/contact.js';

const IMG = `${import.meta.env.BASE_URL}images/`;

const COLLECTIONS = [
  {
    art: 'temporada', name: 'Colección Cielo Abierto', title: 'Ramos de temporada',
    text: 'Peonías, ranúnculos y verdes frescos que cambian con cada estación. Cada ramo se compone a mano el mismo día en que sale de nuestro taller.',
    tag: 'Cambia cada estación',
  },
  {
    art: 'preservadas', name: 'Colección Nube Eterna', title: 'Flores preservadas',
    text: 'Rosas y espigas tratadas para conservar su color y su forma durante meses, sin agua ni cuidados. Un recuerdo que se queda contigo.',
    tag: 'Duran meses',
  },
  {
    art: 'composiciones', name: 'Colección Puerta del Cielo', title: 'Composiciones especiales',
    text: 'Centros de mesa, arcos y piezas a medida para espacios y momentos únicos. Las diseñamos contigo, de la primera idea al último pétalo.',
    tag: 'Diseño a medida',
  },
];

const OCCASIONS = [
  { id: 'cumpleanos', title: 'Cumpleaños', text: 'Color y alegría para soplar las velas: ramos vivos que se recuerdan mucho después de la fiesta.' },
  { id: 'aniversarios', title: 'Aniversarios', text: 'Rosas, recuerdos compartidos y una nota escrita a mano para celebrar el camino recorrido.' },
  { id: 'bodas', title: 'Bodas', text: 'Ramos de novia, centros y detalles que acompañan el sí quiero de principio a fin.' },
  { id: 'detalles', title: 'Pequeños detalles', text: 'Un gesto sin motivo: una flor, unas palabras y una sonrisa inesperada.' },
];

const openFinder = (occasion) => window.dispatchEvent(new CustomEvent('aerflora:finder', { detail: { occasion } }));

function SectionHead({ eyebrow, title, intro }) {
  return (
    <header className="section-head">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="section-title">{title}</h2>
      {intro && <p className="section-intro">{intro}</p>}
    </header>
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
          {COLLECTIONS.map((c) => (
            <article className="card" key={c.title}>
              <div className={`card-media art-bg art-${c.art}`}><BouquetArt recipe={ART[c.art]} title={`Ilustración: ${c.title.toLowerCase()}`} /></div>
              <div className="card-body">
                <p className="card-kicker">{c.name}</p>
                <h3 className="card-title">{c.title}</h3>
                <p className="card-text">{c.text}</p>
                <div className="card-foot">
                  <span className="card-tag">{c.tag}</span>
                  {hasRealContact
                    ? <a className="card-link" href={mailto(`Consulta: ${c.title}`)}>Consultar <span aria-hidden="true">→</span></a>
                    : <a className="card-link" href="#tu-ramo">Crear el mío <span aria-hidden="true">→</span></a>}
                </div>
              </div>
            </article>
          ))}
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
              <div className={`card-media art-bg art-${o.id}`}><BouquetArt recipe={ART[o.id]} title={`Ilustración: ${o.title.toLowerCase()}`} /></div>
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
        <div className="about-media"><img src={`${IMG}sobre-aerflora.webp`} alt="Un cerezo en flor sobre las nubes, visto a través de una puerta abierta" loading="lazy" width="900" height="1125" /></div>
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

      <section className="section contact" id="contacto" style={{ backgroundImage: `url(${IMG}contacto.webp)` }}>
        <div className="contact-card">
          <p className="eyebrow">Contacto</p>
          <h2 className="section-title">¿Tienes una idea en mente?</h2>
          <p className="section-intro">
            Cuéntanos qué quieres celebrar y prepararemos un ramo a tu medida. Si aún no lo tienes claro,
            empieza por nuestro atelier: en un minuto tendrás una propuesta para compartir.
          </p>
          <div className="contact-actions">
            <a className="btn btn-primary" href="#tu-ramo">Encuentra tu ramo</a>
            {hasRealContact && <a className="btn btn-outline" href={mailto('Consulta de una idea')}>Escríbenos</a>}
          </div>
          {hasRealContact
            ? <p className="contact-mail">o escríbenos a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
            : <p className="contact-mail">Muy pronto publicaremos nuestro correo de encargos. Mientras tanto, crea tu propuesta y cópiala para enviárnosla.</p>}
        </div>
      </section>
    </>
  );
}
