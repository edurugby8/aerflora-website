# aerflora-website

Web de **Aerflora, floristería**: ramos de temporada, flores preservadas y composiciones especiales, presentados con un recorrido por scroll por un avión lleno de flores que viaja entre nubes.

## Apartados

- **Inicio**: el recorrido por la cabina con «Siempre hay una razón para florecer.», la invitación «Hay cosas que se dicen mejor con flores.» y el botón «Encuentra tu ramo».
- **Encuentra tu ramo** (`#tu-ramo`): atelier en tres pasos (emoción, estilo, tamaño) que compone una propuesta con nombre, descripción, flores, paleta, ilustración SVG y dedicatoria editable. Reglas locales en `src/lib/bouquets.js`; sin servidor.
- **Ramos y flores** (`#flores`): colecciones Cielo Abierto (temporada), Nube Eterna (preservadas) y Puerta del Cielo (composiciones especiales).
- **Flores para cada ocasión** (`#ocasiones`): cumpleaños, aniversarios, bodas y pequeños detalles.
- **Sobre Aerflora** (`#nosotros`) y **Contacto** (`#contacto`, encargos y consultas por correo).

Las tarjetas de colecciones y ocasiones usan ilustraciones botánicas SVG (`src/components/BouquetArt.jsx`); las imágenes de «Sobre Aerflora» y «Contacto» salen de la escena 3D (`npm run images`).

**Contacto:** el correo está en `src/lib/contact.js`. Mientras termine en `.example`, la web no ofrece enlaces de correo: «Consultar este ramo» prepara el resumen y ofrece «Copiar mi propuesta». Al poner un correo real aparecen automáticamente los botones para escribir con la propuesta ya redactada.

> **Estado:** el motor de scroll, la tipografía, los textos y el despliegue están listos. La secuencia de imágenes es **provisional**: un render 3D de la cabina hecho con Three.js y materiales procedurales, no fotografía. Para alcanzar la calidad fotográfica de la referencia hace falta el vídeo final: ver [ASSETS.md](ASSETS.md).

## Cómo funciona

- **Escena principal:** una secuencia de fotogramas WebP dibujada en `<canvas>`. El scroll elige el fotograma directamente (GSAP ScrollTrigger con `scrub: true`), así que avanza, retrocede y se detiene exactamente cuando lo hace el scroll. La escena se mantiene fija (`position: sticky`) durante todo el recorrido.
- **Textos sincronizados:** el titular, el contador de fila y «Welcome aboard.» se colocan en la línea de tiempo según los marcadores de `public/frames/manifest.json` (`arrive`, `doorOpenStart`, `doorOpenEnd`).
- **Carga progresiva:** los fotogramas se piden de grueso a fino (cada 16, 8, 4, 2, 1). La web se abre cuando están los esenciales (cada 8.º), con un indicador de progreso real; el resto sigue cargando y mientras tanto se dibuja el fotograma cargado más cercano, sin pantallas negras.
- **Encuadre adaptable:** ajuste tipo *cover* alrededor del punto de fuga del pasillo; en pantallas verticales se usa un conjunto 9:16 propio. Cada dispositivo descarga solo el conjunto de resolución que necesita.
- **Escena 3D (provisional):** `scripts/scene3d/` modela la cabina (asientos 3+3, ventanillas con hueco, compartimentos, puerta con marco profundo) y las instalaciones florales; `scripts/render-3d-frames.mjs` la renderiza en Edge/Chrome sin interfaz. Es determinista: el mismo fotograma siempre produce la misma imagen.
- **Accesibilidad:** con `prefers-reduced-motion` o si la secuencia no carga, se muestra una versión estática (dos imágenes fijas + contenido).

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
npm run frames:3d                                 # renderiza la escena 3D provisional (scripts/scene3d, necesita Edge o Chrome)
npm run frames:placeholder                        # secuencia 2D anterior, solo como respaldo
```

## Publicación

`.github/workflows/deploy.yml` compila y publica en GitHub Pages en cada push a `main`, bajo `/aerflora-website/`. Hay que activar una vez **Settings → Pages → Source: GitHub Actions**.
