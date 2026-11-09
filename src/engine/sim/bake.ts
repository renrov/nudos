import type { KnotDef } from "../knots/types";
import { MaterialFrames } from "./frames";
import { DEFAULT_PHYSICS, FPS, RopeSim, type RopePhysics } from "./rope";

export interface BakeChunk {
  start: number;
  frames: Float32Array;
  /**
   * Normal de material por partícula, n * 3 floats por cuadro (todas las sogas una después de la
   * otra), para mantener la torsión de los cordones sobre la soga.
   */
  normals: Float32Array;
}

export function frameCount(knot: KnotDef): number {
  return Math.round(knot.duration * FPS) + 1;
}

/** Corre todo el nudo y devuelve posiciones y normales en tandas de cuadros (n * 3 floats cada una). */
export function bake(
  knot: KnotDef,
  onChunk: (chunk: BakeChunk) => void,
  chunkSize = 30,
  physics: RopePhysics = DEFAULT_PHYSICS,
): void {
  const sim = new RopeSim(knot, physics);
  const capture = capturer(sim);
  const total = frameCount(knot);
  const stride = sim.n * 3;
  for (let start = 0; start < total; start += chunkSize) {
    const count = Math.min(chunkSize, total - start);
    const frames = new Float32Array(count * stride);
    const normals = new Float32Array(count * stride);
    for (let f = 0; f < count; f++) {
      if (start + f > 0) sim.step();
      capture(frames, normals, f * stride);
    }
    onChunk({ start, frames, normals });
  }
}

/**
 * El primer cuadro del nudo (su pose inicial), lo bastante barato para calcularlo en el hilo
 * principal mientras se bakea el resto.
 */
export function firstFrame(knot: KnotDef, physics: RopePhysics = DEFAULT_PHYSICS): BakeChunk {
  const sim = new RopeSim(knot, physics);
  const frames = new Float32Array(sim.n * 3);
  const normals = new Float32Array(sim.n * 3);
  capturer(sim)(frames, normals, 0);
  return { start: 0, frames, normals };
}

/**
 * Copia las posiciones de la simulación y las normales de material de cada soga a los buffers de
 * cuadros en `offset`.
 */
function capturer(sim: RopeSim) {
  const materials = sim.ropes.map((r) => new MaterialFrames(r.count));
  return (frames: Float32Array, normals: Float32Array, offset: number) => {
    frames.set(sim.x, offset);
    sim.ropes.forEach((r, k) => {
      materials[k].update(sim.x.subarray(r.start * 3, (r.start + r.count) * 3));
      normals.set(materials[k].normals, offset + r.start * 3);
    });
  };
}
