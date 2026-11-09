import * as THREE from "three";

const SIZE = 512;
// Una baldosa cubre un largo de colchado a lo largo de la soga (u) y una vuelta alrededor de un
// cordón (v). Las filásticas se tuercen en contra del cordón, así sus fibras corren a lo largo de
// él con una inclinación leve: YARNS alrededor, ACROSS a lo largo de un colchado.
// La aleatoriedad por filástica se repite cada gcd(YARNS, ACROSS) filásticas, así la baldosa sigue
// cerrando sin costuras.
const YARNS = 12;
const ACROSS = 28;
const DISTINCT = 4; // gcd(YARNS, ACROSS)
const FIBRES = 10; // vetas finas de fibra por filástica
const BLOTCH = 8; // celdas de desgaste desparejo a lo largo de la baldosa

/**
 * Detalle de fibra para un cordón, dibujado de forma procedural así no hay imágenes que administrar.
 * Los cordones mismos son geometría (ver RopeMesh); esto solo agrega las filásticas finas retorcidas.
 */
export function createRopeMaterial(
  color: THREE.ColorRepresentation,
  anisotropy: number,
): THREE.MeshPhysicalMaterial {
  const height = new Float32Array(SIZE * SIZE);
  const albedo = new Float32Array(SIZE * SIZE);
  const tone = new Float32Array(SIZE * SIZE);
  // Aleatoriedad repetible por fibra, así cada filástica es un poco distinta pero la baldosa sigue cerrando.
  const hash = (i: number) => {
    const h = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return h - Math.floor(h);
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const wrap = (i: number, n: number) => ((i % n) + n) % n;
  // Ruido 1D suave sobre una grilla periódica de n celdas.
  const noise1 = (x: number, n: number, salt: number) => {
    const i = Math.floor(x);
    const a = hash(wrap(i, n) + salt);
    return a + (hash(wrap(i + 1, n) + salt) - a) * smooth(x - i);
  };
  // Ruido 2D suave sobre una grilla de BLOTCH × BLOTCH que cierra con la baldosa.
  const noise2 = (u: number, v: number) => {
    const x = u * BLOTCH;
    const y = v * BLOTCH;
    const i = Math.floor(x);
    const j = Math.floor(y);
    const c = (di: number, dj: number) =>
      hash(wrap(i + di, BLOTCH) * 31 + wrap(j + dj, BLOTCH) + 900);
    const sx = smooth(x - i);
    const sy = smooth(y - j);
    return (
      (c(0, 0) * (1 - sx) + c(1, 0) * sx) * (1 - sy) + (c(0, 1) * (1 - sx) + c(1, 1) * sx) * sy
    );
  };
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      const along = YARNS * u + ACROSS * v; // a lo largo de una filástica
      // Menos: las filásticas se inclinan hacia atrás contra la torsión del cordón, así en la
      // superficie quedan casi a lo largo de la soga misma.
      const w = YARNS * v - ACROSS * u; // a través de las filásticas: una unidad por filástica
      const k = Math.floor(w);
      const f = w - k;
      const yarnId = wrap(k, DISTINCT);
      const thick = 0.8 + 0.4 * hash(yarnId + 50); // algunas filásticas sobresalen de sus vecinas
      // Cada filástica es una cresta redondeada con un pliegue oscuro donde se junta con la siguiente.
      const yarn = thick * Math.sin(Math.PI * f) ** 0.5;
      // Las fibras corren a lo largo de la filástica como vetas finas claras y oscuras.
      const streak = noise1(w * FIBRES, DISTINCT * FIBRES, 0);
      const fleck = noise1(
        w * FIBRES * 2 + 0.5 * noise1(along, DISTINCT, 70),
        DISTINCT * FIBRES * 2,
        200,
      );
      const wear = noise2(u, v);
      // Cuál de los tonos de fibra es esta veta: paja clara, beige dorado o marrón más oscuro.
      tone[y * SIZE + x] = noise1(w * FIBRES * 0.5 + 3 * wear, DISTINCT * FIBRES * 0.5, 400);
      height[y * SIZE + x] = 0.45 * yarn + 0.3 * streak + 0.25 * fleck;
      albedo[y * SIZE + x] =
        (0.7 + 0.3 * Math.min(1, yarn)) *
        (0.78 + 0.22 * streak) *
        (0.9 + 0.1 * fleck) *
        (0.94 + 0.06 * wear) *
        (0.94 + 0.06 * hash(yarnId + 20));
    }

  // Tonos en sRGB, porque la textura de color se guarda así.
  const tan = new THREE.Color(color).convertLinearToSRGB();
  const straw = tan.clone().lerp(new THREE.Color(0xf3e4c0), 0.55);
  const brown = tan.clone().multiplyScalar(0.62).lerp(new THREE.Color(0x6b5038), 0.2);
  const colorData = new Uint8Array(SIZE * SIZE * 4);
  const normalData = new Uint8Array(SIZE * SIZE * 4);
  const at = (x: number, y: number) => height[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)];
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      // La fibra natural nunca es de un solo color: mezclar paja → beige → marrón, más un poco de grano.
      const t = tone[i];
      const c = t < 0.5 ? straw.clone().lerp(tan, t * 2) : tan.clone().lerp(brown, t * 2 - 1);
      const g = albedo[i] * (0.97 + 0.06 * hash(i + 7000));
      colorData.set(
        [255 * Math.min(1, c.r * g), 255 * Math.min(1, c.g * g), 255 * Math.min(1, c.b * g), 255],
        i * 4,
      );
      const dx = at(x + 1, y) - at(x - 1, y);
      const dy = at(x, y + 1) - at(x, y - 1);
      const len = Math.hypot(dx, dy, 1);
      normalData.set(
        [
          (0.5 - (0.5 * dx) / len) * 255,
          (0.5 - (0.5 * dy) / len) * 255,
          (0.5 + 0.5 / len) * 255,
          255,
        ],
        i * 4,
      );
    }

  const texture = (data: Uint8Array, srgb: boolean) => {
    const tex = new THREE.DataTexture(data, SIZE, SIZE);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = anisotropy;
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, // los tonos de fibra viven en la textura
    side: THREE.DoubleSide, // ninguna parte de la soga puede verse transparente, ni siquiera las puntas cortadas vistas de cerca
    vertexColors: true, // oclusión de las ranuras entre cordones bakeada por vértice en RopeMesh
    map: texture(colorData, true),
    normalMap: texture(normalData, false),
    normalScale: new THREE.Vector2(2.2, 2.2),
    // Fibra natural seca: mate, casi sin especular, y las crestas iluminadas se vuelven crema en
    // lugar de más brillantes.
    roughness: 0.88,
    specularIntensity: 0.2,
    specularColor: new THREE.Color(0xfff2dc),
    sheen: 0.12, // el sheen ignora el sombreado por vértice, así que más iluminaría las ranuras y las puntas quemadas
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(0xf6e8cf),
  });
  material.userData.fibreColor = new THREE.Color(color); // para las fibras sueltas que dibuja RopeMesh
  return material;
}

/**
 * La punta cortada de un cordón: un manojo de extremos de filásticas apretados, cada uno un pequeño
 * disco de puntas de fibra con un hueco oscuro alrededor. RopeMesh lo mapea plano sobre la cara
 * cortada del cordón.
 */
export function createCutFaceTexture(color: THREE.ColorRepresentation): THREE.DataTexture {
  const size = 512;
  const tone = new THREE.Color(color).convertLinearToSRGB();
  let seed = 3;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // Filásticas en un empaquetado hexagonal con jitter que llena el disco.
  const yarns: [number, number, number, number][] = []; // x, y, radio, tono
  const step = 0.075; // ~550 filásticas por cordón
  const span = Math.ceil(1 / step);
  for (let row = -span; row <= span; row++)
    for (let col = -span; col <= span; col++) {
      const x = (col + (row % 2) * 0.5) * step + (rand() - 0.5) * 0.4 * step;
      const y = row * step * 0.866 + (rand() - 0.5) * 0.4 * step;
      if (Math.hypot(x, y) < 0.9)
        yarns.push([x, y, step * (0.6 + 0.13 * rand()), 0.6 + 0.2 * rand()]); // tan oscuro como los costados sombreados de la soga, no más claro
    }
  // Agrupar las filásticas en una grilla de una filástica de ancho, así cada píxel solo revisa su vecindario.
  const cells = Math.ceil(2 / step) + 2;
  const cellOf = (v: number) => Math.min(cells - 1, Math.max(0, Math.floor((v + 1) / step)));
  const grid: (typeof yarns)[] = Array.from({ length: cells * cells }, () => []);
  for (const ya of yarns) grid[cellOf(ya[1]) * cells + cellOf(ya[0])].push(ya);
  const data = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py++)
    for (let px = 0; px < size; px++) {
      const x = (px / size) * 2 - 1;
      const y = (py / size) * 2 - 1;
      let best = Infinity;
      let second = Infinity;
      let yarn = yarns[0];
      const gx = cellOf(x);
      const gy = cellOf(y);
      for (let cy = Math.max(0, gy - 2); cy <= Math.min(cells - 1, gy + 2); cy++)
        for (let cx = Math.max(0, gx - 2); cx <= Math.min(cells - 1, gx + 2); cx++)
          for (const ya of grid[cy * cells + cx]) {
            const d = Math.hypot(x - ya[0], y - ya[1]) - ya[2];
            if (d < best) {
              second = best;
              best = d;
              yarn = ya;
            } else if (d < second) second = d;
          }
      // Las filásticas están apretadas: cada píxel pertenece a su filástica más cercana, con una
      // costura fina y oscura donde se juntan dos filásticas y un hueco más oscuro afuera del manojo.
      const speckle = 0.82 + 0.3 * rand();
      const seam = Math.min(1, (second - best) / (0.12 * step));
      let v: number;
      if (best > 0) v = 0.24 + 0.08 * rand();
      else v = yarn[3] * speckle * (0.55 + 0.45 * seam);
      data.set(
        [
          255 * Math.min(1, tone.r * v),
          255 * Math.min(1, tone.g * v),
          255 * Math.min(1, tone.b * v),
          255,
        ],
        (py * size + px) * 4,
      );
    }
  const tex = new THREE.DataTexture(data, size, size);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}
