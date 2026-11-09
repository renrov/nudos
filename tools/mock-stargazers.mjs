// Escribe tools/stargazers.mock.json, que el servidor de desarrollo muestra en lugar del
// public/stargazers.json real (quizás vacío): estrellas falsas en el feed de stargazers a lo largo
// de 90 días. Unas 10 por día (menos los fines de semana), unos pocos días grandes de unas 50 por
// un post de lanzamiento o algo compartido, y algunos tramos tranquilos sin ninguna.
// Correr: node tools/mock-stargazers.mjs
import { writeFileSync } from "node:fs";
import { encode } from "./stargazers.mjs";

let seed = 42;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const poisson = (rate) => {
  let n = 0;
  for (let p = Math.exp(-rate), q = rand(); q > p; q *= rand()) n++;
  return n;
};
const pick = (list) => list[Math.floor(rand() * list.length)];

const DAY = 86_400_000;
const days = 90;
const start = Date.parse("2026-08-03");
// [día, estrellas extra ese día]: un día común trae unas 10; un post de lanzamiento o algo
// compartido trae 50.
const bursts = [
  [18, 48],
  [19, 18],
  [47, 46],
  [48, 12],
  [71, 22],
];
// Días en que nadie dio estrella: un fin de semana tranquilo, una semana lenta, un día muerto suelto.
const quiet = new Set([30, 31, 32, 33, 58, 59, 80]);
const adjectives = [
  "swift",
  "quiet",
  "brave",
  "lucky",
  "tidy",
  "salty",
  "rusty",
  "sunny",
  "fuzzy",
  "clever",
  "bold",
  "calm",
  "wild",
  "mellow",
  "nimble",
];
const nouns = [
  "sailor",
  "rigger",
  "climber",
  "hiker",
  "otter",
  "falcon",
  "coder",
  "bosun",
  "angler",
  "scout",
  "weaver",
  "fox",
  "heron",
  "camper",
  "tinker",
];

const seen = new Set();
const stars = [];
for (let d = 0; d < days; d++) {
  const weekend = new Date(start + d * DAY).getUTCDay() % 6 === 0;
  let rate = quiet.has(d) ? 0 : weekend ? 6 : 10;
  for (const [d0, extra] of bursts) if (d === d0) rate += extra;
  for (let n = poisson(rate); n > 0; n--) {
    let login;
    do login = `${pick(adjectives)}-${pick(nouns)}${rand() < 0.5 ? Math.floor(rand() * 99) : ""}`;
    while (seen.has(login));
    seen.add(login);
    const id = 1000 + Math.floor(rand() * 9_000_000);
    stars.push({ login, id, time: Math.floor(start + (d + rand()) * DAY) });
  }
}
stars.sort((a, b) => a.time - b.time);
// Dos semanas tranquilas antes de las 5 estrellas más nuevas: todo lo anterior se corre 14 días
// para atrás, así la soga muestra cómo se ve una pausa larga justo donde abre.
for (const star of stars.slice(0, -5)) star.time -= 14 * DAY;
writeFileSync(new URL("stargazers.mock.json", import.meta.url), encode(stars));
console.log(`${stars.length} estrellas`);
