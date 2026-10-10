# Recursos visuales: qué falta y cómo integrarlo

## Estado actual

| Recurso | Estado |
| --- | --- |
| Secuencia principal (pasillo → puerta → árbol sobre nubes) | **Provisional, render 3D.** Escena Three.js (`scripts/scene3d/`) renderizada fotograma a fotograma con `npm run frames:3d`: geometría real, sombras del sol por las ventanillas, iluminación de entorno (IBL), oclusión ambiental, pétalos translúcidos, cielo con nubes volumétricas por *raymarching* (`sky.js`) y profundidad de campo física. Los fotogramas se versionan con un hash de contenido (`manifest.version`, añadido como `?v=` a cada URL) para que el navegador no muestre renders antiguos. Los materiales y las flores son **procedurales**, así que el resultado es CG: **no** alcanza el acabado fotográfico de la referencia. |
| Secuencia 2D anterior | `npm run frames:placeholder` (ilustración), solo como respaldo. |
| Imágenes de los ramos (atelier, colecciones, ocasiones) | **Recreaciones 3D**, renderizadas con trazado de rayos (`npm run photos`): flores modeladas pétalo a pétalo, vidrio y agua con refracción, papel, luz de estudio y desenfoque de lente reales. Son CG y la web lo dice junto a cada resultado («Recreación 3D orientativa»). Para pasar a fotografía real bastaría con sustituir los archivos de `public/images/ramos/` (mismos nombres, 4:5, 960×1200 y 480×600 con sufijo `-sm`). |
| Pósteres (fallback estático / movimiento reducido) | Se derivan automáticamente del primer y del último fotograma. |
| Recursos de la plantilla Scrolltide «Aerflora» | **No disponibles.** Son contenido Premium; no se han extraído. Si se compra el acceso y la licencia lo permite, se integran con el script de extracción (abajo). |

La web muestra una etiqueta «Secuencia provisional» mientras `public/frames/manifest.json` tenga `"provisional": true`. Al extraer la secuencia real, el script pone `false` y la etiqueta desaparece.

## Qué sigue dependiendo de recursos

La escena 3D ya resuelve la geometría, la luz, las oclusiones y el movimiento. Lo que la separa del acabado fotográfico son los **materiales y la vegetación**, que hoy se generan por código. Hay dos vías:

1. **Vídeo fotorrealista** (la vía preferente, especificada abajo): sustituye la secuencia entera con `npm run frames:extract`.
2. **Mejorar la escena 3D** con recursos reales, manteniendo la cámara, los tiempos y el reproductor:

| Recurso | Función | Formato |
| --- | --- | --- |
| Flores escaneadas o modeladas (rosa de jardín, orquídea phalaenopsis, hortensia, glicinia, helecho, hiedra) | Sustituir la geometría procedural (`flowers.js`) por pétalos con forma, translucidez y color reales | glTF/GLB, ≤ 30 k triángulos por flor, texturas PBR 2K (base color, normal, roughness, transmisión) |
| Tapicería de asiento (tejido + costuras) | Material de los asientos (`cabin.js`) | Texturas PBR tileables 2K |
| Moqueta de cabina | Suelo del pasillo | Texturas PBR tileables 2K |
| Paneles de cabina (plástico moldeado) y goma de juntas | Paredes, compartimentos, puerta | Texturas PBR tileables 1K |
| Corteza de cerezo y flor de cerezo | Árbol sobre las nubes | Modelo GLB o texturas PBR + tarjeta de flor |
| Mapa de entorno HDRI (cielo sobre nubes) | Iluminación y reflejos coherentes con el exterior | `.hdr`/`.exr` equirectangular 4K |

## Qué hace falta exactamente

**Un único plano continuo** (o varios planos encadenados sin corte visible):

- **Formato:** 16:9, mínimo 1920×1080 (mejor 2560×1440), 24 fps, 10–14 s, H.264 de alta calidad o ProRes. Sin texto ni marcas de agua.
- **Cámara:** avance (dolly) recto y a velocidad constante por el centro del pasillo, a la altura de los ojos de una persona de pie (~1,5 m). Sin giros, sin balanceo, sin cambios de lente, sin cortes. El punto de fuga (la puerta) debe quedar siempre en el centro horizontal: así el recorte vertical para móvil conserva el pasillo.
- **Arco:**
  1. 0–65 %: avance por el pasillo desde la fila 32 hasta quedar a ~1,5 m de una puerta doble verde salvia con dos ojos de buey.
  2. 65–70 %: pausa breve frente a la puerta cerrada.
  3. 70–92 %: la puerta doble se abre hacia fuera; entra luz cálida y una ráfaga de pétalos hacia la cámara; al fondo, un cerezo en flor sobre un mar de nubes.
  4. 92–100 %: ligero empuje hacia la puerta, plano casi fijo (aquí aparece «Welcome aboard.»).
- **Opcional:** una versión vertical 9:16 del mismo plano (`--portrait`). Si no existe, se recorta el centro del plano horizontal.

### Cómo producirlo con un generador de vídeo (Veo, Kling, Runway…)

Los generadores actuales producen clips de 5–10 s. Para un plano continuo:

1. Genera **4 fotogramas clave** fijos con el mismo estilo (prompts abajo): K1 entrada, K2 mitad del pasillo, K3 puerta cerrada, K4 puerta abierta.
2. Genera 3 clips con **fotograma inicial y final** (K1→K2, K2→K3, K3→K4). Así el último fotograma de cada clip es el primero del siguiente.
3. Únelos sin transición y entrega un solo archivo.

**Estilo común (añádelo a cada prompt):**
> Photorealistic, shot on a full-frame cinema camera, 24mm lens, f/4, soft diffused daylight through oval aircraft windows, warm ivory cabin, cream leather seats, dense real flowers with natural petal translucency and soft contact shadows: blush garden roses, white phalaenopsis orchids, white hydrangeas, hanging wisteria, ferns and trailing ivy. Foliage very close to the lens on both sides, shallow depth of field. Palette: ivory, blush pink, sage green. Calm, editorial, no people, no text.

- **K1 (entrada, fila 32):** *Centered one-point perspective down the aisle of a narrow-body aircraft cabin completely overgrown with flowers, the camera standing in the aisle at row 32; flower arches over every seat row, a closed sage-green double door with two round portholes far at the end of the aisle.*
- **K2 (mitad):** *Same cabin, same lens and height, halfway down the aisle; the sage-green double door now closer, flower walls thicker, petals drifting in the air.*
- **K3 (puerta cerrada):** *Same cabin, the camera stopped 1.5 m in front of the closed sage-green double door with two round portholes, the door framed by a dense arch of roses, orchids and hydrangeas.*
- **K4 (puerta abierta):** *Same framing; both door leaves swung open outward, revealing bright sky and a large blossoming cherry tree standing on a sea of clouds, warm light pouring into the cabin, pink petals blowing in.*

**Prompts de movimiento:**
- K1→K2 y K2→K3: *Slow, perfectly steady forward dolly along the aisle at constant speed, no rotation, no shake; petals gently falling.*
- K3→K4: *Locked-off camera with a very slight push-in; the double doors swing open outward; a gust of pink petals blows towards the camera; light blooms softly.*

Un prompt no garantiza el resultado: revisa que no haya saltos de geometría entre clips, flores que se deformen o «parpadeen», ni cambios de color.

## Integración

```bash
npm install
npm run frames:extract -- footage/aerflora.mp4
```

Opciones: `--frames 144` (fotogramas finales), `--portrait footage/aerflora-9x16.mp4`, `--focus-x 0.5`, y los momentos clave `--arrive`, `--open-start`, `--open-end` (índices de fotograma). Los textos se sincronizan con esos marcadores, así que basta con indicarlos según el vídeo real.

El script genera `public/frames/{lg,sm,portrait}/0001.webp…`, los pósteres y `manifest.json`. Coloca el vídeo fuente en `footage/` (ignorado por git).

### Presupuesto de peso

144 fotogramas: ~90 KB (`lg` 1600×900), ~35 KB (`sm` 960×540), ~60 KB (`portrait` 720×1280). Cada dispositivo descarga solo un conjunto. Para más fotogramas o más resolución, ajusta `--frames` y vigila el total (< 20 MB por conjunto).
