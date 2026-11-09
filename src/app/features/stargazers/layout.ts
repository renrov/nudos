// Dónde queda el nudo de cada estrella en la soga y qué nudo es. Sin imports, así
// tools/readme-rope.mjs lo puede correr en Node tal cual.

/**
 * Los nudos que puede atar una estrella, del más común al menos común, con la proporción de
 * stargazers que ata cada uno. Solo nudos que se atan en el medio de la soga: uno que termina en
 * una gaza o en un amarre muestra la punta de la soga.
 */
export const KNOT_KINDS = [
  { id: "overhand", slug: "nudo-simple", name: "Nudo simple", odds: 0.75 },
  { id: "figure-eight", slug: "nudo-de-ocho", name: "Nudo de ocho", odds: 0.25 },
] as const;
export type KnotKind = (typeof KNOT_KINDS)[number];

/**
 * El nudo que ata un usuario de GitHub: siempre el mismo para su id de usuario, los nudos más raros
 * para menos gente.
 */
export function knotFor(id: number): KnotKind {
  let u = (Math.imul(id, 2654435761) >>> 0) / 2 ** 32; // reparte los ids de forma pareja en [0, 1)
  for (const kind of KNOT_KINDS) if ((u -= kind.odds) < 0) return kind;
  return KNOT_KINDS[0];
}

// Largos de soga, en diámetros de soga.
export const LEAD = 8; // soga pelada antes del primer nudo y después del último
const TIGHT = 5; // de nudo a nudo para estrellas que llegaron con instantes de diferencia: el nudo y sus avatares entran justo
const STEP = 3.2; // soga extra cada vez que se duplica la espera entre dos estrellas, pasada la espera habitual
const LOOSE = 34; // lo máximo de soga que recibe una pausa, por larga que haya sido

/** Un número aleatorio estable en [0, 1) para la estrella `i`, así su nudo nunca se mueve cuando llegan estrellas. */
export const jitter = (i: number, salt = 0) => {
  const h = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return h - Math.floor(h);
};

/**
 * Soga entre dos nudos para una espera de `wait`, donde `usual` es la espera típica de este repo
 * entre estrellas: apretada para una ráfaga, un paso fijo más cada vez que la espera se duplica,
 * con tope. En escala logarítmica, una semana tranquila se lee claramente más larga que una hora
 * tranquila sin volverse un deslizamiento largo y vacío, y medir contra el ritmo propio del repo
 * hace que se lea igual para un repo con 5 estrellas por año o con 1.000 por día: apretada quiere
 * decir más movida que lo habitual, suelta quiere decir más tranquila.
 */
export const gapFor = (wait: number, usual: number) =>
  Math.min(TIGHT + STEP * Math.log2(1 + Math.max(wait, 0) / usual), LOOSE);

/**
 * Dónde queda cada uno de los primeros `shown` nudos a lo largo de la soga, en diámetros de soga
 * desde su inicio, dada la hora de cada estrella en ms (ordenadas). El espaciado sale de la espera
 * desde la estrella anterior, con un poco de bamboleo de hecho a mano. La espera habitual es la
 * mediana de todas las estrellas, así los nudos no se mueven mientras la soga se repite.
 */
export function ropeLayout(times: readonly number[], shown: number) {
  const waits = times.slice(1).map((t, i) => t - times[i]);
  const sorted = [...waits].sort((a, b) => a - b);
  const usual = Math.max(sorted[Math.floor(sorted.length / 2)] ?? 0, 60_000); // por lo menos un minuto
  const knots: number[] = [];
  let s = LEAD;
  for (let i = 0; i < Math.min(shown, times.length); i++) {
    if (i > 0) s += gapFor(waits[i - 1], usual) * (0.88 + 0.24 * jitter(i));
    knots.push(s);
  }
  return { knots, end: (knots[knots.length - 1] ?? 0) + LEAD };
}
