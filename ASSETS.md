# Recursos visuales: qué falta y cómo integrarlo

## Estado actual

| Recurso | Estado |
| --- | --- |
| Secuencia principal (pasillo → puerta → árbol sobre nubes) | **Provisional.** Se genera por código con `npm run frames:placeholder`. Tiene aspecto ilustrado; **no** alcanza la calidad fotográfica de la referencia. |
| Pósteres (fallback estático / movimiento reducido) | Se derivan automáticamente del primer y del último fotograma. |
| Recursos de la plantilla Scrolltide «Aerflora» | **No disponibles.** Son contenido Premium; no se han extraído. Si se compra el acceso y la licencia lo permite, se integran con el mismo script (abajo). |

La web muestra una etiqueta «Secuencia provisional» mientras `public/frames/manifest.json` tenga `"provisional": true`. Al extraer la secuencia real, el script pone `false` y la etiqueta desaparece.

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
