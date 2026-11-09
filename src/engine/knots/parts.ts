import type { KnotDef, RopePart } from "./types";

/** Las partes que se marcan sobre `knot`: las suyas, o la punta y la parte fija de su primera soga. */
export function partsOf(knot: KnotDef): RopePart[] {
  return (
    knot.parts ?? [
      { name: "punta", at: 0.97 },
      { name: "parte fija", at: 0.2 },
    ]
  );
}
