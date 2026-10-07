// The florist's content: collections, occasions, about and contact.
const IMG = `${import.meta.env.BASE_URL}images/`;
const MAIL = 'hola@aerflora.example';
const mailto = (subject) => `mailto:${MAIL}?subject=${encodeURIComponent(subject)}`;

const COLLECTIONS = [
  {
    img: 'ramos-temporada', name: 'Colección Cielo Abierto', title: 'Ramos de temporada',
    text: 'Rosas de jardín, orquídeas y verdes frescos que cambian con cada estación. Cada ramo se compone a mano el mismo día en que sale de nuestro taller.',
    tag: 'Cambia cada estación',
  },
  {
    img: 'flores-preservadas', name: 'Colección Nube Eterna', title: 'Flores preservadas',
    text: 'Flores naturales tratadas para conservar su color y su forma durante meses, sin agua ni cuidados. Un recuerdo que se queda contigo.',
    tag: 'Duran meses',
  },
  {
    img: 'composiciones-especiales', name: 'Colección Puerta del Cielo', title: 'Composiciones especiales',
    text: 'Arcos florales, centros de mesa y piezas a medida para espacios y momentos únicos. Las diseñamos contigo, de la primera idea al último pétalo.',
    tag: 'Diseño a medida',
  },
];

const OCCASIONS = [
  { img: 'cumpleanos', title: 'Cumpleaños', text: 'Color y alegría para soplar las velas: ramos vivos que se recuerdan mucho después de la fiesta.' },
  { img: 'aniversarios', title: 'Aniversarios', text: 'Rosas, recuerdos compartidos y una nota escrita a mano para celebrar el camino recorrido.' },
  { img: 'bodas', title: 'Bodas', text: 'Ramos de novia, arcos y centros que acompañan el sí quiero de principio a fin.' },
  { img: 'detalles', title: 'Pequeños detalles', text: 'Un gesto sin motivo: una flor, unas palabras y una sonrisa inesperada.' },
];

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
    <div className="shop">
      <section className="section" id="flores">
        <SectionHead
          eyebrow="Ramos y flores"
          title="Nuestras colecciones"
          intro="Tres maneras de regalar flores: frescas y de temporada, preservadas para que duren, o diseñadas a medida para un momento único."
        />
        <div className="cards cards-3">
          {COLLECTIONS.map((c) => (
            <article className="card" key={c.title}>
              <div className="card-media"><img src={`${IMG}${c.img}.webp`} alt="" loading="lazy" width="900" height="1125" /></div>
              <div className="card-body">
                <p className="card-kicker">{c.name}</p>
                <h3 className="card-title">{c.title}</h3>
                <p className="card-text">{c.text}</p>
                <div className="card-foot">
                  <span className="card-tag">{c.tag}</span>
                  <a className="card-link" href={mailto(`Consulta: ${c.title}`)}>Consultar <span aria-hidden="true">→</span></a>
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
          intro="Grandes celebraciones o gestos pequeños: preparamos cada ramo pensando en la persona que lo va a recibir."
        />
        <div className="cards cards-4">
          {OCCASIONS.map((o) => (
            <article className="card card-occasion" key={o.title}>
              <div className="card-media"><img src={`${IMG}${o.img}.webp`} alt="" loading="lazy" width="900" height="1125" /></div>
              <div className="card-body">
                <h3 className="card-title">{o.title}</h3>
                <p className="card-text">{o.text}</p>
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
            Cuéntanos qué quieres celebrar y prepararemos un ramo a tu medida. Escríbenos para encargar
            un ramo o para consultar cualquier idea, por pequeña que sea.
          </p>
          <div className="contact-actions">
            <a className="btn btn-primary" href={mailto('Encargo de ramo')}>Encargar un ramo</a>
            <a className="btn btn-outline" href={mailto('Consulta de una idea')}>Consultar una idea</a>
          </div>
          <p className="contact-mail">o escríbenos a <a href={`mailto:${MAIL}`}>{MAIL}</a></p>
        </div>
      </section>
    </div>
  );
}
