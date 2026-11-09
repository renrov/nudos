import * as THREE from "three";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { createCutFaceTexture } from "./ropeMaterial";
import { KEY_LIGHT } from "./stage";

const STRANDS = 3;
const RADIAL = 20; // vértices alrededor de cada cordón
const SUB = 3; // muestras suaves por hueco entre partículas
const CAP = 4; // anillos en el extremo redondeado de cada cordón
// Las crestas de los cordones llegan un poco más allá del radio de colisión: donde la soga se
// aprieta contra la soga en un nudo, los cordones se encuentran y se meten en las ranuras del otro
// en lugar de dejar un hueco visible.
const VISUAL_SCALE = 1.08;
const OFFSET = 0.55; // distancia del eje del cordón al eje de la soga, en radios visuales
// Los cordones están aplastados entre sí, así que son más anchos alrededor de la soga que profundos.
// Los semianchos se superponen un poco con los vecinos (2 · 0.5 > √3 · 0.55), dejando un pliegue
// apretado, no un hueco.
const STRAND_DEPTH = 0.45; // semiprofundidad radial, en radios visuales: cresta en 0.55 + 0.45 = 1
const STRAND_WIDTH = 0.5; // semiancho alrededor de la soga, en radios visuales
const LAY = 7; // largo de soga por vuelta completa de los cordones, en radios
const HAIRS_PER_RADIUS = 72; // fibras sueltas por radio de largo de soga, por cordón
const HAIR_LENGTH = 0.13; // fibra suelta típica, en radios; los largos reales se dispersan mucho alrededor
const STRAYS = 0.05; // proporción de fibras que son pelos largos sueltos
// Cada punta está cortada limpia: los tres cordones asoman de un casquillo de metal engarzado que los sostiene.
const TIP = 0.06; // cordones cortados que asoman más allá del casquillo, en radios: apenas pasado su borde
const HAIR_WIDTH = 0.00035; // m: ancho real de una fibra, así los pelos se afinan cuando la cámara se aleja
const SLEEVE = 1.2; // largo del casquillo, en radios
// El casquillo está engarzado: la soga debajo se aprieta a SQUEEZE, y sus bordes muerden un poco más.
const SQUEEZE = 0.9;
const WALL = 0.09; // espesor de la pared del casquillo, en radios visuales
const TUFTS = 300; // fibras que salen de la cara cortada de cada cordón, repartidas por toda la cara
const NEAR = 12; // partes de otra soga más cercanas que se recuerdan por partícula, para el sombreado de contacto
// Color de las ranuras: más o menos la mitad de brillante que la cresta y más gris, la señal más
// fuerte de una soga retorcida.
const GROOVE = [0.5, 0.49, 0.5];
const DIRT = [0.78, 0.76, 0.76]; // desgaste más gris y oscuro donde la soga se aprieta contra la soga en el nudo
const CONTACT_SHADOW = 0x262d40; // azul oscuro, como la tinta del sitio, así la sombra debajo de la soga no es un gris muerto
const TO_LIGHT = KEY_LIGHT.clone().normalize();

/**
 * Soga colchada de tres cordones armada alrededor de la línea central simulada en cada cuadro.
 * Los cordones son geometría real, así el contorno tiene relieve y las ranuras quedan oscuras.
 */
export class RopeMesh extends THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  private readonly n: number;
  private readonly m: number;
  private readonly rings: number;
  private readonly d: number;
  private readonly rs: number;
  private readonly rw: number;
  private readonly pitch: number;
  private readonly centers: Float32Array;
  private readonly frames: Float32Array; // normal y binormal por muestra
  private readonly tangents: Float32Array;
  private readonly lengths: Float32Array;
  private readonly axis: Float32Array; // el eje de un cordón por muestra
  private readonly outward: Float32Array; // desde el eje de la soga hacia ese cordón
  /** Fibras sueltas: cada una sale de un vértice de un cordón, un poco doblada a lo largo de la soga. */
  private readonly hairs: LineSegments2;
  private readonly hairRoot: Uint32Array; // vértice del cordón desde el que crece cada fibra
  private readonly hairShape: Float32Array; // largo, inclinación a lo largo de la soga, rulo, costado, por fibra
  private readonly bodyHairs: number; // las fibras de acá en adelante crecen desde las caras cortadas
  private readonly tuftAt: Float32Array; // por fibra de cara cortada: qué disco, ángulo alrededor, distancia hacia afuera
  private readonly ds: number; // largo de la línea central entre muestras
  private readonly sleeves: THREE.Mesh[];
  /** La punta cortada de cada cordón en los dos extremos de la soga, mostrando las filásticas apretadas adentro. */
  private readonly cutFaces: THREE.Mesh;
  private readonly radius: number;
  private readonly near: Int16Array; // por partícula, hasta NEAR partículas de otra soga cercanas
  private readonly nearCount: Uint8Array;
  private readonly nearDist: Float32Array;
  private readonly contact: Float32Array; // por partícula: 0 libre, 1 apretada en el nudo
  /** Sombra suave sobre la mesa justo debajo de la soga, más oscura cuanto más cerca está la soga. */
  private readonly ground: THREE.Mesh;

  constructor(n: number, rope: { length: number; radius: number }, material: THREE.Material) {
    const { radius } = rope;
    const m = (n - 1) * SUB + 1;
    const rings = m + 2 * CAP;
    const verts = STRANDS * rings * (RADIAL + 1);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(verts * 2), 2));
    const index: number[] = [];
    for (let s = 0; s < STRANDS; s++)
      for (let r = 0; r < rings - 1; r++)
        for (let j = 0; j < RADIAL; j++) {
          const a = (s * rings + r) * (RADIAL + 1) + j;
          const b = a + RADIAL + 1;
          index.push(a, a + 1, b, b, a + 1, b + 1); // antihorario visto desde afuera
        }
    geometry.setIndex(index);
    super(geometry, material);
    const visual = radius * VISUAL_SCALE;
    this.n = n;
    this.m = m;
    this.rings = rings;
    this.d = OFFSET * visual;
    this.rs = STRAND_DEPTH * visual;
    this.rw = STRAND_WIDTH * visual;
    this.pitch = LAY * radius;
    this.centers = new Float32Array(m * 3);
    this.frames = new Float32Array(m * 6);
    this.tangents = new Float32Array(m * 3);
    // El colchado se mide a lo largo de la soga en reposo, así estirarla nunca hace deslizar los cordones.
    this.lengths = Float32Array.from({ length: m }, (_, k) => (k / SUB) * (rope.length / (n - 1)));
    this.axis = new Float32Array(m * 3);
    this.outward = new Float32Array(m * 3);
    this.castShadow = true;
    this.receiveShadow = true;
    this.frustumCulled = false;

    // Las fibras crecen solo en la mitad externa de cada cordón, donde la soga roza y se deshilacha.
    const body = Math.round((rope.length / radius) * HAIRS_PER_RADIUS * STRANDS);
    const count = body + 2 * STRANDS * TUFTS;
    this.ds = rope.length / (n - 1) / SUB;
    // Sin fibras debajo de los casquillos ni en las puntas selladas.
    const endZone = Math.ceil(((TIP + SLEEVE) * radius) / this.ds);
    this.hairRoot = new Uint32Array(count);
    this.hairShape = new Float32Array(count * 5);
    let seed = 11;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const gauss = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
    // La pelusa aparece en parches donde la soga rozó: una densidad aleatoria lenta a lo largo de la soga.
    const patches = Array.from({ length: 24 }, () => rand());
    const density = (r: number) => {
      const x = ((r - CAP) / m) * (patches.length - 1);
      const i = Math.min(Math.floor(x), patches.length - 2);
      return patches[i] + (patches[i + 1] - patches[i]) * (x - i);
    };
    for (let h = 0; h < body; h++) {
      const s = Math.floor(rand() * STRANDS);
      let r = CAP + endZone + Math.floor(rand() * (m - 2 * endZone));
      while (rand() > 0.25 + 0.75 * density(r))
        r = CAP + endZone + Math.floor(rand() * (m - 2 * endZone));
      const j = Math.round((rand() - 0.5) * 0.5 * RADIAL + RADIAL) % RADIAL; // ±un cuarto de vuelta de la cresta
      this.hairRoot[h] = (s * rings + r) * (RADIAL + 1) + j;
      // La mayoría cortas, una cola larga de medianas y unos pocos pelos largos sueltos.
      const len =
        rand() < STRAYS
          ? HAIR_LENGTH * (3 + 3 * rand())
          : HAIR_LENGTH * Math.min(3, Math.exp(0.5 * gauss()));
      // Largo, inclinación a lo largo de la soga, rulo, costado y cuánto se para respecto de la
      // superficie: algunas salen derechas, muchas quedan acostadas o se doblan hacia afuera.
      this.hairShape.set(
        [len * radius, gauss() * 0.6, gauss() * 0.5, gauss() * 0.9, 0.1 + 0.9 * rand() ** 0.7],
        h * 5,
      );
    }
    // Mechones en las puntas cortadas: fibras cortas que salen de la cara de cada cordón,
    // abriéndose un poco.
    // Las raíces se reparten de forma pareja sobre toda la cara (√ de un número uniforme da un área uniforme).
    this.bodyHairs = body;
    this.tuftAt = new Float32Array((count - body) * 3);
    for (let h = body; h < count; h++) {
      const e = h - body;
      this.tuftAt.set([Math.floor(e / TUFTS), rand() * RADIAL, Math.sqrt(rand()) * 0.97], e * 3);
      const len = HAIR_LENGTH * (0.5 + rand() * 1.3);
      this.hairShape.set([len * radius, 0, gauss() * 0.3, gauss() * 0.35, 1], h * 5);
    }
    // Líneas anchas: las líneas comunes de WebGL siempre miden 1 px, demasiado finas para leerse como fibra.
    const hairGeometry = new LineSegmentsGeometry();
    hairGeometry.setPositions(new Float32Array(count * 2 * 6)); // dos segmentos por fibra
    const base: THREE.Color = material.userData.fibreColor ?? new THREE.Color("#c39f6a");
    // Cada fibra sale con el tono del cordón: oscura en la raíz, más clara hacia la punta.
    const root = base.clone().multiplyScalar(0.45);
    const mid = base.clone().multiplyScalar(0.8);
    const tip = base.clone().lerp(new THREE.Color(0xf3e4c0), 0.2);
    const shades = new Float32Array(count * 12);
    const tint = new THREE.Color();
    for (let h = 0; h < count; h++) {
      // Cada fibra tiene su propio tono, de marrón oscuro a paja clara.
      const v = 0.75 + 0.45 * rand();
      const a = tint.copy(root).multiplyScalar(v).toArray();
      const b = tint.copy(mid).multiplyScalar(v).toArray();
      const c = tint.copy(tip).multiplyScalar(v).toArray();
      shades.set([...a, ...b, ...b, ...c], h * 12);
    }
    hairGeometry.setColors(shades);
    const hairMaterial = new LineMaterial({
      vertexColors: true,
      linewidth: HAIR_WIDTH,
      worldUnits: true,
      transparent: true,
      opacity: 0.9,
    });
    this.hairs = new LineSegments2(hairGeometry, hairMaterial);
    const size = new THREE.Vector2();
    this.hairs.onBeforeRender = (renderer) => hairMaterial.resolution.copy(renderer.getSize(size));
    this.hairs.frustumCulled = false;
    this.add(this.hairs);

    this.radius = radius;
    this.near = new Int16Array(n * NEAR);
    this.nearCount = new Uint8Array(n);
    this.nearDist = new Float32Array(n * NEAR);
    this.contact = new Float32Array(n);

    // Franja del piso: borde, medio, borde por muestra; el alfa del color se desvanece a lo ancho y con la altura.
    const groundGeometry = new THREE.BufferGeometry();
    groundGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(m * 9), 3));
    groundGeometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(m * 12), 4));
    const strip: number[] = [];
    for (let k = 0; k < m - 1; k++)
      for (let c = 0; c < 2; c++) {
        const a = k * 3 + c;
        strip.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
      }
    groundGeometry.setIndex(strip);
    this.ground = new THREE.Mesh(
      groundGeometry,
      new THREE.MeshBasicMaterial({
        color: CONTACT_SHADOW,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    );
    this.ground.frustumCulled = false;
    this.ground.renderOrder = -1;
    this.add(this.ground);

    // Perfil del casquillo, girado alrededor de la soga: bordes redondeados y dos ranuras de engarce.
    // Se arma hacia afuera desde la soga apretada, así ningún cordón corta la pared ni los bordes.
    const Ri = SQUEEZE * visual * 1.01; // pared interna, apoyada sobre las crestas apretadas de los cordones
    const R = Ri + WALL * visual;
    const lip = Ri + 0.4 * WALL * visual; // borde enrollado, todavía sin tocar la soga
    const L = SLEEVE * radius;
    // Un contorno cerrado, así el casquillo es un tubo sólido con pared y no una cáscara
    // transparente: cara exterior con ranuras de engarce, borde enrollado, y de vuelta por adentro contra la soga.
    const profile = [
      [Ri, -L / 2],
      [lip, -L / 2],
      [R, -L / 2 + 0.06 * L],
      [R, -0.22 * L],
      [R - 0.35 * WALL * visual, -0.17 * L],
      [R, -0.12 * L],
      [R, 0.12 * L],
      [R - 0.35 * WALL * visual, 0.17 * L],
      [R, 0.22 * L],
      [R, L / 2 - 0.06 * L],
      [lip, L / 2],
      [Ri, L / 2],
      [Ri, -L / 2],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const sleeveGeometry = new THREE.LatheGeometry(profile, 40);
    const metal = new THREE.MeshStandardMaterial({
      color: 0x8a8d91,
      metalness: 1,
      roughness: 0.5,
      side: THREE.DoubleSide, // el sentido del contorno cerrado se invierte en la pared interna
    });
    this.sleeves = [0, 1].map(() => {
      const sleeve = new THREE.Mesh(sleeveGeometry, metal);
      sleeve.castShadow = true;
      sleeve.receiveShadow = true;
      this.add(sleeve);
      return sleeve;
    });

    // Un disco por cordón por punta: un vértice central en abanico hasta el último anillo del cordón.
    const discs = 2 * STRANDS;
    const perDisc = RADIAL + 2;
    const faceGeometry = new THREE.BufferGeometry();
    faceGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(discs * perDisc * 3), 3),
    );
    faceGeometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(new Float32Array(discs * perDisc * 3), 3),
    );
    const faceUv = new Float32Array(discs * perDisc * 2);
    const fan: number[] = [];
    for (let d = 0; d < discs; d++) {
      const o = d * perDisc;
      faceUv.set([0.5, 0.5], o * 2);
      const turn = d * 2.1; // cada cordón muestra sus filásticas con un ángulo distinto
      for (let j = 0; j <= RADIAL; j++) {
        const a = (j / RADIAL) * Math.PI * 2 + turn;
        faceUv.set([0.5 + 0.48 * Math.cos(a), 0.5 + 0.48 * Math.sin(a)], (o + 1 + j) * 2);
        if (j < RADIAL) fan.push(o, o + 1 + j, o + 2 + j);
      }
    }
    faceGeometry.setAttribute("uv", new THREE.BufferAttribute(faceUv, 2));
    faceGeometry.setIndex(fan);
    this.cutFaces = new THREE.Mesh(
      faceGeometry,
      new THREE.MeshStandardMaterial({
        map: createCutFaceTexture(base),
        roughness: 0.95,
        side: THREE.DoubleSide,
      }),
    );
    this.cutFaces.frustumCulled = false;
    this.add(this.cutFaces);
  }

  update(p: Float32Array, pn: Float32Array): void {
    const { n, m, centers, frames, tangents, lengths, axis, outward, d, rs, rw, pitch } = this;
    // Catmull-Rom entre partículas para una línea central suave.
    for (let i = 0; i < n - 1; i++)
      for (let s = 0; s < SUB; s++) {
        const u = s / SUB;
        const o = (i * SUB + s) * 3;
        for (let c = 0; c < 3; c++) {
          const p0 = p[Math.max(i - 1, 0) * 3 + c];
          const p1 = p[i * 3 + c];
          const p2 = p[(i + 1) * 3 + c];
          const p3 = p[Math.min(i + 2, n - 1) * 3 + c];
          centers[o + c] =
            0.5 *
            (2 * p1 +
              (p2 - p0) * u +
              (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u +
              (3 * p1 - p0 - 3 * p2 + p3) * u * u * u);
        }
      }
    centers.set(p.subarray((n - 1) * 3, n * 3), (m - 1) * 3);
    this.findContacts(p);

    // Marcos a partir de las normales de material bakeadas, así la torsión viaja con la soga.
    const t = new THREE.Vector3();
    const nor = new THREE.Vector3();
    const bin = new THREE.Vector3();
    for (let k = 0; k < m; k++) {
      const a = Math.max(k - 1, 0) * 3;
      const b = Math.min(k + 1, m - 1) * 3;
      t.set(
        centers[b] - centers[a],
        centers[b + 1] - centers[a + 1],
        centers[b + 2] - centers[a + 2],
      ).normalize();
      const i = Math.min(Math.floor(k / SUB), n - 2);
      const u = k / SUB - i;
      nor.set(
        pn[i * 3] * (1 - u) + pn[i * 3 + 3] * u,
        pn[i * 3 + 1] * (1 - u) + pn[i * 3 + 4] * u,
        pn[i * 3 + 2] * (1 - u) + pn[i * 3 + 5] * u,
      );
      nor.addScaledVector(t, -nor.dot(t)).normalize();
      bin.crossVectors(t, nor);
      t.toArray(tangents, k * 3);
      nor.toArray(frames, k * 6);
      bin.toArray(frames, k * 6 + 3);
    }

    const pos = this.geometry.attributes.position as THREE.BufferAttribute;
    const normals = this.geometry.attributes.normal as THREE.BufferAttribute;
    const colors = this.geometry.attributes.color as THREE.BufferAttribute;
    const uvs = this.geometry.attributes.uv as THREE.BufferAttribute;
    const center = new THREE.Vector3();
    const out = new THREE.Vector3();
    const st = new THREE.Vector3();
    const sn = new THREE.Vector3();
    const sb = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const col = [0, 0, 0];

    for (let s = 0; s < STRANDS; s++) {
      const phase = (2 * Math.PI * s) / STRANDS;
      for (let k = 0; k < m; k++) {
        const angle = (2 * Math.PI * lengths[k]) / pitch + phase;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        for (let c = 0; c < 3; c++) {
          const o = cos * frames[k * 6 + c] + sin * frames[k * 6 + 3 + c];
          outward[k * 3 + c] = o;
          axis[k * 3 + c] = centers[k * 3 + c] + o * d * this.endShape(k)[0];
        }
      }

      // Los anillos van: tapa inicial (punta primero), cuerpo, tapa final.
      for (let r = 0; r < this.rings; r++) {
        const k = r - CAP;
        const kk = Math.min(Math.max(k, 0), m - 1);
        const a = Math.max(kk - 1, 0) * 3;
        const b = Math.min(kk + 1, m - 1) * 3;
        st.set(axis[b] - axis[a], axis[b + 1] - axis[a + 1], axis[b + 2] - axis[a + 2]).normalize();
        out.fromArray(outward, kk * 3);
        // El marco del anillo mira hacia afuera del eje de la soga, así el lado interno oscuro queda adentro.
        sn.copy(out).addScaledVector(st, -out.dot(st)).normalize();
        sb.crossVectors(st, sn);
        center.fromArray(axis, kk * 3);

        let ringR = this.endShape(kk)[1];
        let tilt = 0;
        let along = lengths[kk];
        if (k < 0 || k >= m) {
          // Corte plano: los anillos de la tapa cierran el cordón en un disco que mira hacia afuera de la soga.
          const sign = k < 0 ? -1 : 1;
          ringR *= 1 - (k < 0 ? -k : k - m + 1) / CAP;
          tilt = (sign * Math.PI) / 2;
        }

        for (let j = 0; j <= RADIAL; j++) {
          const ang = (j / RADIAL) * Math.PI * 2;
          const cosA = Math.cos(ang);
          const sinA = Math.sin(ang);
          const v = (s * this.rings + r) * (RADIAL + 1) + j;
          pos.setXYZ(
            v,
            center.x + (sn.x * cosA * rs + sb.x * sinA * rw) * ringR,
            center.y + (sn.y * cosA * rs + sb.y * sinA * rw) * ringR,
            center.z + (sn.z * cosA * rs + sb.z * sinA * rw) * ringR,
          );
          // Normal de una elipse: cuanto más plano el costado, más mira hacia afuera.
          dir
            .copy(sn)
            .multiplyScalar(cosA / rs)
            .addScaledVector(sb, sinA / rw)
            .normalize();
          // Oclusión: los costados apretados contra los otros cordones quedan en una ranura oscura
          // y gris, y lo mismo pasa con lo que mira hacia otra soga en el nudo.
          const lit = Math.min(1, Math.max(0, 0.45 + 0.75 * dir.dot(out)));
          const x = center.x + (sn.x * cosA * rs + sb.x * sinA * rw) * ringR;
          const y = center.y + (sn.y * cosA * rs + sb.y * sinA * rw) * ringR;
          const z = center.z + (sn.z * cosA * rs + sb.z * sinA * rw) * ringR;
          const pi = Math.min(Math.round(kk / SUB), n - 1);
          // Mezclar las partículas de cada lado, así el sombreado no salta donde cambia la más cercana.
          const pa = Math.min(Math.floor(kk / SUB), n - 1);
          const pb = Math.min(pa + 1, n - 1);
          const f = kk / SUB - pa;
          const occ =
            (1 - f) * this.occlusion(p, pa, x, y, z, dir) + f * this.occlusion(p, pb, x, y, z, dir);
          // Los costados que miran a la luz principal conservan casi toda su luz: el shadow map los
          // oscurece si están tapados.
          const open = 1 - 0.65 * occ * (1 - 0.7 * Math.max(0, dir.dot(TO_LIGHT)));
          const worn = this.contact[pi] * 0.7;
          if (tilt !== 0) {
            // Cara cortada: extremos de fibra apretados, iluminados de frente, moteados de manojo
            // en manojo. El sombreado de ranura y de contacto es de los costados del cordón; acá
            // hacía que la cara se leyera como un agujero.
            const c = 0.82 + 0.18 * Math.abs((Math.sin(v * 12.9898) * 43758.5453) % 1);
            col[0] = col[1] = col[2] = c;
          } else
            for (let c = 0; c < 3; c++)
              col[c] = (GROOVE[c] + (1 - GROOVE[c]) * lit) * open * (1 - worn + worn * DIRT[c]);
          colors.setXYZ(v, col[0], col[1], col[2]);
          if (tilt !== 0) dir.multiplyScalar(Math.cos(tilt)).addScaledVector(st, Math.sin(tilt));
          normals.setXYZ(v, dir.x, dir.y, dir.z);
          // La cara cortada toma un solo punto de la textura: envolverla alrededor haría un
          // remolino hacia un punto.
          if (tilt !== 0) uvs.setXY(v, along / pitch, 0.5);
          else uvs.setXY(v, along / pitch, j / RADIAL);
        }
      }
    }
    pos.needsUpdate = true;
    normals.needsUpdate = true;
    colors.needsUpdate = true;
    uvs.needsUpdate = true;
    this.updateGround();
    this.updateSleeves();
    this.updateCutFaces();
    this.updateHairs(); // después de las caras cortadas: los mechones de las puntas crecen desde ahí
  }

  /** Ubica cada casquillo justo detrás de su punta quemada, alineado con la soga en ese lugar. */
  /** Apoya la cara cortada de cada cordón sobre su último anillo, apenas sobresaliente así nunca parpadea. */
  private updateCutFaces(): void {
    const { m, rings, tangents, radius } = this;
    const pos = this.geometry.attributes.position as THREE.BufferAttribute;
    const out = this.cutFaces.geometry.attributes.position as THREE.BufferAttribute;
    const nrm = this.cutFaces.geometry.attributes.normal as THREE.BufferAttribute;
    const perDisc = RADIAL + 2;
    const proud = 0.02 * radius;
    for (let end = 0; end < 2; end++) {
      const r = end === 0 ? CAP : CAP + m - 1;
      const t = end === 0 ? 0 : (m - 1) * 3;
      const sign = end === 0 ? -1 : 1; // la cara mira hacia afuera de la soga
      const nx = sign * tangents[t];
      const ny = sign * tangents[t + 1];
      const nz = sign * tangents[t + 2];
      for (let s = 0; s < STRANDS; s++) {
        const o = (end * STRANDS + s) * perDisc;
        const ring = (s * rings + r) * (RADIAL + 1);
        let cx = 0;
        let cy = 0;
        let cz = 0;
        for (let j = 0; j <= RADIAL; j++) {
          const x = pos.getX(ring + j) + nx * proud;
          const y = pos.getY(ring + j) + ny * proud;
          const z = pos.getZ(ring + j) + nz * proud;
          out.setXYZ(o + 1 + j, x, y, z);
          nrm.setXYZ(o + 1 + j, nx, ny, nz);
          if (j < RADIAL) {
            cx += x / RADIAL;
            cy += y / RADIAL;
            cz += z / RADIAL;
          }
        }
        out.setXYZ(o, cx, cy, cz);
        nrm.setXYZ(o, nx, ny, nz);
      }
    }
    out.needsUpdate = true;
    nrm.needsUpdate = true;
  }

  private updateSleeves(): void {
    const { m, centers, tangents, ds, radius } = this;
    // Posición exacta sobre el arco, entre muestras, así la punta que asoma más allá del borde es
    // tan corta como se configuró.
    const f = Math.min(((TIP + SLEEVE / 2) * radius) / ds, m - 2);
    const up = new THREE.Vector3(0, 1, 0);
    const t = new THREE.Vector3();
    const a = new THREE.Vector3();
    for (const [sleeve, kf] of [
      [this.sleeves[0], f],
      [this.sleeves[1], m - 1 - f],
    ] as const) {
      const k = Math.floor(kf);
      const u = kf - k;
      sleeve.position.fromArray(centers, k * 3).lerp(a.fromArray(centers, (k + 1) * 3), u);
      t.fromArray(tangents, k * 3)
        .lerp(a.fromArray(tangents, (k + 1) * 3), u)
        .normalize();
      sleeve.quaternion.setFromUnitVectors(up, t);
    }
  }

  /**
   * Qué tan lejos del eje de la soga quedan los cordones, y qué tan grandes son, cerca de las
   * puntas: apretados debajo del casquillo.
   */
  private endShape(k: number): [number, number] {
    const r = this.radius;
    const s = Math.min(k, this.m - 1 - k) * this.ds; // desde la punta cortada más cercana
    const ease = (a: number, b: number, x: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));
    // 1 adentro del casquillo, bajando suave a 0 un poco más allá de cada borde.
    // Apretada desde la punta cortada a través del casquillo, volviendo suave al tamaño completo
    // pasado su borde interno.
    const held = 1 - ease((TIP + SLEEVE) * r, (TIP + SLEEVE + 0.4) * r, s);
    const squeeze = 1 - (1 - SQUEEZE) * held;
    return [squeeze, squeeze];
  }

  /** Para cada partícula, las partículas cercanas de otra soga, y qué tan apretada está en el nudo. */
  private findContacts(p: Float32Array): void {
    const { n, nearCount, contact, radius } = this;
    const reach = 3.2 * radius;
    const skip = 4; // las vecinas a lo largo de la soga siempre se tocan; eso no es contacto
    nearCount.fill(0);
    contact.fill(0);
    for (let i = 0; i < n; i++)
      for (let j = i + skip; j < n; j++) {
        const d = Math.hypot(
          p[i * 3] - p[j * 3],
          p[i * 3 + 1] - p[j * 3 + 1],
          p[i * 3 + 2] - p[j * 3 + 2],
        );
        if (d > reach) continue;
        const press = Math.min(1, (reach - d) / (reach - 2 * radius));
        contact[i] = Math.min(1, contact[i] + 0.5 * press);
        contact[j] = Math.min(1, contact[j] + 0.5 * press);
        this.remember(i, j, d);
        this.remember(j, i, d);
      }
    // Repartido a lo largo de la soga, así el desgaste aparece y desaparece gradualmente en lugar
    // de cambiar por partícula.
    for (let pass = 0; pass < 2; pass++)
      for (let i = 1; i < n - 1; i++)
        contact[i] = Math.max(contact[i], (contact[i - 1] + contact[i + 1]) * 0.4);
  }

  /** Mantiene j entre las NEAR partes de otra soga más cercanas a i, descartando la más lejana cuando está lleno. */
  private remember(i: number, j: number, d: number): void {
    const { near, nearCount, nearDist } = this;
    const o = i * NEAR;
    let slot = nearCount[i];
    if (slot < NEAR) nearCount[i]++;
    else {
      slot = 0;
      for (let q = 1; q < NEAR; q++) if (nearDist[o + q] > nearDist[o + slot]) slot = q;
      if (nearDist[o + slot] <= d) return;
    }
    near[o + slot] = j;
    nearDist[o + slot] = d;
  }

  /**
   * Cuánto de la vista de un punto de la superficie está tapado por la soga cercana que tiene
   * enfrente (0 libre, 1 enterrado).
   */
  private occlusion(
    p: Float32Array,
    i: number,
    x: number,
    y: number,
    z: number,
    nrm: THREE.Vector3,
  ): number {
    const { near, nearCount, radius } = this;
    let occ = 0;
    for (let q = 0; q < nearCount[i]; q++) {
      const j = near[i * NEAR + q] * 3;
      const dx = p[j] - x;
      const dy = p[j + 1] - y;
      const dz = p[j + 2] - z;
      const d = Math.hypot(dx, dy, dz) || 1;
      const facing = (dx * nrm.x + dy * nrm.y + dz * nrm.z) / d;
      if (facing <= 0) continue;
      const u = Math.min(1, Math.max(0, (d - radius) / (1.5 * radius)));
      occ += facing * (1 - u * u * (3 - 2 * u)); // smoothstep: sin quiebre donde arranca la caída
    }
    // La mesa también ocluye la parte de abajo.
    occ += Math.max(0, -nrm.y) * Math.max(0, 1 - (y - 0) / (2 * radius)) * 0.6;
    return 1 - Math.exp(-1.6 * occ); // satura suave, así los lugares apretados se sombrean de a poco
  }

  private updateGround(): void {
    const { m, centers, tangents, radius } = this;
    const pos = this.ground.geometry.attributes.position as THREE.BufferAttribute;
    const col = this.ground.geometry.attributes.color as THREE.BufferAttribute;
    let px = 0;
    let pz = 0;
    for (let k = 0; k < m; k++) {
      const x = centers[k * 3];
      const z = centers[k * 3 + 2];
      const h = Math.max(0, centers[k * 3 + 1] - radius); // altura por encima de estar apoyada en la mesa
      let sx = -tangents[k * 3 + 2];
      let sz = tangents[k * 3];
      const l = Math.hypot(sx, sz) || 1;
      // Evitar que los costados de la franja se intercambien entre muestras, lo que dibuja abanicos finos.
      if (sx * px + sz * pz < 0) {
        sx = -sx;
        sz = -sz;
      }
      px = sx;
      pz = sz;
      // Más ancha y más tenue a medida que la soga se levanta: apretada y oscura donde casi toca.
      // Nunca más ancha que la curva que sigue, si no el borde interno se pliega en un abanico.
      const a = Math.max(k - 2, 0) * 3;
      const b = Math.min(k + 2, m - 1) * 3;
      const ax = tangents[a];
      const az = tangents[a + 2];
      const bx = tangents[b];
      const bz = tangents[b + 2];
      const turn = Math.acos(
        Math.min(1, (ax * bx + az * bz) / (Math.hypot(ax, az) * Math.hypot(bx, bz) || 1)),
      );
      const bend = turn > 1e-4 ? (((b - a) / 3) * this.ds) / turn : Infinity;
      const w = Math.min(radius * Math.min(1.8, 1.2 + h / radius), 0.7 * bend);
      sx = (sx / l) * w;
      sz = (sz / l) * w;
      // Donde la soga sube o baja de forma empinada su dirección lateral no es confiable: desvanecer.
      const alpha =
        0.38 * Math.max(0, 1 - h / (2 * radius)) * Math.min(1, Math.max(0, (l - 0.5) * 3));
      const o = k * 3;
      pos.setXYZ(o, x - sx, 0.0005, z - sz);
      pos.setXYZ(o + 1, x, 0.0005, z);
      pos.setXYZ(o + 2, x + sx, 0.0005, z + sz);
      col.setXYZW(o, 1, 1, 1, 0);
      col.setXYZW(o + 1, 1, 1, 1, alpha);
      col.setXYZW(o + 2, 1, 1, 1, 0);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  private updateHairs(): void {
    const pos = this.geometry.attributes.position as THREE.BufferAttribute;
    const nrm = this.geometry.attributes.normal as THREE.BufferAttribute;
    const start = this.hairs.geometry.attributes.instanceStart as THREE.InterleavedBufferAttribute;
    const out = start.data.array as Float32Array; // por segmento: xyz de inicio, xyz de fin
    const { hairRoot, hairShape, tangents, m, n, contact, bodyHairs, tuftAt } = this;
    const face = this.cutFaces.geometry.attributes.position as THREE.BufferAttribute;
    const faceNrm = this.cutFaces.geometry.attributes.normal as THREE.BufferAttribute;
    const perDisc = RADIAL + 2;
    const ringSize = RADIAL + 1;
    for (let h = 0; h < hairRoot.length; h++) {
      const v = hairRoot[h];
      const tuft = h >= bodyHairs;
      const disc = tuft ? tuftAt[(h - bodyHairs) * 3] : 0;
      const k = tuft
        ? disc < STRANDS
          ? 0
          : m - 1
        : Math.min(Math.max((Math.floor(v / ringSize) % this.rings) - CAP, 0), m - 1);
      const [base, lean, curl, side, rise] = hairShape.subarray(h * 5, h * 5 + 5);
      // La soga que roza en el nudo tiene un poco más de pelusa.
      const len = base * (0.9 + 0.3 * contact[Math.min(Math.round(k / SUB), n - 1)]);
      let px: number;
      let py: number;
      let pz: number;
      let nx: number;
      let ny: number;
      let nz: number;
      if (tuft) {
        // Un punto sobre la cara cortada: entre dos vértices del borde, a cierta distancia del centro.
        const a = tuftAt[(h - bodyHairs) * 3 + 1];
        const rho = tuftAt[(h - bodyHairs) * 3 + 2];
        const o = disc * perDisc;
        const j = Math.floor(a);
        const f = a - j;
        const rim = (c: number) =>
          face.getComponent(o + 1 + j, c) * (1 - f) + face.getComponent(o + 2 + j, c) * f;
        px = face.getX(o) + (rim(0) - face.getX(o)) * rho;
        py = face.getY(o) + (rim(1) - face.getY(o)) * rho;
        pz = face.getZ(o) + (rim(2) - face.getZ(o)) * rho;
        nx = faceNrm.getX(o);
        ny = faceNrm.getY(o);
        nz = faceNrm.getZ(o);
      } else {
        px = pos.getX(v);
        py = pos.getY(v);
        pz = pos.getZ(v);
        nx = nrm.getX(v);
        ny = nrm.getY(v);
        nz = nrm.getZ(v);
      }
      const tx = tangents[k * 3];
      const ty = tangents[k * 3 + 1];
      const tz = tangents[k * 3 + 2];
      // Hacia el costado: perpendicular a la soga y a la normal de la superficie, para fibras en ángulos al azar.
      let bx = ny * tz - nz * ty;
      let by = nz * tx - nx * tz;
      let bz = nx * ty - ny * tx;
      if (bx * bx + by * by + bz * bz < 0.04) {
        // En una cara cortada la normal va a lo largo de la soga; abrir contra el arriba de la mesa en cambio.
        const l = Math.hypot(nz, nx) || 1;
        bx = -nz / l;
        by = 0;
        bz = nx / l;
      }
      // Hacia afuera de la superficie e inclinada a lo largo de la soga; la punta se dobla un poco más.
      const mx = px + (nx * rise + tx * lean + bx * side) * len * 0.5;
      const my = py + (ny * rise + ty * lean + by * side) * len * 0.5;
      const mz = pz + (nz * rise + tz * lean + bz * side) * len * 0.5;
      const ex =
        mx + (nx * rise * (1 - Math.abs(curl)) + tx * (lean + curl) + bx * side) * len * 0.5;
      const ey =
        my + (ny * rise * (1 - Math.abs(curl)) + ty * (lean + curl) + by * side) * len * 0.5;
      const ez =
        mz + (nz * rise * (1 - Math.abs(curl)) + tz * (lean + curl) + bz * side) * len * 0.5;
      // La raíz arranca justo debajo de la superficie, así la fibra crece desde el cordón.
      const sink = 0.25 * len;
      out.set(
        [px - nx * sink, py - ny * sink, pz - nz * sink, mx, my, mz, mx, my, mz, ex, ey, ez],
        h * 12,
      );
    }
    start.data.needsUpdate = true;
  }
}
