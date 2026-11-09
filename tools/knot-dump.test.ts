// Herramienta para escribir nudos, no un test: se saltea salvo que esté definida KNOT. Bakea un
// nudo, escribe tools/out/bake.json para tools/baked.html e imprime números para revisar un cambio
// con un solo bakeo:
//   KNOT=bowline TIMES=11.9,13.3 ATS=0.272,1 CROSS=13.3 npx vitest run tools/knot-dump.test.ts
// TIMES (por defecto: los tiempos de los pasos) × ATS (fracciones a lo largo de la soga; `k:a` para
// la soga k, por ejemplo 1:0.5) imprimen dónde están esos puntos; CROSS (por defecto: TIMES) lista
// dónde la soga se cruza consigo misma.
import { mkdirSync, writeFileSync } from "node:fs";
import { test } from "vitest";
import { bake, frameCount } from "../src/engine/sim/bake";
import { particleCount } from "../src/engine/sim/rope";
import { knots } from "../src/engine/knots";

const list = (v: string | undefined, fallback: number[]) =>
  v ? v.split(",").filter(Boolean).map(Number) : fallback;

test.skipIf(!process.env.KNOT)(
  "dump",
  () => {
    const knot = knots.find((k) => k.id === process.env.KNOT);
    if (!knot)
      throw new Error(`no hay ningún nudo "${process.env.KNOT}"; ids: ${knots.map((k) => k.id)}`);
    const R = knot.ropes[0].radius;
    const counts = knot.ropes.map(particleCount);
    const n = counts.reduce((a, b) => a + b, 0);
    // Por partícula: su soga, su fracción a lo largo de ella y el largo en reposo del eslabón hasta
    // la siguiente (0 en la punta de una soga).
    const ropeOf: number[] = [];
    const frac: number[] = [];
    const spacing: number[] = [];
    knot.ropes.forEach((rope, k) => {
      for (let i = 0; i < counts[k]; i++) {
        ropeOf.push(k);
        frac.push(i / (counts[k] - 1));
        spacing.push(i < counts[k] - 1 ? rope.length / (counts[k] - 1) : 0);
      }
    });
    const first = counts.map((_, k) => counts.slice(0, k).reduce((a, b) => a + b, 0));
    const name = (i: number) =>
      `${knot.ropes.length > 1 ? ("br"[ropeOf[i]] ?? ropeOf[i]) : ""}${frac[i].toFixed(2)}`;
    // Muy separadas a lo largo de una soga, o en sogas distintas.
    const apart = (i: number, j: number, gap: number) => ropeOf[i] !== ropeOf[j] || j - i >= gap;
    const total = frameCount(knot);
    const all = new Float32Array(total * n * 3);
    bake(knot, (c) => all.set(c.frames, c.start * n * 3));
    const frame = (t: number) => Math.min(Math.round(t * 60), total - 1) * n * 3;
    const dist = (a: number, b: number) =>
      Math.hypot(all[a] - all[b], all[a + 1] - all[b + 1], all[a + 2] - all[b + 2]);

    // El peor estiramiento de un eslabón, y el acercamiento máximo entre partes de la soga muy
    // separadas a lo largo de ella (menos de 2R es atravesarse).
    let stretch = 0;
    let stretchAt = "";
    let closest = Infinity;
    let closestAt = 0;
    const out: number[][] = [];
    for (let f = 0; f < total; f++) {
      const o = f * n * 3;
      for (let i = 0; i < n - 1; i++) {
        if (!spacing[i]) continue;
        const s = dist(o + i * 3, o + i * 3 + 3) / spacing[i];
        if (s > stretch) [stretch, stretchAt] = [s, `${(f / 60).toFixed(2)}s at ${name(i)}`];
      }
      if (f % 3 === 0)
        for (let i = 0; i < n; i++)
          for (let j = i + 1; j < n; j++) {
            if (!apart(i, j, 8)) continue;
            const d = dist(o + i * 3, o + j * 3);
            if (d < closest) [closest, closestAt] = [d, f / 60];
          }
      if (f % 6 === 0)
        out.push(Array.from(all.subarray(o, o + n * 3), (v) => Math.round(v * 1e4) / 1e4));
    }
    mkdirSync("tools/out", { recursive: true });
    writeFileSync(
      "tools/out/bake.json",
      JSON.stringify({ n, counts, radius: R, steps: knot.steps, frames: out }),
    );

    const times = list(
      process.env.TIMES,
      knot.steps.map((s) => s.t),
    );
    const ats = (process.env.ATS ?? "0,0.25,0.5,0.75,1").split(",").filter(Boolean);
    const at = (o: number, spec: string) => {
      const [k, a] = spec.includes(":") ? spec.split(":").map(Number) : [0, Number(spec)];
      const i = o + (first[k] + Math.round(a * (counts[k] - 1))) * 3;
      return `${spec}(${all[i].toFixed(2)},${(all[i + 1] / R).toFixed(1)}R,${all[i + 2].toFixed(2)})`;
    };
    const rows = times.map(
      (t) => `${t.toFixed(2).padStart(6)} ${ats.map((a) => at(frame(t), a)).join(" ")}`,
    );

    // Cruces: partes de la soga una encima de otra en vista de arriba, por fracción a lo largo de
    // la soga, unidas en tramos.
    const cross = list(process.env.CROSS, times).map((t) => {
      const o = frame(t);
      const found: string[] = [];
      let last = -99;
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) {
          if (!apart(i, j, 12)) continue;
          const a = o + i * 3;
          const b = o + j * 3;
          const flat = Math.hypot(all[a] - all[b], all[a + 2] - all[b + 2]);
          if (flat < 1.6 * R && Math.abs(all[a + 1] - all[b + 1]) > 1.2 * R) {
            const side = all[a + 1] > all[b + 1] ? "over" : "under";
            if (i - last > 6) found.push(`${name(i)} ${side} ${name(j)}`);
            last = i;
            break;
          }
        }
      return `cross ${t}: ${found.join(" | ")}`;
    });

    const report = [
      ...rows,
      ...cross,
      `stretch ${stretch.toFixed(3)} (${stretchAt})  closest ${(closest / R).toFixed(2)}R at ${closestAt.toFixed(2)}s`,
    ].join("\n");
    writeFileSync("tools/out/metrics.txt", report + "\n");
    console.log(report);
  },
  300_000,
);
