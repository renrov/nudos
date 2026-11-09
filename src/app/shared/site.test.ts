import { existsSync } from "node:fs";
import { expect, test } from "vitest";
import { knots } from "../../engine/knots";
import { knotImagePath } from "./site";

test.each(knots.map((k) => k.id))("%s tiene imagen para compartir (corré `pnpm thumbs`)", (id) => {
  expect(existsSync(new URL(`../../../public${knotImagePath(id)}`, import.meta.url))).toBe(true);
});
