import { knots } from "../knots";
import type { Guide, GuideKey, KnotDef, Prop, RopeDef, Step, Vec3 } from "../knots/types";

const R = 0.012;
const BLUE = "#2f5fb3";
/** Segundos entre las keys que graba una mano en movimiento. */
export const KEY_EVERY = 0.1;

/** Desde dónde arranca el grabador: sogas tendidas sobre la mesa, y props para atar alrededor. */
export interface Preset {
  name: string;
  ropes: RopeDef[];
  props?: Prop[];
}

const straight = (from: number, to: number, z = 0, color?: string): RopeDef => ({
  length: to - from,
  radius: R,
  start: [
    [from, R, z],
    [to, R, z],
  ],
  color,
});

/** Un seno: la parte fija desde la izquierda por el lado cercano, la vuelta en x = apex, de regreso hasta x = end. */
function bight(from: number, apex: number, end: number, half: number): RopeDef {
  const start: Vec3[] = [[from, R, half]];
  for (let i = 0; i <= 8; i++) {
    const a = (Math.PI * i) / 8;
    start.push([apex + half * Math.sin(a), R, half * Math.cos(a)]);
  }
  start.push([end, R, -half]);
  return { length: apex - from + Math.PI * half + apex - end, radius: R, start };
}

export const PRESETS: Preset[] = [
  { name: "Soga recta, 1,2 m", ropes: [straight(-0.6, 0.6)] },
  { name: "Soga recta, 2 m", ropes: [straight(-0.9, 1.1)] },
  { name: "Seno", ropes: [bight(-0.9, 0.2, -0.45, 0.05)] },
  { name: "Dos sogas", ropes: [straight(-0.7, 0.5, 0.06, BLUE), straight(-0.5, 0.7, -0.06)] },
  ...knots.map((k) => ({ name: `Inicio: ${k.name}`, ropes: k.ropes, props: k.props })),
];

/** Todo lo grabado: el layout inicial (por nombre de preset), los movimientos terminados y los títulos de los pasos. */
export interface Recording {
  preset: string;
  guides: Guide[];
  steps: Step[];
}

/** Los movimientos de una mano mientras está agarrada: dónde agarró y dónde estaba cada KEY_EVERY segundos. */
export interface Track {
  rope: number;
  at: number;
  grab: number;
  keys: { t: number; p: Vec3 }[];
  force?: number;
  compliance?: number;
}

const round = (v: number, places = 3) => Number(v.toFixed(places));

/**
 * La guía que repite un recorrido, soltando en `release`. Un punto que no se movió se escribe como
 * una key pelada (quedarse quieto), y de una racha de esas solo queda la última.
 */
export function toGuide(track: Track, release: number): Guide {
  const path: GuideKey[] = [];
  let last: Vec3 | null = null;
  for (const { t, p } of track.keys) {
    const q = p.map((c) => round(c)) as Vec3;
    const still = last !== null && q.every((c, i) => c === last![i]);
    if (still && path.length && path[path.length - 1].p === undefined) path.pop();
    path.push(still ? { t: round(t, 2) } : { t: round(t, 2), p: q });
    last = q;
  }
  if (!path.length || path[path.length - 1].t < round(release, 2))
    path.push({ t: round(release, 2) });
  return {
    ...(track.rope ? { rope: track.rope } : {}),
    at: round(track.at, 4),
    grab: round(track.grab, 2),
    path,
    ...(track.compliance !== undefined ? { compliance: track.compliance } : {}),
    ...(track.force !== undefined ? { force: track.force } : {}),
  };
}

export function presetOf(recording: Recording): Preset {
  return PRESETS.find((p) => p.name === recording.preset) ?? PRESETS[0];
}

/** La grabación como un nudo que la app puede bakear: corre hasta que suelta la última mano, y un poquito más. */
export function knotOf(recording: Recording): KnotDef {
  const { ropes, props } = presetOf(recording);
  const end = Math.max(0, ...recording.guides.map((g) => g.path[g.path.length - 1].t));
  const steps = [...recording.steps].sort((a, b) => a.t - b.t);
  if (!steps.length || steps[0].t > 0) steps.unshift({ t: 0, title: "Inicio" });
  return {
    id: "recorded",
    slug: "grabado",
    name: "Nudo grabado",
    summary: "",
    ropes,
    ...(props ? { props } : {}),
    duration: round(end + 0.6, 1),
    steps,
    guides: recording.guides,
  };
}

/** El nudo como TypeScript para un archivo en src/engine/knots: puntos y keys en una línea cada uno. */
export function formatKnot(knot: KnotDef): string {
  const json = JSON.stringify(knot, null, 2)
    .replace(/\[\s+(-?[\d.e-]+),\s+(-?[\d.e-]+),\s+(-?[\d.e-]+)\s+\]/g, "[$1, $2, $3]")
    .replace(/\{\s+"t": ([\d.]+)(?:,\s+"p": (\[[^\]]+\]))?\s+\}/g, (_, t, p) =>
      p ? `{ t: ${t}, p: ${p} }` : `{ t: ${t} }`,
    )
    .replace(/"(\w+)":/g, "$1:");
  return `import type { KnotDef } from "./types";\n\nexport const recorded: KnotDef = ${json};\n`;
}
