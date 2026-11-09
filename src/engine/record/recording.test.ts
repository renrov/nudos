import { expect, test } from "vitest";
import { formatKnot, knotOf, toGuide } from "./recording";

test("un recorrido se vuelve una guía: las keys quietas se juntan en una sola espera, y suelta en el release", () => {
  const guide = toGuide(
    {
      rope: 0,
      at: 0.25,
      grab: 1,
      keys: [
        { t: 1.1, p: [0.1, 0.012, 0.2] },
        { t: 1.2, p: [0.1, 0.012, 0.2] },
        { t: 1.3, p: [0.1, 0.012, 0.2] },
        { t: 1.4, p: [0.2, 0.012, 0.2] },
      ],
    },
    1.7,
  );
  expect(guide).toEqual({
    at: 0.25,
    grab: 1,
    path: [
      { t: 1.1, p: [0.1, 0.012, 0.2] },
      { t: 1.3 },
      { t: 1.4, p: [0.2, 0.012, 0.2] },
      { t: 1.7 },
    ],
  });
  const knot = knotOf({ preset: "Seno", guides: [guide], steps: [] });
  expect(knot.duration).toBe(2.3);
  expect(formatKnot(knot)).toContain("{ t: 1.3 }");
});
