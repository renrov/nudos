import { describe, expect, test } from "vitest";
import type { KnotDef, Prop } from "../knots/types";
import { RopeSim, sampleHermite } from "./rope";

const still: KnotDef = {
  id: "still",
  slug: "quieta",
  name: "Quieta",
  summary: "",
  ropes: [
    {
      length: 0.5,
      radius: 0.01,
      start: [
        [-0.25, 0.01, 0],
        [0.25, 0.01, 0],
      ],
    },
  ],
  duration: 1,
  steps: [],
  guides: [],
};

describe("sampleHermite", () => {
  test("pasa por cada key y se queda quieto en los puntos repetidos", () => {
    const times = [0, 1, 2, 3];
    const pts: [number, number, number][] = [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 0],
      [2, 1, 0],
    ];
    for (let k = 0; k < times.length; k++)
      expect(sampleHermite(times, pts, times[k])).toEqual(pts[k]);
    expect(sampleHermite(times, pts, 1.5)).toEqual([1, 0, 0]);
  });
});

describe("RopeSim", () => {
  test("una soga apoyada sobre la mesa se queda quieta y conserva su largo", () => {
    const sim = new RopeSim(still);
    const before = sim.x.slice();
    for (let f = 0; f < 60; f++) sim.step();
    for (let i = 0; i < sim.x.length; i++) expect(sim.x[i]).toBeCloseTo(before[i], 4);
  });

  test("es determinista", () => {
    const knot: KnotDef = {
      ...still,
      guides: [{ at: 1, grab: 0, path: [{ t: 0.5, p: [0, 0.2, 0.1] }] }],
    };
    const a = new RopeSim(knot);
    const b = new RopeSim(knot);
    for (let f = 0; f < 40; f++) {
      a.step();
      b.step();
    }
    expect(a.x).toEqual(b.x);
  });

  test("una soga que cae sobre sí misma no se atraviesa", () => {
    // Levantar la punta bien alto sobre el medio y soltarla. Puede caer arriba o rebotar, pero
    // ninguna parte lejana de la soga puede superponerse con otra en el camino.
    const knot: KnotDef = {
      ...still,
      guides: [
        {
          at: 1,
          grab: 0,
          path: [
            { t: 0.4, p: [0.02, 0.15, 0] },
            { t: 0.5, p: [0, 0.1, 0] },
          ],
        },
      ],
    };
    const sim = new RopeSim(knot);
    let closest = Infinity;
    for (let f = 0; f < 90; f++) {
      sim.step();
      for (let i = 0; i < sim.n; i++)
        for (let j = i + 8; j < sim.n; j++) {
          const d = Math.hypot(
            sim.x[i * 3] - sim.x[j * 3],
            sim.x[i * 3 + 1] - sim.x[j * 3 + 1],
            sim.x[i * 3 + 2] - sim.x[j * 3 + 2],
          );
          closest = Math.min(closest, d);
        }
    }
    // El contacto mantiene los centros a un diámetro (2r) de distancia; bastante menos que eso
    // quiere decir que una soga atravesó a otra.
    expect(closest).toBeGreaterThan(1.8 * 0.01);
  });
});

describe.each(["cylinder", "capsule"] as const)("dos sogas y un poste %s", (kind) => {
  const r = 0.01;
  const pole: Prop = { kind, a: [0.1, 0.0, 0.12], b: [0.1, 0.15, 0.12], radius: 0.02 };
  const knot: KnotDef = {
    ...still,
    duration: 2.5,
    ropes: [
      // Tendida a lo largo de x sobre la mesa.
      {
        length: 0.6,
        radius: r,
        start: [
          [-0.3, r, 0],
          [0.3, r, 0],
        ],
      },
      // Arranca por encima de la primera soga, doblada en una punta, y cae cruzándola.
      {
        length: 0.5,
        radius: r,
        start: [
          [-0.15, 0.06, -0.2],
          [-0.15, 0.06, 0.15],
          [-0.15, 0.06, 0.3],
        ],
      },
    ],
    props: [pole],
    // La punta de la primera soga se arrastra derecho a través del poste.
    guides: [
      {
        rope: 0,
        at: 1,
        grab: 0.6,
        path: [
          { t: 1.0, p: [0.3, r, 0.12] },
          { t: 2.0, p: [0, r, 0.12] },
        ],
      },
    ],
  };
  const sim = new RopeSim(knot);
  const [a, b] = sim.ropes;
  let ropeGap = Infinity;
  let poleGap = Infinity;
  let crossing = Infinity; // a qué altura queda la soga que cayó sobre la primera en el cruce
  for (let f = 0; f < 150; f++) {
    sim.step();
    for (let i = a.start; i < a.start + a.count; i++) {
      for (let j = b.start; j < b.start + b.count; j++)
        ropeGap = Math.min(
          ropeGap,
          Math.hypot(...[0, 1, 2].map((c) => sim.x[i * 3 + c] - sim.x[j * 3 + c])),
        );
    }
    for (let i = 0; i < sim.n; i++) {
      // Distancia al eje del poste, para las partículas que están al lado.
      const h = sim.x[i * 3 + 1];
      if (h > 0 && h < 0.15)
        poleGap = Math.min(poleGap, Math.hypot(sim.x[i * 3] - 0.1, sim.x[i * 3 + 2] - 0.12));
    }
  }
  for (let j = b.start; j < b.start + b.count; j++)
    if (Math.abs(sim.x[j * 3] + 0.15) < 0.01 && Math.abs(sim.x[j * 3 + 2]) < 0.02)
      crossing = Math.min(crossing, sim.x[j * 3 + 1]);

  test("la soga que cae apoya sobre la otra sin atravesarla", () => {
    expect(ropeGap).toBeGreaterThan(1.8 * r); // los centros quedan a un diámetro de distancia
    expect(ropeGap).toBeLessThan(2.4 * r); // y sí se tocaron
    expect(crossing).toBeGreaterThan(2.5 * r); // sigue por encima de la primera soga en el cruce
  });

  test("una soga arrastrada contra el poste es frenada por él", () => {
    expect(poleGap).toBeGreaterThan(0.99 * (pole.radius + r));
    expect(poleGap).toBeLessThan(pole.radius + 1.3 * r); // sí se apoyó sobre ella
  });

  test("las sogas conservan su propio largo", () => {
    for (const [rope, def] of [
      [a, knot.ropes[0]],
      [b, knot.ropes[1]],
    ] as const) {
      const last = (rope.start + rope.count - 1) * 3;
      let len = 0;
      for (let i = rope.start * 3; i < last; i += 3)
        len += Math.hypot(...[0, 1, 2].map((c) => sim.x[i + 3 + c] - sim.x[i + c]));
      expect(len / def.length).toBeCloseTo(1, 1);
    }
  });
});
