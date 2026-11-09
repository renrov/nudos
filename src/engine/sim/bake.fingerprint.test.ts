import { describe, expect, test } from "vitest";
import { knots } from "../knots";
import { bake } from "./bake";

// Hashes de las posiciones bakeadas de cada nudo. Un refactor tiene que dejarlos iguales; un cambio
// deliberado en un nudo o en la física actualiza su hash acá (el mensaje de falla imprime el nuevo).
const FINGERPRINTS: Record<string, string> = {
  overhand: "6fa9fda654de",
  "slip-knot": "d0d933bace65",
  "figure-eight": "815fa7a4f198",
  bowline: "edc1585db70c",
  "clove-hitch": "e47109ab703c",
  zeppelin: "1d60633c1b56",
  "square-knot": "5ad8a78873cf",
  "poachers-knot": "e896f68b2854",
  "daisy-chain": "58a16779bccd",
};

describe("huella del bakeo", () => {
  test.each(knots.map((k) => [k.id, k] as const))(
    "%s se bakea idéntico bit a bit",
    async (id, knot) => {
      const chunks: Float32Array[] = [];
      bake(knot, (c) => chunks.push(c.frames));
      const all = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
      chunks.reduce((at, c) => (all.set(c, at), at + c.length), 0);
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", all));
      const hex = [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
      expect(hex.slice(0, 12)).toBe(FINGERPRINTS[id]);
    },
    60_000,
  );
});
