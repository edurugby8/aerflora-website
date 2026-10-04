# aerflora-website

Web floral inmersiva con animaciones controladas por scroll, ambientada en un avion lleno de flores.

> **Estado:** el motor de scroll, la tipografía, los textos y el despliegue están listos. La secuencia de imágenes es **provisional** (generada por código). Para alcanzar la calidad fotográfica de la referencia hace falta el vídeo final: ver [ASSETS.md](ASSETS.md).

## Cómo funciona

- **Escena principal:** una secuencia de fotogramas WebP dibujada en `<canvas>`. El scroll elige el fotograma directamente (GSAP ScrollTrigger con `scrub: true`), así que avanza, retrocede y se detiene exactamente cuando lo hace el scroll. La escena se mantiene fija (`position: sticky`) durante todo el recorrido.
- **Textos sincronizados:** el titular, el contador de fila y «Welcome aboard.» se colocan en la línea de tiempo según los marcadores de `public/frames/manifest.json` (`arrive`, `doorOpenStart`, `doorOpenEnd`).
- **Carga progresiva:** los fotogramas se piden de grueso a fino (cada 16, 8, 4, 2, 1). La web se abre cuando están los esenciales (cada 8.º), con un indicador de progreso real; el resto sigue cargando y mientras tanto se dibuja el fotograma cargado más cercano, sin pantallas negras.
- **Encuadre adaptable:** ajuste tipo *cover* alrededor del punto de fuga del pasillo; en pantallas verticales se usa un conjunto 9:16 propio. Cada dispositivo descarga solo el conjunto de resolución que necesita.
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
npm run frames:placeholder                        # regenera la provisional
```

## Publicación

`.github/workflows/deploy.yml` compila y publica en GitHub Pages en cada push a `main`, bajo `/aerflora-website/`. Hay que activar una vez **Settings → Pages → Source: GitHub Actions**.
