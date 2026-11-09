import { DEFAULT_PHYSICS, type RopePhysics } from "../../../engine/sim/rope";

export const SLIDERS: {
  key: keyof RopePhysics;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: "bend", label: "Rigidez a la flexión (N·m²)", min: 0.002, max: 0.05, step: 0.001 },
  { key: "twist", label: "Rigidez a la torsión (N·m²)", min: 0.001, max: 0.04, step: 0.001 },
  { key: "mass", label: "Masa de la soga (kg)", min: 0.2, max: 5, step: 0.1 },
  { key: "friction", label: "Fricción", min: 0.1, max: 1.2, step: 0.05 },
  { key: "airDamping", label: "Amortiguación del aire (1/s)", min: 0, max: 20, step: 0.5 },
  { key: "internalDamping", label: "Amortiguación interna", min: 0, max: 0.5, step: 0.01 },
];

/** Física de la soga desde la URL (`?tune&bend=0.015&mass=1.5`), valores por defecto para lo que falte. */
export function physicsFromParams(params: URLSearchParams): RopePhysics {
  const p = { ...DEFAULT_PHYSICS };
  for (const { key } of SLIDERS) {
    const v = Number(params.get(key));
    if (params.has(key) && Number.isFinite(v) && v >= 0) p[key] = v;
  }
  return p;
}

/** Escribe `physics` en `params`, dejando afuera los valores iguales a los por defecto. */
export function writePhysics(params: URLSearchParams, physics: RopePhysics) {
  for (const { key } of SLIDERS) {
    if (physics[key] === DEFAULT_PHYSICS[key]) params.delete(key);
    else params.set(key, String(physics[key]));
  }
}
