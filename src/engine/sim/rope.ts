import type { Guide, KnotDef, Prop, RopeDef, Vec3 } from "../knots/types";

/** Cuadros por segundo de la línea de tiempo bakeada. */
export const FPS = 60;
const SUBSTEPS = 24;
const H = 1 / (FPS * SUBSTEPS);
const GRAVITY = 9.81;
const BLOCK = 8; // partículas por caja de la broad phase en el test de colisiones
const CONTACT_ROUNDS = 4; // menos deja que un tirón fuerte haga pasar la soga a través de la soga adentro del nudo
// Inercia rotacional de cada segmento, inflada por encima del m·r²/4 real: el valor real hace que
// el modo de flexión rígido vibre más rápido de lo que el subpaso puede seguir, y eso se ve como temblor.
const SEG_INERTIA = 1e-5; // kg·m²
// Las guías son resortes rígidos, nunca pines duros, así una guía que pide más soga de la que hay
// se atrasa en lugar de estirarla.
const GUIDE_COMPLIANCE = 2.5e-4;
const RELEASE = 0.3; // segundos que tarda una guía en soltar
const GUIDE_MAX_FORCE = 10; // N: suficiente para levantar una soga rígida, no para arrastrarla por la mesa

/**
 * De qué está hecha la soga. El laboratorio (`?tune`) los sobrescribe; los nudos se ajustan con los
 * valores por defecto.
 */
export interface RopePhysics {
  /** kg de una soga entera: pesada para su tamaño, así cae y se acomoda como una soga gruesa de algodón. */
  mass: number;
  /** Rigidez a la flexión EI, N·m². */
  bend: number;
  /**
   * Rigidez a la torsión GJ, N·m²: mayor que EI, porque los cordones retorcidos se resisten más a
   * torcerse que a doblarse.
   */
  twist: number;
  /** Un solo coeficiente para pegarse y deslizarse, así los contactos nunca se traban y sueltan a los saltos. */
  friction: number;
  /** Amortiguación del aire, 1/s. */
  airDamping: number;
  /**
   * Fracción de la velocidad de cada partícula que se lleva hacia la de sus vecinas en cada
   * subpaso: fricción interna que elimina el bamboleo a lo largo de la soga sin frenar la soga entera.
   */
  internalDamping: number;
}

// Soga colchada de algodón: lo bastante blanda para caer y doblarse apretada, pesada y bien
// amortiguada para que se acomode en lugar de rebotar. Elegida a ojo en el laboratorio el
// 2026-10-31; las guías de los nudos se escribieron sobre una soga más rígida (EI 0.03, 1 kg) y
// puede que haya que reajustarlas.
export const DEFAULT_PHYSICS: RopePhysics = {
  mass: 2.2,
  bend: 0.01,
  twist: 0.013,
  friction: 0.6,
  airDamping: 15,
  internalDamping: 0.2,
};

/** Partículas a lo largo de la soga. Un espaciado menor que el radio no deja hueco para que otra soga se cuele. */
export function particleCount(rope: RopeDef): number {
  return Math.ceil(rope.length / (0.8 * rope.radius)) + 1;
}

/**
 * Una mano que el grabador mueve en vivo: tira de una partícula hacia `target` como una guía. Desde
 * `release` en adelante, suelta durante el mismo momento que tarda una guía en su última key.
 */
export interface Hand {
  index: number;
  target: Vec3;
  force?: number;
  compliance?: number;
  release?: number;
}

/** Todo lo que pasa de un cuadro al siguiente, para poder volver ahí (el deshacer del grabador). */
export interface SimState {
  x: number[];
  v: number[];
  q: number[];
  om: number[];
  time: number;
  flip: boolean;
}

interface GuideState {
  def: Guide;
  index: number;
  times: number[];
  points: Vec3[] | null; // se completa cuando la guía agarra
  target: Vec3 | null; // null mientras está inactiva
  handsOff: boolean; // otra guía toma este punto cuando termina esta, así que mantener un agarre firme
}

interface PropState extends Pick<Prop, "kind" | "a" | "radius"> {
  u: Vec3; // eje unitario
  len: number;
}

/**
 * La soga como una varilla de Cosserat resuelta con XPBD de pasos chicos: partículas unidas por
 * segmentos que llevan cada uno una orientación, así la flexión y la torsión son torques reales
 * entre segmentos (varillas de Cosserat basadas en posiciones, Kugelstadt y Schömer 2016). Más
 * autocolisión con fricción de Coulomb y una mesa con fricción. Determinista.
 *
 * Varias sogas comparten los arrays de partículas y de segmentos, una después de la otra. Un
 * segmento j une las partículas j y j+1, salvo que `end[j]` marque a j como la última de su soga:
 * un corte, que ninguna regla de estiramiento, flexión, largo o salto de colisión cruza. Los props
 * son cápsulas y cilindros fijos.
 */
export class RopeSim {
  /** Partículas de todas las sogas juntas. */
  readonly n: number;
  /** Dónde quedan las partículas de cada soga en `x`. */
  readonly ropes: { start: number; count: number }[] = [];
  readonly x: Float64Array;
  time = 0;
  private flip = false;
  private readonly prev: Float64Array;
  private readonly v: Float64Array;
  private readonly w: Float64Array;
  /**
   * Masa inversa que ve el cálculo de largos: una partícula agarrada está anclada por la mano, así
   * que se mueve menos.
   */
  private readonly wHeld: Float64Array;
  // Memoria temporal para el cálculo de largos, una entrada por eslabón.
  private readonly dir: Float64Array;
  private readonly rhs: Float64Array;
  private readonly cp: Float64Array;
  private readonly lam: Float64Array;
  /**
   * Orientaciones de los segmentos como cuaterniones (x, y, z, w); el z local de cada segmento va a
   * lo largo de la soga.
   */
  private readonly q: Float64Array;
  private readonly qPrev: Float64Array;
  private readonly om: Float64Array; // velocidad angular del segmento, en el marco del cuerpo
  private readonly radii: Float64Array; // por partícula
  private readonly spacings: Float64Array; // por segmento
  private readonly rope: Int32Array; // por partícula: a qué soga pertenece
  private readonly end: Uint8Array; // por partícula: 1 si es la última de su soga
  private readonly skips: number[]; // por soga
  private readonly boxes: Float64Array; // por bloque de BLOCK partículas: xyz mínimo (menos un margen), xyz máximo
  private readonly maxRadius: number;
  private readonly props: PropState[];
  private readonly guides: GuideState[];
  /** Manos en vivo (el grabador); el bakeo de un nudo nunca tiene. */
  readonly hands = new Set<Hand>();

  constructor(
    knot: KnotDef,
    private readonly physics: RopePhysics = DEFAULT_PHYSICS,
  ) {
    const counts = knot.ropes.map(particleCount);
    const n = (this.n = counts.reduce((sum, c) => sum + c, 0));
    this.x = new Float64Array(n * 3);
    this.w = new Float64Array(n);
    this.radii = new Float64Array(n);
    this.spacings = new Float64Array(n);
    this.rope = new Int32Array(n);
    this.end = new Uint8Array(n);
    this.q = new Float64Array((n - 1) * 4);
    for (let j = 0; j < n - 1; j++) this.q[j * 4 + 3] = 1;
    this.skips = [];
    this.boxes = new Float64Array(Math.ceil(n / BLOCK) * 6);
    this.maxRadius = Math.max(...knot.ropes.map((r) => r.radius));
    let start = 0;
    knot.ropes.forEach((def, k) => {
      const count = counts[k];
      const spacing = def.length / (count - 1);
      // Las partículas a menos de un diámetro a lo largo de la soga siempre se tocan, así que nunca colisionan.
      this.skips.push(Math.ceil((2 * def.radius) / spacing));
      this.ropes.push({ start, count });
      const pts = layOut(def, count);
      for (let i = 0; i < count; i++) {
        const p = start + i;
        this.x.set(pts[i], p * 3);
        this.w[p] = count / physics.mass;
        this.radii[p] = def.radius;
        this.spacings[p] = spacing;
        this.rope[p] = k;
        if (i === count - 1) this.end[p] = 1;
        else turnZ(this.q, p * 4, pts[i], pts[i + 1]);
      }
      start += count;
    });
    this.prev = this.x.slice();
    this.v = new Float64Array(n * 3);
    this.wHeld = this.w.slice();
    this.dir = new Float64Array((n - 1) * 3);
    this.rhs = new Float64Array(n - 1);
    this.cp = new Float64Array(n - 1);
    this.lam = new Float64Array(n - 1);
    this.qPrev = this.q.slice();
    this.om = new Float64Array((n - 1) * 3);
    this.props = (knot.props ?? []).map(({ kind, a, b, radius }) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      return {
        kind,
        a,
        radius,
        len,
        u: [(b[0] - a[0]) / len, (b[1] - a[1]) / len, (b[2] - a[2]) / len],
      };
    });
    this.guides = knot.guides.map((def) => ({
      def,
      index:
        this.ropes[def.rope ?? 0].start +
        Math.round(def.at * (this.ropes[def.rope ?? 0].count - 1)),
      times: [def.grab, ...def.path.map((k) => k.t)],
      points: null,
      target: null,
      handsOff: false,
    }));
    for (const g of this.guides) {
      const end = g.times[g.times.length - 1];
      g.handsOff = this.guides.some(
        (o) => o !== g && o.index === g.index && Math.abs(o.times[0] - end) < 0.05,
      );
    }
  }

  /** El estado que se mueve, como números planos para poder guardarlo. Las manos las guarda quien llama. */
  save(): SimState {
    const { x, v, q, om, time, flip } = this;
    return { x: [...x], v: [...v], q: [...q], om: [...om], time, flip };
  }

  /** Vuelve a un estado guardado de una simulación de las mismas sogas. */
  restore(state: SimState): void {
    this.x.set(state.x);
    this.v.set(state.v);
    this.q.set(state.q);
    this.om.set(state.om);
    this.time = state.time;
    this.flip = state.flip;
  }

  /** Avanza un cuadro (1 / FPS segundos). */
  step(): void {
    for (let s = 0; s < SUBSTEPS; s++) this.substep();
  }

  private substep(): void {
    const { n, x, prev, v } = this;
    this.time += H;
    this.updateGuides();

    const damp = Math.exp(-this.physics.airDamping * H);
    for (let i = 0; i < n * 3; i += 3) {
      prev[i] = x[i];
      prev[i + 1] = x[i + 1];
      prev[i + 2] = x[i + 2];
      v[i + 1] -= GRAVITY * H;
      x[i] += v[i] * damp * H;
      x[i + 1] += v[i + 1] * damp * H;
      x[i + 2] += v[i + 2] * damp * H;
    }

    const { q, qPrev, om } = this;
    for (let j = 0; j < n - 1; j++) {
      const o = j * 4;
      for (let c = 0; c < 4; c++) qPrev[o + c] = q[o + c];
      const v = j * 3;
      // q += h/2 · q ⊗ (0, ω)
      addMul(q, o, q, o, om[v] * damp, om[v + 1] * damp, om[v + 2] * damp, 0.5 * H);
      normalize(q, o);
    }

    this.solveGuides();
    // Alternar la dirección en cada subpaso: un barrido en un solo sentido sesga las curvas
    // cerradas a empujar la soga a lo largo de sí misma, lo que hace correr la soga a través del nudo.
    if (this.flip) for (let j = n - 3; j >= 0; j--) this.solveBendTwist(j);
    else for (let j = 0; j < n - 2; j++) this.solveBendTwist(j);
    if (this.flip) for (let j = n - 2; j >= 0; j--) this.solveStretchShear(j);
    else for (let j = 0; j < n - 1; j++) this.solveStretchShear(j);
    this.flip = !this.flip;
    // Largo y contacto se turnan: el contacto adentro de un nudo apretado separa la soga.
    for (let round = 0; round < CONTACT_ROUNDS; round++) {
      this.solveLengths();
      this.solveLengths(); // un segundo paso de Newton para los eslabones que giraron mucho en este subpaso
      this.solveCollisions();
    }
    this.solveGround();
    this.solveProps();

    for (let i = 0; i < n * 3; i++) v[i] = (x[i] - prev[i]) / H;
    for (let j = 0; j < n - 1; j++) {
      // ω = 2·Im(q̄prev ⊗ q) / h, tomando el camino más corto
      const r = relative(qPrev, j * 4, q, j * 4);
      const sgn = r[3] < 0 ? -2 / H : 2 / H;
      om[j * 3] = r[0] * sgn;
      om[j * 3 + 1] = r[1] * sgn;
      om[j * 3 + 2] = r[2] * sgn;
    }
    for (let p = 1; p < n - 1; p++) {
      if (this.end[p] || this.end[p - 1]) continue; // la punta de una soga no tiene vecina de un lado
      for (let i = p * 3; i < p * 3 + 3; i++)
        v[i] += this.physics.internalDamping * ((v[i - 3] + v[i + 3]) / 2 - v[i]);
    }
  }

  /** Flexión y torsión entre los segmentos j y j+1: lleva su rotación relativa a cero. */
  private solveBendTwist(j: number): void {
    if (this.end[j] || this.end[j + 1]) return;
    const { q } = this;
    const a = j * 4;
    const b = a + 4;
    const r = relative(q, a, q, b); // Vector de Darboux Ω = Im(q̄a ⊗ qb) ≈ curvatura·ds/2
    const sgn = r[3] < 0 ? -1 : 1;
    // La energía EI/2·κ²·ds con Ω = κ·ds/2 da una compliance de ds / (4·EI) sobre Ω. Girar
    // cualquiera de los dos segmentos un ángulo θ mueve Ω en θ/2, así que cada uno cuenta como masa
    // inversa 1 / (4·I).
    const ds = this.spacings[j];
    const wsum = 2 / (4 * SEG_INERTIA);
    const bend = ds / (4 * this.physics.bend) / (H * H);
    const twist = ds / (4 * this.physics.twist) / (H * H);
    const lx = (-sgn * r[0]) / (wsum + bend);
    const ly = (-sgn * r[1]) / (wsum + bend);
    const lz = (-sgn * r[2]) / (wsum + twist);
    const k = 1 / (4 * SEG_INERTIA);
    addMul(q, b, q, b, lx, ly, lz, k);
    addMul(q, a, q, a, lx, ly, lz, -k);
    normalize(q, a);
    normalize(q, b);
  }

  /**
   * Mantiene la orientación del segmento j apuntando a lo largo de la soga, lo que traslada la
   * flexión a las partículas.
   */
  private solveStretchShear(j: number): void {
    if (this.end[j]) return;
    const { x, w, q } = this;
    const pa = j * 3;
    const pb = pa + 3;
    const o = j * 4;
    const [qx, qy, qz, qw] = [q[o], q[o + 1], q[o + 2], q[o + 3]];
    // d3: el z local del segmento en el mundo
    const d0 = 2 * (qx * qz + qw * qy);
    const d1 = 2 * (qy * qz - qw * qx);
    const d2 = qw * qw - qx * qx - qy * qy + qz * qz;
    const ds = this.spacings[j];
    const g0 = (x[pb] - x[pa]) / ds - d0;
    const g1 = (x[pb + 1] - x[pa + 1]) / ds - d1;
    const g2 = (x[pb + 2] - x[pa + 2]) / ds - d2;
    const wsum = (w[j] + w[j + 1]) / (ds * ds) + 1 / SEG_INERTIA;
    const l0 = -g0 / wsum;
    const l1 = -g1 / wsum;
    const l2 = -g2 / wsum;
    const ka = w[j] / ds;
    const kb = w[j + 1] / ds;
    x[pa] -= l0 * ka;
    x[pa + 1] -= l1 * ka;
    x[pa + 2] -= l2 * ka;
    x[pb] += l0 * kb;
    x[pb + 1] += l1 * kb;
    x[pb + 2] += l2 * kb;
    // La rotación en el mundo λ × d3 / I gira d3 hacia la soga; q += ½ (0, θ) ⊗ q.
    const t0 = (l1 * d2 - l2 * d1) / SEG_INERTIA / 2;
    const t1 = (l2 * d0 - l0 * d2) / SEG_INERTIA / 2;
    const t2 = (l0 * d1 - l1 * d0) / SEG_INERTIA / 2;
    q[o] += qw * t0 + t1 * qz - t2 * qy;
    q[o + 1] += qw * t1 + t2 * qx - t0 * qz;
    q[o + 2] += qw * t2 + t0 * qy - t1 * qx;
    q[o + 3] -= t0 * qx + t1 * qy + t2 * qz;
    normalize(q, o);
  }

  private updateGuides(): void {
    for (const g of this.guides) {
      const { times } = g;
      if (this.time < times[0] || this.time > times[times.length - 1]) {
        g.target = null;
        continue;
      }
      if (!g.points) {
        const i = g.index * 3;
        const points: Vec3[] = [[this.x[i], this.x[i + 1], this.x[i + 2]]];
        for (const k of g.def.path) points.push(k.p ?? points[points.length - 1]);
        g.points = points;
      }
      g.target = sampleHermite(times, g.points, this.time);
    }
  }

  private solveGuides(): void {
    this.wHeld.set(this.w);
    for (const g of this.guides) {
      if (!g.target) continue;
      // En los últimos momentos el agarre se afloja, como dedos que se abren, así la tensión se va suave.
      const left = (g.times[g.times.length - 1] - this.time) / RELEASE;
      const grip = g.handsOff ? 1 : Math.min(1, Math.max(left, 0)) ** 2 + 1e-6;
      this.pull(g.index, g.target, grip, g.def.compliance, g.def.force);
    }
    for (const hand of this.hands) {
      const left = hand.release === undefined ? 1 : (hand.release - this.time) / RELEASE;
      if (left <= 0) this.hands.delete(hand);
      else
        this.pull(
          hand.index,
          hand.target,
          Math.min(1, left) ** 2 + 1e-6,
          hand.compliance,
          hand.force,
        );
    }
  }

  /**
   * El tirón de una guía sobre la partícula p hacia `target`, con `grip` 1 para una mano firme y
   * cerca de 0 al soltar.
   */
  private pull(
    p: number,
    target: Vec3,
    grip: number,
    compliance = GUIDE_COMPLIANCE,
    force = GUIDE_MAX_FORCE,
  ): void {
    const { x, w, wHeld } = this;
    const i = p * 3;
    const alpha = compliance / grip / (H * H);
    let k = w[p] / (w[p] + alpha);
    const dx = target[0] - x[i];
    const dy = target[1] - x[i + 1];
    const dz = target[2] - x[i + 2];
    // Una mano tira con fuerza limitada: un objetivo al que la soga no puede llegar hace que la
    // guía se atrase en lugar de dar un tirón a toda la soga.
    const reach = force * w[p] * H * H;
    const step = Math.hypot(dx, dy, dz) * k;
    if (step > reach) k *= reach / step;
    else wHeld[p] = (w[p] * alpha) / (w[p] + alpha);
    x[i] += dx * k;
    x[i + 1] += dy * k;
    x[i + 2] += dz * k;
  }

  /**
   * El largo de todos los eslabones en un solo cálculo directo. Los eslabones forman una cadena,
   * así que el sistema es tridiagonal y se resuelve en tiempo lineal (algoritmo de Thomas). A
   * diferencia de las pasadas eslabón por eslabón, no puede quedarse atrás, así que incluso un
   * tirón fuerte le deja a la soga su largo (según Deul et al. 2018).
   */
  private solveLengths(): void {
    const { n, x, wHeld: w, dir, rhs, cp, lam, spacings, end } = this;
    const m = n - 1;
    for (let i = 0; i < m; i++) {
      const a = i * 3;
      const dx = x[a + 3] - x[a];
      const dy = x[a + 4] - x[a + 1];
      const dz = x[a + 5] - x[a + 2];
      const d = Math.hypot(dx, dy, dz) || 1e-12;
      dir[a] = dx / d;
      dir[a + 1] = dy / d;
      dir[a + 2] = dz / d;
      rhs[i] = end[i] ? 0 : spacings[i] - d; // ningún eslabón cruza un corte
    }
    // Barrido hacia adelante. Diagonal w_i + w_i+1; los eslabones i e i+1 comparten la partícula i+1.
    let prevC = 0;
    let prevD = 0;
    for (let i = 0; i < m; i++) {
      const a = i * 3;
      const off =
        i > 0 && !end[i - 1] && !end[i]
          ? -w[i] * (dir[a] * dir[a - 3] + dir[a + 1] * dir[a - 2] + dir[a + 2] * dir[a - 1])
          : 0;
      const den = w[i] + w[i + 1] - off * prevC;
      const up =
        i < m - 1 && !end[i] && !end[i + 1]
          ? -w[i + 1] * (dir[a] * dir[a + 3] + dir[a + 1] * dir[a + 4] + dir[a + 2] * dir[a + 5])
          : 0;
      prevC = cp[i] = up / den;
      prevD = lam[i] = (rhs[i] - off * prevD) / den;
    }
    for (let i = m - 2; i >= 0; i--) lam[i] -= cp[i] * lam[i + 1];
    for (let j = 0; j < n; j++) {
      const o = j * 3;
      for (let c = 0; c < 3; c++) {
        let g = 0;
        if (j < m) g -= dir[o + c] * lam[j];
        if (j > 0) g += dir[o - 3 + c] * lam[j - 1];
        x[o + c] += w[j] * g;
      }
    }
  }

  private solveCollisions(): void {
    const { n, x, prev, w, radii, rope, skips, boxes } = this;
    // Broad phase: una caja alrededor de cada bloque de BLOCK partículas, agrandada con un margen
    // que cubre la distancia de contacto más los empujones durante esta pasada. Los pares se siguen
    // visitando en el mismo orden, así que los resultados son idénticos al test O(n²) común, solo
    // que sin los bloques muy separados.
    // atajo: sigue siendo O(n²) en bloques, alcanza para unos pocos cientos de partículas; agregá
    // un hash espacial para muchas más.
    const margin = 4 * this.maxRadius;
    for (let k = 0, a = 0; a < n; k += 6, a += BLOCK) {
      boxes.fill(Infinity, k, k + 3);
      boxes.fill(-Infinity, k + 3, k + 6);
      for (let i = a; i < Math.min(a + BLOCK, n); i++)
        for (let c = 0; c < 3; c++) {
          boxes[k + c] = Math.min(boxes[k + c], x[i * 3 + c] - margin);
          boxes[k + 3 + c] = Math.max(boxes[k + 3 + c], x[i * 3 + c]);
        }
    }
    const far = (p: number, q: number) =>
      boxes[p] > boxes[q + 3] ||
      boxes[q] > boxes[p + 3] ||
      boxes[p + 1] > boxes[q + 4] ||
      boxes[q + 1] > boxes[p + 4] ||
      boxes[p + 2] > boxes[q + 5] ||
      boxes[q + 2] > boxes[p + 5];
    for (let a = 0; a < n; a++) {
      const ia = a * 3;
      const boxA = Math.floor(a / BLOCK) * 6;
      for (let b = a + 1; b < n; b++) {
        if (b % BLOCK === 0 && far(boxA, (b / BLOCK) * 6)) {
          b += BLOCK - 1;
          continue;
        }
        if (rope[a] === rope[b] && b - a < skips[rope[a]]) continue;
        const minD = radii[a] + radii[b];
        const ib = b * 3;
        const dx = x[ia] - x[ib];
        const dy = x[ia + 1] - x[ib + 1];
        const dz = x[ia + 2] - x[ib + 2];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= minD * minD || d2 === 0) continue;
        const wsum = w[a] + w[b];
        if (wsum === 0) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        const nz = dz / d;
        const pen = minD - d;
        const ka = w[a] / wsum;
        const kb = w[b] / wsum;
        x[ia] += nx * pen * ka;
        x[ia + 1] += ny * pen * ka;
        x[ia + 2] += nz * pen * ka;
        x[ib] -= nx * pen * kb;
        x[ib + 1] -= ny * pen * kb;
        x[ib + 2] -= nz * pen * kb;

        // Fricción: cancelar el deslizamiento relativo en este subpaso, hasta el límite de Coulomb.
        let rx = x[ia] - prev[ia] - (x[ib] - prev[ib]);
        let ry = x[ia + 1] - prev[ia + 1] - (x[ib + 1] - prev[ib + 1]);
        let rz = x[ia + 2] - prev[ia + 2] - (x[ib + 2] - prev[ib + 2]);
        const rn = rx * nx + ry * ny + rz * nz;
        rx -= rn * nx;
        ry -= rn * ny;
        rz -= rn * nz;
        const f = this.frictionFactor(Math.hypot(rx, ry, rz), pen);
        x[ia] -= rx * f * ka;
        x[ia + 1] -= ry * f * ka;
        x[ia + 2] -= rz * f * ka;
        x[ib] += rx * f * kb;
        x[ib + 1] += ry * f * kb;
        x[ib + 2] += rz * f * kb;
      }
    }
  }

  private solveGround(): void {
    const { n, x, prev, radii } = this;
    for (let a = 0; a < n; a++) {
      const i = a * 3;
      const radius = radii[a];
      if (x[i + 1] >= radius) continue;
      const pen = radius - x[i + 1];
      x[i + 1] = radius;
      const rx = x[i] - prev[i];
      const rz = x[i + 2] - prev[i + 2];
      const f = this.frictionFactor(Math.hypot(rx, rz), pen);
      x[i] -= rx * f;
      x[i + 2] -= rz * f;
    }
  }

  /** Empuja la soga hacia afuera de los props y deja que la fricción la sostenga, como hace la mesa. */
  private solveProps(): void {
    const { n, x, prev, radii } = this;
    for (const { kind, a, u, len, radius } of this.props) {
      for (let p = 0; p < n; p++) {
        const i = p * 3;
        const px = x[i] - a[0];
        const py = x[i + 1] - a[1];
        const pz = x[i + 2] - a[2];
        const t = px * u[0] + py * u[1] + pz * u[2];
        const s = Math.min(Math.max(t, 0), len);
        // Punto más cercano del núcleo del prop: sobre el eje para una cápsula (que entonces toma
        // el radio como su separación), el sólido mismo para un cilindro.
        let cx = s * u[0];
        let cy = s * u[1];
        let cz = s * u[2];
        let gap = radii[p];
        if (kind === "capsule") gap += radius;
        else {
          const rx = px - t * u[0];
          const ry = py - t * u[1];
          const rz = pz - t * u[2];
          const k = Math.min(1, radius / Math.hypot(rx, ry, rz));
          cx += rx * k;
          cy += ry * k;
          cz += rz * k;
        }
        const ox = px - cx;
        const oy = py - cy;
        const oz = pz - cz;
        const d = Math.hypot(ox, oy, oz);
        // atajo: una partícula justo sobre el núcleo no tiene dirección de empuje y se deja tranquila.
        if (d >= gap || d === 0) continue;
        const pen = gap - d;
        const nx = ox / d;
        const ny = oy / d;
        const nz = oz / d;
        x[i] += nx * pen;
        x[i + 1] += ny * pen;
        x[i + 2] += nz * pen;
        let sx = x[i] - prev[i];
        let sy = x[i + 1] - prev[i + 1];
        let sz = x[i + 2] - prev[i + 2];
        const sn = sx * nx + sy * ny + sz * nz;
        sx -= sn * nx;
        sy -= sn * ny;
        sz -= sn * nz;
        const f = this.frictionFactor(Math.hypot(sx, sy, sz), pen);
        x[i] -= sx * f;
        x[i + 1] -= sy * f;
        x[i + 2] -= sz * f;
      }
    }
  }

  /** Fracción del deslizamiento tangencial a cancelar, según qué tan fuerte empujó el contacto. */
  private frictionFactor(slide: number, push: number): number {
    if (slide === 0) return 0;
    return Math.min(1, (this.physics.friction * push) / slide);
  }
}

/** Puntos con espaciado parejo a lo largo de la polilínea inicial de la soga. */
function layOut(rope: RopeDef, count: number): Vec3[] {
  const { start } = rope;
  const lens = start.slice(1).map((b, k) => Math.hypot(...b.map((c, i) => c - start[k][i])));
  if (Math.abs(lens.reduce((a, b) => a + b, 0) - rope.length) > 0.01 * rope.length)
    throw new Error("la polilínea inicial de una soga tiene que ser tan larga como la soga");
  const spacing = rope.length / (count - 1);
  let k = 0;
  let s0 = 0;
  return Array.from({ length: count }, (_, i) => {
    const s = i * spacing;
    while (k < lens.length - 1 && s > s0 + lens[k]) s0 += lens[k++];
    const [a, b] = [start[k], start[k + 1]];
    return a.map((c, j) => c + ((b[j] - c) / lens[k]) * (s - s0)) as Vec3;
  });
}

/** Escribe en q[o] la rotación más corta que lleva el z local a la dirección de a hacia b. */
function turnZ(q: Float64Array, o: number, a: Vec3, b: Vec3): void {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const l = Math.hypot(...d);
  const dz = d[2] / l;
  // z × d, con el semiángulo w; justo en contra de z, cualquier giro alrededor de x sirve.
  [q[o], q[o + 1], q[o + 2], q[o + 3]] =
    dz < -1 + 1e-9 ? [1, 0, 0, 0] : [-d[1] / l, d[0] / l, 0, 1 + dz];
  normalize(q, o);
}

/**
 * Camino suave a través de las keys: arranca y termina en reposo, y se frena en seco en los puntos
 * repetidos (esperas).
 */
export function sampleHermite(times: number[], points: Vec3[], t: number): Vec3 {
  const last = times.length - 1;
  let k = 0;
  while (k < last - 1 && t > times[k + 1]) k++;
  if (last === 0) return [...points[0]];
  const dt = times[k + 1] - times[k];
  const u = dt > 0 ? Math.min(1, Math.max(0, (t - times[k]) / dt)) : 1;
  const m1 = velocity(times, points, k);
  const m2 = velocity(times, points, k + 1);
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  const p1 = points[k];
  const p2 = points[k + 1];
  return [0, 1, 2].map(
    (c) => h00 * p1[c] + h10 * dt * m1[c] + h01 * p2[c] + h11 * dt * m2[c],
  ) as Vec3;
}

function velocity(times: number[], points: Vec3[], k: number): Vec3 {
  const last = times.length - 1;
  if (k === 0 || k === last) return [0, 0, 0];
  const [a, p, b] = [points[k - 1], points[k], points[k + 1]];
  if (same(a, p) || same(p, b)) return [0, 0, 0];
  const dt = times[k + 1] - times[k - 1];
  return [(b[0] - a[0]) / dt, (b[1] - a[1]) / dt, (b[2] - a[2]) / dt];
}

function same(a: Vec3, b: Vec3): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/** Im y Re de q̄a ⊗ qb, como [x, y, z, w]. */
function relative(qa: Float64Array, a: number, qb: Float64Array, b: number): number[] {
  const [ax, ay, az, aw] = [-qa[a], -qa[a + 1], -qa[a + 2], qa[a + 3]];
  const [bx, by, bz, bw] = [qb[b], qb[b + 1], qb[b + 2], qb[b + 3]];
  return [
    aw * bx + bw * ax + ay * bz - az * by,
    aw * by + bw * ay + az * bx - ax * bz,
    aw * bz + bw * az + ax * by - ay * bx,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/** out[o] += s · q[p] ⊗ (0, v): gira q con una rotación en el marco del cuerpo. */
function addMul(
  out: Float64Array,
  o: number,
  q: Float64Array,
  p: number,
  vx: number,
  vy: number,
  vz: number,
  s: number,
): void {
  const [x, y, z, w] = [q[p], q[p + 1], q[p + 2], q[p + 3]];
  out[o] += s * (w * vx + y * vz - z * vy);
  out[o + 1] += s * (w * vy + z * vx - x * vz);
  out[o + 2] += s * (w * vz + x * vy - y * vx);
  out[o + 3] -= s * (x * vx + y * vy + z * vz);
}

function normalize(q: Float64Array, o: number): void {
  const l = Math.hypot(q[o], q[o + 1], q[o + 2], q[o + 3]);
  q[o] /= l;
  q[o + 1] /= l;
  q[o + 2] /= l;
  q[o + 3] /= l;
}
