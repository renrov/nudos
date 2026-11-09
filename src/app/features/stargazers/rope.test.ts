import { describe, expect, it } from "vitest";
import { KNOT_KINDS, gapFor, jitter, knotFor, ropeLayout } from "./layout";
import { countAt } from "./rope";

const HOUR = 36e5;
// 300 estrellas separadas de forma despareja: ráfagas de minutos y pausas de días.
const times = [0];
for (let i = 1; i < 300; i++) times.push(times[i - 1] + 2 ** (jitter(i, 7) * 12) * 60_000);
const user = { login: "", id: 1, avatar_url: "", html_url: "" };
const stars = times.map((t) => ({ starred_at: new Date(t).toISOString(), user }));

describe("soga de estrellas", () => {
  it("cuenta las estrellas dadas hasta una fecha", () => {
    const t = (i: number) => Date.parse(stars[i].starred_at);
    expect(countAt(stars, t(0) - 1)).toBe(0);
    expect(countAt(stars, t(9))).toBe(10);
    expect(countAt(stars, Infinity)).toBe(stars.length);
  });

  it("separa los nudos según la espera entre estrellas, en escala logarítmica y con tope", () => {
    const usual = HOUR;
    expect(gapFor(60_000, usual)).toBeLessThan(gapFor(usual, usual)); // una ráfaga queda más apretada
    expect(gapFor(33 * HOUR, usual)).toBeGreaterThan(gapFor(8 * HOUR, usual)); // una pausa queda más suelta
    // Cada vez que se duplica la espera se agrega más o menos la misma soga, bien pasada la espera habitual.
    const step = (h: number) => gapFor(2 * h * HOUR, usual) - gapFor(h * HOUR, usual);
    expect(step(64)).toBeCloseTo(step(128), 1);
    expect(gapFor(365 * 24 * HOUR, usual)).toBe(gapFor(10 * 365 * 24 * HOUR, usual)); // con tope
  });

  it("se lee igual a cualquier ritmo: solo importan las esperas relativas a la habitual", () => {
    const times = [0, 1, 1.1, 3, 9, 9.2, 30, 31].map((h) => h * HOUR);
    const slow = times.map((t) => t * 100);
    expect(ropeLayout(slow, 8).knots).toEqual(ropeLayout(times, 8).knots);
  });

  it("nunca mueve un nudo mientras la soga se repite", () => {
    const all = ropeLayout(times, times.length).knots;
    expect(ropeLayout(times, 100).knots).toEqual(all.slice(0, 100));
    expect(all.slice(1).every((k, i) => k > all[i])).toBe(true);
  });

  it("le da a cada stargazer el mismo nudo siempre, y los nudos más raros a menos gente", () => {
    expect(knotFor(583231)).toBe(knotFor(583231));
    const ids = Array.from({ length: 20_000 }, (_, i) => 1000 + i * 7919);
    for (const kind of KNOT_KINDS) {
      const share = ids.filter((id) => knotFor(id) === kind).length / ids.length;
      expect(share).toBeCloseTo(kind.odds, 1);
    }
  });
});
