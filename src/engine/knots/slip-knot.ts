import type { KnotDef } from "./types";

// La soga está tendida a lo largo de x, de -0.6 (extremo fijo) a 0.9 (punta); la cámara mira desde +z.
// `at` es la fracción a lo largo de la soga, así un punto arranca en x = at * 1.5 - 0.6.
// Se ata como el nudo simple, pero lo que se pasa es un seno de la cola, no su punta. El seno
// necesita unos 0.45 m de cola; la cola no es más larga que la línea recta desde el cruce hasta
// donde la tiende la punta, así que la soga es más larga que la del nudo simple y la cola va hacia
// abajo y a la izquierda, a la vista.
const R = 0.012;

export const slipKnot: KnotDef = {
  id: "slip-knot",
  slug: "nudo-corredizo",
  name: "Nudo corredizo",
  summary:
    "Un nudo simple hecho con un seno de la punta corta. Un tope provisorio: con un tirón de la punta corta se deshace.",
  ropes: [
    {
      length: 1.5,
      radius: R,
      start: [
        [-0.6, R, 0],
        [0.9, R, 0],
      ],
    },
  ],
  duration: 9.1,
  steps: [
    { t: 0, title: "Estirá la soga en línea recta" },
    { t: 0.4, title: "Hacé un bucle: pasá la punta corta por encima de la parte fija" },
    { t: 3.75, title: "Doblá un seno en la punta corta y empujalo por debajo del bucle" },
    { t: 4.8, title: "Subí el seno por dentro del bucle" },
    { t: 5.9, title: "Tirá del seno y de la parte fija para ajustar" },
    { t: 8.1, title: "Listo: un nudo corredizo. Tirá de la punta corta para deshacerlo" },
  ],
  parts: [
    { name: "punta corta", at: 0.97 },
    { name: "parte fija", at: 0.15 },
    // El lado cercano del bucle, el que se levanta en la fase 2, y el seno que pellizca la otra mano.
    { name: "bucle", at: 0.5, from: 2.5, to: 5.9 },
    { name: "seno", at: 0.84, from: 3.75 },
  ],
  guides: [
    // Fase 1: una mano lleva la punta en redondo por el lado lejano y por encima de la soga hacia
    // la cámara, y después tiende la cola hacia abajo y a la izquierda; el bucle va cediendo soga mientras tanto.
    { at: 0.4, grab: 0.4, path: [{ t: 6.3 }] },
    {
      at: 1,
      grab: 0.4,
      force: 45,
      path: [
        { t: 1.0, p: [0.4, R, -0.1] },
        { t: 1.55, p: [0.12, R, -0.14] },
        { t: 2.0, p: [-0.03, R, -0.14] },
        { t: 2.25, p: [-0.09, R, -0.09] },
        { t: 2.5, p: [-0.09, 0.045, -0.02] },
        { t: 2.75, p: [-0.1, 0.03, 0.09] },
        { t: 3.05, p: [-0.2, 0.03, 0.15] },
        { t: 3.4, p: [-0.32, R, 0.19] },
        { t: 3.75, p: [-0.45, R, 0.21] },
      ],
    },

    // Fase 2: levantar el lado cercano del bucle; una mano pellizca la cola más o menos por la
    // mitad y la empuja, doblada, por debajo de ese lado, hacia arriba por el medio y afuera por
    // encima del lado lejano. La punta queda afuera.
    {
      at: 0.5,
      grab: 4.4,
      force: 45, // más liviana, el seno arrastra este lado con él
      path: [{ t: 4.7, p: [0.13, 0.05, 0.07] }, { t: 5.6 }, { t: 5.9, p: [0.13, 0.03, 0.06] }],
    },
    {
      at: 0.84,
      grab: 3.75,
      force: 45,
      path: [
        { t: 4.5, p: [0.1, R, 0.14] },
        { t: 4.8, p: [0.12, R, 0.07] },
        { t: 5.05, p: [0.12, R, 0.02] },
        { t: 5.35, p: [0.12, 0.05, 0.0] },
        { t: 5.6, p: [0.15, 0.05, -0.05] },
        { t: 5.9, p: [0.21, 0.04, -0.07] },
      ],
    },

    // Fase 3: tirar del extremo fijo y del seno hacia lados opuestos. La otra mano sostiene la
    // punta de la cola, si no el tirón también la pasa por el bucle y el nudo se desarma.
    { at: 1, grab: 5.9, path: [{ t: 7.9 }] },
    {
      at: 0,
      grab: 5.9,
      compliance: 0.001,
      force: 250,
      path: [{ t: 7.1, p: [-0.8, 0.04, 0] }, { t: 7.9 }],
    },
    {
      at: 0.84,
      grab: 5.9,
      compliance: 0.001,
      force: 250,
      path: [{ t: 7.1, p: [0.4, 0.04, 0] }, { t: 7.9 }],
    },
  ],
};
