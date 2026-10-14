# aerflora-website

Web de **Aerflora, floristería**: ramos de temporada, flores preservadas y composiciones especiales, presentados con un recorrido por scroll por un avión lleno de flores que viaja entre nubes.

Aerflora es una floristería imaginaria: una **demo de portfolio creada por Codecraft**. No hay pedidos, pagos, cuentas ni servidor; el recorrido completo es entrar, explorar, crear un ramo y guardarlo como tarjeta.

## Apartados

- **Inicio**: el recorrido por la cabina con «Siempre hay una razón para florecer.», la invitación «Hay cosas que se dicen mejor con flores.» y el botón «Encuentra tu ramo».
- **Encuentra tu ramo** (`#tu-ramo`): atelier en tres pasos (emoción, estilo, tamaño) que compone una propuesta con nombre, descripción, flores, paleta, imagen del ramo y dedicatoria editable, y la guarda como tarjeta de embarque floral (PNG). Cada elección se puede cambiar desde el resultado sin perder las demás ni la dedicatoria escrita. Reglas locales en `src/lib/bouquets.js`; sin servidor.
- **Ramos y flores** (`#flores`): colecciones Cielo Abierto (temporada, abre el atelier con el estilo silvestre ya elegido), Nube Eterna (preservadas) y Puerta del Cielo (composiciones especiales). Estas dos no son ramos que el atelier pueda componer, así que su tarjeta despliega una breve presentación de la colección.
- **Flores para cada ocasión** (`#ocasiones`): cumpleaños, aniversarios, bodas y pequeños detalles abren el atelier con la ocasión preseleccionada (emoción y, en bodas y pequeños detalles, tamaño); la ocasión acompaña al resultado y a la tarjeta.
- **Sobre Aerflora** (`#nosotros`) y **Llévate tu ramo** (`#llevate-tu-ramo`): el cierre de la demo invita a crear y guardar la propuesta, con la nota «Experiencia de demostración. No se realizan pedidos reales». No está en el menú, porque «Encuentra tu ramo» ya lleva al atelier. El pie dice «Demo creada por Codecraft».

**Imágenes de los ramos:** son recreaciones 3D, no fotografías, y la web lo indica junto al resultado. `scripts/render-bouquets.mjs` (`npm run photos`) las renderiza con un trazador de rayos (three-gpu-pathtracer) en un estudio virtual: fondo continuo de papel, softbox, contraluz, cartón de relleno y cámara física con desenfoque real. Las flores (`scripts/scene3d/botany.js`) se modelan pétalo a pétalo a escala real y el ramo se monta con las mismas reglas que la web (`compose()` en `src/lib/bouquets.js`):

- 15 imágenes de resultado, una por emoción × estilo, renderizadas en tamaño «Un abrazo». Como no hay una imagen por tamaño, el pie del resultado es neutral («Recreación 3D orientativa del estilo y la paleta») y el tamaño elegido se cuenta con texto y una escala.
- 7 imágenes para las colecciones y las ocasiones.
- Cada imagen en 960×1200 y en 480×600 (`-sm`), en `public/images/ramos/`.

Las imágenes de «Sobre Aerflora» y «Llévate tu ramo» salen de la escena 3D de la cabina (`npm run images`).

**Tarjeta de embarque floral:** «Guardar mi ramo» dibuja en un `<canvas>` una tarjeta de 1080×1720 con la marca, el nombre y la imagen del ramo, emoción, estilo y tamaño, la paleta, la dedicatoria y «Hay cosas que se dicen mejor con flores», y la descarga como PNG (`src/lib/boardingCard.js`, sin dependencias). Solo usa recursos del propio sitio: si las fuentes no han cargado en 2,5 s dibuja con fuentes del sistema, y si la imagen falla, con un degradado de la paleta. Los textos se miden y ajustan para que nada se corte. «Copiar mi propuesta» copia el mismo resumen en texto; ambas acciones confirman el resultado de forma accesible.

> **Estado:** versión de cierre de la demo. La secuencia de la cabina es un render 3D hecho con Three.js y materiales procedurales, no fotografía; [ASSETS.md](ASSETS.md) explica cómo sustituirla por vídeo real.

## Cómo funciona

- **Escena principal:** una secuencia de fotogramas WebP dibujada en `<canvas>`. El scroll elige el fotograma directamente (GSAP ScrollTrigger con `scrub: true`), así que avanza, retrocede y se detiene exactamente cuando lo hace el scroll. La escena se mantiene fija (`position: sticky`) durante todo el recorrido.
- **Textos sincronizados:** el titular y «Bienvenidos a bordo.» se colocan en la línea de tiempo según los marcadores de `public/frames/manifest.json` (`arrive`, `doorOpenStart`, `doorOpenEnd`).
- **Carga progresiva:** la portada se puede usar en cuanto está el primer fotograma (como mucho a los 2,5 s; mientras tanto se ve el póster). El resto se pide de grueso a fino (cada 16, 8, 4, 2, 1) y, mientras llega, se dibuja el fotograma cargado más cercano, sin pantallas negras. Las imágenes de la tienda cargan de forma diferida y con sus dimensiones reservadas.
- **Navegación:** el menú lleva directamente a cada sección, justo bajo la cabecera: si está lejos salta sin recorrer la animación, y si está cerca se desliza. La dirección se actualiza (`#flores`, `#tu-ramo`…) y el enlace de la sección visible queda marcado. Al desplazarse a mano, el viaje se conserva intacto.
- **Encuadre adaptable:** ajuste tipo *cover* alrededor del punto de fuga del pasillo; en pantallas verticales se usa un conjunto 9:16 propio. Cada dispositivo descarga solo el conjunto de resolución que necesita.
- **Escena 3D:** `scripts/scene3d/` modela la cabina (asientos 3+3, ventanillas con hueco, compartimentos, puerta con marco profundo) y las instalaciones florales; `scripts/render-3d-frames.mjs` la renderiza en Edge/Chrome sin interfaz. Es determinista: el mismo fotograma siempre produce la misma imagen.
- **Accesibilidad:** con `prefers-reduced-motion` o si la secuencia no carga, se muestra una versión estática (dos imágenes fijas + contenido) y no hay animaciones de aparición. Foco visible en toda la página, menú móvil que se cierra con Escape y no deja enlaces ocultos enfocables, botones de al menos 44 px y confirmaciones anunciadas a lectores de pantalla.
- **Compartir:** título, descripción, favicon (`public/favicon.svg`), icono para la pantalla de inicio y vista previa de 1200×630 (`public/og-image.jpg`). `npm run share` regenera las dos imágenes a partir de las del propio sitio.

## Desarrollo

```bash
npm install
npm run dev          # http://localhost:5173/aerflora-website/
npm run build
npm run preview      # http://localhost:4173/aerflora-website/
```

Secuencia de fotogramas:

```bash
npm run frames:extract -- footage/aerflora.mp4   # secuencia real (ver ASSETS.md)
npm run frames:3d                                 # renderiza la escena 3D de la cabina (scripts/scene3d, necesita Edge o Chrome)
npm run frames:placeholder                        # secuencia 2D anterior, solo como respaldo
```

Imágenes de los ramos (necesita Edge o Chrome con GPU; unos minutos por imagen, mejor con el equipo sin suspenderse):

```bash
npm run photos -- --samples=512                   # las 22 imágenes, como las publicadas
npm run photos -- --only=amor-romantico,bodas     # solo algunas
npm run photos -- --samples=64 --size=640x800     # borrador rápido
npm run photos -- --from=gratitud-silvestre       # retomar una tanda larga
```

Cada imagen se guarda también a mitad de camino (cada 64 muestras): si el navegador se cae al final de un render largo, se conserva la última copia si ya tiene al menos 3/4 de las muestras.

Vista previa al compartir e icono de la pantalla de inicio (necesita Edge o Chrome):

```bash
npm run share                                     # public/og-image.jpg y public/apple-touch-icon.png
```

## Publicación

`.github/workflows/deploy.yml` compila y publica en GitHub Pages en cada push a `main`, bajo `/aerflora-website/`. Hay que activar una vez **Settings → Pages → Source: GitHub Actions**.
