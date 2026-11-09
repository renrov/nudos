# Nudos sin vueltas

App en React + TypeScript + three.js que anima cómo se atan nudos. Sin librería de física. La soga está simulada, no animada con keyframes: unos pines "guía" invisibles tiran de puntos de la soga a lo largo de recorridos escritos a mano y la física hace el resto (cuelga, roza, choca, se ajusta). React Router (modo framework, `ssr: false`) prerenderiza una página estática por nudo; está alojada en Cloudflare Pages.

## Arrancá acá: ¿qué vas a cambiar?

Todas las rutas de abajo están dentro de `src/`.

| Tarea                                                               | Leé primero                                                                                                   | No hace falta        |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------- |
| Agregar o ajustar un nudo                                           | `engine/knots/types.ts`, `engine/knots/overhand.ts` (plantilla), `engine/knots/index.ts`                      | render, app          |
| Física de la soga (rigidez, contacto, fricción, guías)              | `engine/sim/rope.ts`, `engine/sim/rope.test.ts`, "Trampas" más abajo                                          | render, app          |
| Sogas, props u otras funciones del motor                            | "Layout de varias sogas" más abajo, `engine/sim/rope.ts`, `engine/sim/bake.ts`, `engine/playback/timeline.ts` | internos de ropeMesh |
| Cómo se ve la soga (cordones, puntas, sombreado, props, luces)      | `engine/render/ropeMesh.ts`, `engine/render/ropeMaterial.ts`, `engine/render/stage.ts`                        | sim, app             |
| Cámara, loop de render, qué se dibuja                               | `engine/render/viewer.ts`, `engine/render/stage.ts`, `app/features/viewer/`                                   | sim                  |
| Torsión a lo largo de la soga / normales                            | `engine/sim/frames.ts`                                                                                        | resto de sim         |
| Lógica de reproducción (play, seek, pasos, loop, borde del bakeo)   | `engine/playback/player.ts` + su test                                                                         | sim, render          |
| UI del reproductor, selector, tuner                                 | la carpeta de la feature en `app/features/`, `app/screens/KnotScreen.tsx`                                     | sim, render          |
| Títulos de página, vistas previas para compartir, URLs, dominio     | `app/shared/site.ts`, `app/shared/meta.ts`, `app/routes/`                                                     | engine               |
| Grabador de nudos (atar un nudo con el mouse y obtener las guías)   | `engine/record/recording.ts`, `engine/render/recorder.ts`, `app/features/recorder/`                           | internos de sim      |
| Videos de un nudo para compartir (cámara, subtítulos, codificación) | `../tools/film.ts` (cámara, subtítulos), `../tools/film.mjs` (driver), "Películas" más abajo                  | app                  |

Corré `pnpm test` después de tocar cualquier cosa en `engine/`. Mirá los cambios de UI y de render en el navegador (`pnpm dev`), porque ningún test unitario cubre cómo se ve; `pnpm test:e2e` revisa el sitio buildeado.

## Comandos

- `pnpm dev` – servidor de desarrollo (`.claude/launch.json`: `dev` en 5173, `dev-react` en 5177)
- `pnpm test` – vitest: tests de la simulación, del player y la huella del bakeo de cada nudo (~30 s)
- `pnpm build` – typegen de rutas, `tsc --noEmit`, después `react-router build` en `build/client` (páginas prerenderizadas + `404.html`)
- `pnpm typecheck`, `pnpm lint` (oxlint, incluidas las reglas de imports de más abajo), `pnpm format` (oxfmt)
- `pnpm test:e2e` – Playwright en `e2e/` contra el build de producción servido por `wrangler pages dev` en 5174
- `pnpm preview` – sirve `build/client` como lo hace Cloudflare Pages (después de `pnpm build`)
- `pnpm deploy:pages` / `pnpm deploy:pages:preview` – buildea y sube a Cloudflare Pages (producción / una rama de preview); necesita `wrangler login` una vez. No `pnpm deploy`: ese nombre es un comando propio de pnpm.
- `pnpm thumbs [url]` – con un servidor de desarrollo corriendo, fotografía el estado terminado de cada nudo en `public/og/<id>.jpg` (1200×630: la imagen para compartir y la tarjeta del selector). Volvé a correrlo después de agregar un nudo o cambiar cómo termina uno; un test falla si falta una imagen.
- `pnpm film [id… | --all]` – renderiza nudos como MP4 para compartir en `videos/` (ignorado por git; soga real, cámara guionada, subtítulos de los pasos; los cuadros los dibuja `tools/film.ts` y los codifica el codificador propio de macOS; necesita Google Chrome y macOS). `--cut=hands,cinch`, `--size=1080x1080`, `--speed`, `--hold`.
- `pnpm baked` – sirve `tools/` para la página de debug con vista de arriba (ver "Revisar un cambio con un solo bakeo")

Los tests, el typecheck, oxlint y oxfmt tienen que pasar antes de commitear.

## Arquitectura

```
src/engine/   sin framework: nada de React, ningún framework de DOM, nada de src/app
  knots/      datos KnotDef, un archivo por nudo; index.ts define el orden del menú
  sim/        RopeSim (XPBD), bake (nudo entero → tandas de cuadros; firstFrame), worker, MaterialFrames
  playback/   Timeline (almacén de cuadros bakeados, muestreo), Player (store del estado de reproducción)
  render/     stage (renderer, luces, mesa, cámara, OrbitControls, reset de vista), ropeMesh,
              ropeMaterial, KnotViewer (loop de render: avanza el player, dibuja las sogas)
  record/     recording.ts: presets del grabador, recorrido de mano → Guide, grabación → KnotDef y código
  session.ts  createKnotSession: arranca el bakeo de un nudo hacia un Player
src/app/      app de React Router
  root.tsx, routes.ts, routes/   "/" (primer nudo), "/nudos/:slug", "/estrellas", "/grabador", "*" (no encontrado)
  screens/KnotScreen.tsx         combina las features para la página de un nudo
  features/<nombre>/             viewer, player, picker, tuner; cada una exporta desde su index.ts
  shared/                        site.ts (dominio, URLs), meta.ts (title/etiquetas OG), hooks, ui/ (íconos, IconButton)
  styles/global.css              tokens de diseño y estilos base de los elementos; los componentes usan CSS modules
  styles/fonts/                  Archivo (variable, OFL), alojada en el sitio; se precarga en root.tsx
```

Reglas de dependencias, que hace cumplir oxlint (`.oxlintrc.json`):

- `src/engine` nunca importa React, React Router ni `src/app`.
- Una feature nunca importa otra feature; las pantallas y las rutas las combinan.
- Desde afuera de una feature, se importa a través de su `index.ts`, nunca de sus archivos.

Reglas de React: el loop de render y el bakeo quedan afuera de React. La UI lee los stores del motor con `useSyncExternalStore` (`Player.subscribe/getSnapshot`, `KnotViewer.onViewChange/isDefaultView`). El único hook de efecto es `useMountEffect` (`app/shared/hooks.ts`), para arrancar y frenar cosas externas (el visor, un worker, un listener del documento). Para empezar de nuevo (otro nudo, otra física), se vuelve a montar con una `key`: `KnotScreen` usa como key de su sesión el id del nudo y la física.

## Cómo está conectado

```
ruta /nudos/:slug → KnotScreen → Session (con key por nudo + física)
   │  Player.forKnot(knot): datos planos, así la página prerenderizada muestra el paso 1 y la duración
   ▼
ViewerCanvas se monta → new KnotViewer(canvas) → start(viewer):
   createKnotSession(knot, player, physics) → Timeline ── manda el KnotDef ──▶ sim/worker.ts → bake()
      Timeline llena el cuadro 0 enseguida (firstFrame), las tandas llegan del worker → player.setReady
   viewer.show(session): el loop de KnotViewer: player.tick(dt) → timeline.sample(time) → RopeMesh.update → render
PlayerBar lee el store del Player; sus botones llaman a las acciones del Player
```

Los cuadros se bakean en un Web Worker mientras el usuario mira; la reproducción espera en el borde de lo que ya está bakeado. Antes de que corran los scripts, la página prerenderizada muestra todo el layout y la imagen del nudo como un póster desvanecido; el póster se desvanece cuando el visor dibuja su primer cuadro (la pose inicial, calculada en el hilo principal), así la página nunca está vacía y nada se mueve.

### Archivos

- `engine/knots/types.ts` – el modelo de datos: `KnotDef` (`ropes[]`, `props[]` opcional, `guides[]`, `steps[]`, `duration`), `RopeDef` (largo, radio, polilínea `start`, `color` opcional), `Prop` (cápsula/cilindro), `Guide` (`rope?`, `at` = fracción a lo largo de esa soga, tiempo de `grab`, keys de `path`, `compliance`/`force` opcionales).
- `engine/knots/overhand.ts` – una buena plantilla. `engine/knots/index.ts` lista los nudos en el orden del menú.
- `engine/sim/rope.ts` – `RopeSim`: varilla de Cosserat basada en posiciones, XPBD de pasos chicos (24 subpasos por cuadro). Por subpaso: guías, flexión/torsión, estiramiento/corte, después rondas de (cálculo directo tridiagonal de largos + colisión de la soga consigo misma y entre sogas), después contacto con la mesa y con los props. Determinista. También `sampleHermite` (recorridos de las guías) y `particleCount`.
- `engine/sim/bake.ts` – corre un nudo entero, emite tandas de cuadros/normales; `firstFrame` da solo el cuadro 0. `engine/sim/frames.ts` – `MaterialFrames`: normales transportadas en paralelo por soga para que la torsión de la soga se quede con el material. `engine/sim/bake.fingerprint.test.ts` – hash del bakeo de cada nudo; actualizá un hash solo para un cambio buscado.
- `engine/playback/timeline.ts` – almacén de cuadros en el hilo principal, `counts` por soga, `sample(time)`. `player.ts` – estado de reproducción y acciones.
- `engine/render/ropeMesh.ts` – geometría de soga colchada de tres cordones rearmada alrededor de la línea central en cada cuadro, más puntas cortadas/casquillos. `ropeMaterial.ts` – material y texturas de la soga. `stage.ts` – renderer, cámara, luces, mesa, `createPropMesh`. `viewer.ts` – `KnotViewer`.
- `app/features/tuner/` – laboratorio de materiales: agregá `?tune` a la página de cualquier nudo para tener sliders sobre `DEFAULT_PHYSICS` (en `rope.ts`); al soltar se escriben los valores en la URL (`&bend=0.01&mass=2.2`), lo que vuelve a bakear el nudo.
- `/grabador` – el taller de nudos: hacé clic en la soga para ponerle una mano (sostiene hasta que la soltás); con el tiempo frenado, arrastrá los puntos de las manos para planear un movimiento (W/S para la altura), y después Reproducir el movimiento las lleva a todas juntas. Cada mano se graba como una guía (`RopeSim.hands` son las manos en vivo, `RopeSim.save/restore` sostienen un deshacer exacto). Repetir todo vuelve a correr las guías como lo haría el bakeo; Copiar código da un `KnotDef` para emprolijar en `src/engine/knots/`. El estado se guarda en localStorage.
- `app/shared/site.ts` – `SITE_URL` (el dominio propio; el único lugar donde vive), `knotPath` (por `slug`), `knotImagePath` (por `id`), `STARGAZERS_PATH`.
- `public/_redirects` – redirecciones 301 desde las URLs viejas en inglés (`/knots/<id>/`, `/stargazers/`, `/recorder`). Un nudo nuevo no necesita entrada acá.
- `wrangler.toml`, `public/_headers` – proyecto de Cloudflare Pages y cacheo de assets.

### Layout de varias sogas (importante cuando se toca la simulación)

Todas las sogas viven en un solo array de partículas y un solo array de segmentos, una soga después de la otra. El segmento `j` une las partículas `j` y `j+1` salvo que `end[j]` marque a `j` como la última partícula de su soga (un corte). El estiramiento, la flexión/torsión, el cálculo de largos, el suavizado de velocidades y la regla de `skip` de las colisiones nunca tienen que cruzar un corte. Los cuadros bakeados guardan todas las sogas una detrás de la otra; `Timeline.counts[k]` da la porción de cada soga, y `KnotViewer` le pasa a cada `RopeMesh` su porción con `subarray`. El radio, el espaciado y la masa son por partícula/segmento.

Los props son estáticos: `solveProps` empuja las partículas hacia afuera y aplica fricción, una vez por subpaso después de la mesa. Una partícula justo sobre el núcleo de un prop se saltea.

## Agregar un nudo

Solo datos: escribí un `KnotDef` en `src/engine/knots/` (con un `id` en inglés para sus archivos y un `slug` en castellano para su URL), agregalo a `engine/knots/index.ts`, después corré `pnpm thumbs` para su imagen y agregá su hash al test de huella del bakeo. No agregues código específico de un nudo al motor. El `at` de una guía es una fracción a lo largo de su soga; la mesa está en y = 0, las sogas apoyan en y = radio; la cámara mira desde +z. Todos los nudos de la lista pasan por `src/engine/knots/knots.test.ts`, que asume **una sola soga** y un nudo que se ata y se ajusta; un nudo de varias sogas necesita sus propios tests.

### Coreografía: pensá en manos, no en pines

Las guías son manos. Un movimiento natural agarra un punto y deja que la física lleve el resto; manejar varios puntos del mismo tramo con recorridos propios hace que se peleen y la soga parece una marioneta.

- **Una mano por movimiento.** Para dar vuelta una curva, agarrá un punto de ella (más o menos en el medio) y llevalo; dejá que el resto siga. Los pines que solo armaban una forma sueltan (terminá su recorrido con un `{ t }` pelado) antes de que arranque el próximo movimiento.
- **Atá cerca de la punta.** Una cola larga hay que arrastrarla y revolearla, lo que genera ondas, ganchos y latigazos. Usá solo la cola que necesita la pasada.
- **Tendé la soga derecha.** Si dos pines sostienen menos distancia entre sí que la soga que hay entre ellos, el sobrante se arquea en una onda. Separá los objetivos más o menos según el largo de soga entre los puntos sostenidos.
- **La punta va adelante.** Cuando la punta viaja, mantenela por delante de la soga que la sigue, así apunta hacia donde va y no queda colgando como un gancho.
- **Levantá bajo.** Pasá por encima de la soga de abajo por poquito (el centro a unos 3–4 radios de altura). Una soga levantada muy alto hacia la cámara se ve de punta y sus cordones se leen como ruido.
- **Tirá de las dos puntas parejo.** Los objetivos del tirón final, lo bastante separados para ajustar (el test de ajuste) y centrados en el nudo para que no se deslice (el test de "se queda donde se ató").
- **Fijate cómo se ve cada etapa** en el navegador en algunos tiempos de los pasos, no solo en los tests: los tests detectan la topología y el ajuste, no un movimiento torpe.

### Revisar un cambio con un solo bakeo

`tools/knot-dump.test.ts` bakea un nudo de una sola soga e imprime números, así cada cambio de guía cuesta un bakeo (~20 s) en lugar de una corrida de tests o un barrido. Se saltea salvo que esté definida `KNOT`, así `pnpm test` lo ignora.

```bash
KNOT=bowline TIMES=13.3,13.9 ATS=0.272,0.95,1 CROSS=13.9,18 npx vitest run tools/knot-dump.test.ts --disableConsoleIntercept
```

- Una fila por tiempo en `TIMES` (por defecto: los tiempos de los pasos), con la posición de cada punto de `ATS` (fracciones a lo largo de la soga) como `at(x, altura en radios, z)`. Comparala con el objetivo de la guía para ver si una mano llega, y con los tramos cercanos para ver dónde está la soga de verdad: un bucle sostenido en una soga blanda puede terminar más chico que sus pines.
- `cross t:` lista dónde se cruza la soga consigo misma en la vista de arriba, por ejemplo `0.52 under 0.73`. Un cruce de más quiere decir una vuelta o una curva de más; uno de menos quiere decir que una pasada no entró en su agujero. Es una revisión aproximada y puede perderse cruces adentro de un nudo apretado.
- `stretch` es el peor estiramiento de un eslabón (mantenelo por debajo de 1.1 más o menos); `closest` es el acercamiento máximo entre partes lejanas de la soga (menos de 2R quiere decir que una atravesó a otra).
- `tools/out/bake.json` (ignorado por git) alimenta `tools/baked.html`: corré `pnpm baked` y abrí http://localhost:5178/baked.html (agregá `?zoom` para el medio de la mesa, `?box=x0,x1,z0,z1` para cualquier zona) para una vista de arriba con marcas de los pasos. Con varias sogas, elegí un punto de la soga k con `ATS=k:0.5`. El reporte también se guarda en `tools/out/metrics.txt`.

### Películas para compartir

`pnpm film bowline` (o `--all`) escribe `videos/<id>.mp4` (ignorado por git, así los archivos quedan afuera del historial del repo): 1920×1080 H.264, sin audio, ~20 s, listo para X. No hay nada trucado: la página `tools/film.html` + `film.ts` bakea el nudo y después dibuja cada cuadro a pedido con el `RopeMesh` y el `createStage` reales, así el reloj de la película es exacto y la cámara es un guion, no un mouse.

- **Cortes:** `--cut=full` (por defecto, el tutorial con subtítulos, `<id>.mp4`), `--cut=hands` (`<id>-hands.mp4`, ~11 s a 1.8× con "Sin keyframes." y puntos brillantes donde cada guía sostiene la soga; para developers) y `--cut=cinch` (`<id>-cinch.mp4`, ~5–7 s de primer plano del último tirón; para todo el mundo). `--cut=all` o una lista con comas renderiza varios. Cada corte vuelve a bakear el nudo.
- **Cámara:** el array `keys` en `film.ts` (tiempo de película, azimut°, elevación°, distancia); un spline cardinal lleva la cámara a través de ellas, y el objetivo deriva desde el medio de la mesa hacia la parte más densa de la soga terminada, el nudo (`knotCentre`).
- **Subtítulos:** el título del paso y `n / total` salen de `knot.steps`; el título arriba a la izquierda y la dirección en el plano final se dibujan en un canvas 2D por encima del cuadro (`overlay`).
- **Codificación:** `tools/encode-video.swift` (AVFoundation, se compila la primera vez en `tools/out/film/`), porque no hay dependencia de ffmpeg. Hacen falta macOS y Google Chrome (`--headless` cae en GL por software, que es lento). Opciones: `--size=1080x1080`, `--fps`, `--speed` (velocidad de atado), `--hold` (segundos sobre el nudo terminado).
- Los cuadros son JPEGs en una carpeta temporal que se borra después de codificar (`--keep` los conserva, para inspeccionar uno). El bitrate es de 14 Mbit/s, lo que deja los nudos más largos en unos 35 MB; bajá `AverageBitRate` en el archivo Swift para archivos más chicos.

## Trampas

- Las constantes de física de `rope.ts` se ajustaron con barridos de métricas; el material de la soga (`DEFAULT_PHYSICS`) se eligió a ojo en el laboratorio `?tune`; cambialas a propósito y volvé a correr todos los tests. Cada nudo tiene que seguir bakeándose idéntico bit a bit salvo que el cambio sea buscado (lo revisa el test de huella).
- Los tests de que la soga no atraviese props ni otras sogas viven en `src/engine/sim/rope.test.ts` (un nudo de prueba con dos sogas y un poste). El sombreado de contacto de `RopeMesh` solo tiene en cuenta su propia soga.
- `RopeDef.start` tiene que ser más o menos tan largo como `length` (si no, el constructor tira error).
- La colisión es un test de pares O(n²) con una broad phase por bloques: alcanza para unos pocos cientos de partículas; agregá un hash espacial para muchas más. Un nudo tiene que bakearse más rápido que en tiempo real, si no la reproducción se traba en el borde del bakeo.
