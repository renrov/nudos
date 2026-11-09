/**
 * Hacia dónde es arriba a lo largo de la soga, así los cordones se quedan en su lugar cuando se
 * curva en lugar de girar alrededor de ella. La primera partícula mantiene la orientación con la
 * que arrancó, girada solo por su propia tangente. El resto se transporta en paralelo desde ahí,
 * sin torsión extra. Promediar la torsión a lo largo de la soga trataría el retorcimiento del bucle
 * como torsión de toda la soga, y la cola recta sobre la mesa rodaría despacio mientras se ata el nudo.
 */
export class MaterialFrames {
  readonly normals: Float64Array;
  private readonly n: number;
  private readonly t: Float64Array;
  private readonly prevT: Float64Array;
  private readonly tmp = [0, 0, 0];

  constructor(n: number) {
    this.n = n;
    this.normals = new Float64Array(n * 3);
    for (let i = 0; i < n; i++) this.normals[i * 3 + 1] = 1; // la soga arranca a lo largo de x, así que arriba sirve
    this.t = new Float64Array(n * 3);
    this.prevT = new Float64Array(n * 3);
    for (let i = 0; i < n; i++) this.prevT[i * 3] = 1;
  }

  update(x: Float64Array): void {
    const { n, t, prevT, normals: N, tmp } = this;
    for (let i = 0; i < n; i++) {
      const a = Math.max(i - 1, 0) * 3;
      const b = Math.min(i + 1, n - 1) * 3;
      const dx = x[b] - x[a];
      const dy = x[b + 1] - x[a + 1];
      const dz = x[b + 2] - x[a + 2];
      const len = Math.hypot(dx, dy, dz) || 1;
      t[i * 3] = dx / len;
      t[i * 3 + 1] = dy / len;
      t[i * 3 + 2] = dz / len;
    }
    // Extremo fijo: girar solo con su propia tangente, así un bucle por delante no lo puede hacer rodar.
    rotate(tmp, N, 0, prevT, 0, t, 0);
    lay(N, t, 0, tmp);
    for (let i = 1; i < n; i++) {
      rotate(tmp, N, (i - 1) * 3, t, (i - 1) * 3, t, i * 3);
      lay(N, t, i, tmp);
    }
    prevT.set(t);
  }
}

/**
 * Descarta la componente de v a lo largo de la tangente y guarda una normal unitaria. Conserva la
 * normal vieja si esa se anula.
 */
function lay(normals: Float64Array, tangent: Float64Array, i: number, v: number[]): void {
  const o = i * 3;
  const tx = tangent[o];
  const ty = tangent[o + 1];
  const tz = tangent[o + 2];
  const dot = v[0] * tx + v[1] * ty + v[2] * tz;
  const x = v[0] - dot * tx;
  const y = v[1] - dot * ty;
  const z = v[2] - dot * tz;
  const len = Math.hypot(x, y, z);
  if (len < 1e-9) return;
  normals[o] = x / len;
  normals[o + 1] = y / len;
  normals[o + 2] = z / len;
}

/** Escribe v (en vi) girado por la rotación más chica que lleva la tangente `from` (en fi) a `to` (en ti). */
function rotate(
  out: number[],
  v: Float64Array,
  vi: number,
  from: Float64Array,
  fi: number,
  to: Float64Array,
  ti: number,
): void {
  const ax = from[fi + 1] * to[ti + 2] - from[fi + 2] * to[ti + 1];
  const ay = from[fi + 2] * to[ti] - from[fi] * to[ti + 2];
  const az = from[fi] * to[ti + 1] - from[fi + 1] * to[ti];
  const sin = Math.hypot(ax, ay, az);
  const cos = from[fi] * to[ti] + from[fi + 1] * to[ti + 1] + from[fi + 2] * to[ti + 2];
  const px = v[vi];
  const py = v[vi + 1];
  const pz = v[vi + 2];
  if (sin < 1e-9) {
    out[0] = px;
    out[1] = py;
    out[2] = pz;
    return;
  }
  const kx = ax / sin;
  const ky = ay / sin;
  const kz = az / sin;
  const kd = (kx * px + ky * py + kz * pz) * (1 - cos);
  out[0] = px * cos + (ky * pz - kz * py) * sin + kx * kd;
  out[1] = py * cos + (kz * px - kx * pz) * sin + ky * kd;
  out[2] = pz * cos + (kx * py - ky * px) * sin + kz * kd;
}
