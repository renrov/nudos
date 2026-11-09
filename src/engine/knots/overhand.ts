import type { KnotDef } from "./types";

// La soga está tendida a lo largo de x, de -0.6 (extremo fijo) a 0.6 (punta); la cámara mira desde +z.
// `at` es la fracción a lo largo de la soga, así un punto arranca en x = at * 1.2 - 0.6.
const R = 0.012;

export const overhand: KnotDef = {
  id: "overhand",
  slug: "nudo-simple",
  name: "Nudo simple",
  summary:
    "El nudo más sencillo y la base de muchos otros. Usalo como tope en la punta de una soga.",
  ropes: [
    {
      length: 1.2,
      radius: R,
      start: [
        [-0.6, R, 0],
        [0.6, R, 0],
      ],
    },
  ],
  duration: 7.6,
  steps: [
    { t: 0, title: "Estirá la soga en línea recta" },
    { t: 0.4, title: "Hacé un bucle: pasá la punta por encima de la parte fija" },
    { t: 3, title: "Pasá la punta por abajo y subila por dentro del bucle" },
    { t: 4.6, title: "Tirá de las dos puntas para ajustar" },
    { t: 6.6, title: "Listo: un nudo simple" },
  ],
  parts: [
    { name: "punta", at: 0.97 },
    { name: "parte fija", at: 0.2 },
    // El lado lejano del círculo, el que levanta la mano de la fase 2.
    { name: "bucle", at: 0.6, from: 2.2, to: 4.6 },
  ],
  guides: [
    // Fase 1: una mano lleva la punta en redondo y por encima de la soga; la soga de atrás cae en
    // un círculo (centro cerca de (0.06, 0)) al lado del punto sostenido, cruzándose a su
    // izquierda. La punta sigue hasta el lado lejano y deja cola suficiente para la pasada.
    // Sujeta la parte fija hasta que el tirón toma el control, si no la punta, al salir, la
    // arrastra por la mesa.
    { at: 0.5, grab: 0.4, path: [{ t: 5.0 }] },
    {
      at: 1,
      grab: 0.4,
      force: 45, // arrastra la soga pesada en redondo; más liviana, se atrasa y después latiguea
      path: [
        // Se desliza en redondo sobre la mesa, así la soga de atrás la sigue en lugar de cortar camino.
        { t: 1.0, p: [0.35, R, 0.1] },
        { t: 1.55, p: [0.12, R, 0.14] },
        { t: 2.0, p: [-0.03, R, 0.14] },
        { t: 2.25, p: [-0.09, R, 0.09] },
        // Se levanta solo para cruzar la parte fija, de frente, y se acomoda del lado lejano sin
        // apuro; llega hasta acá para dejar cola suficiente para la pasada.
        { t: 2.5, p: [-0.09, 0.045, 0.02] },
        { t: 2.75, p: [-0.09, 0.03, -0.09] },
        { t: 3.0, p: [-0.08, R, -0.2] },
      ],
    },

    // Fase 2: levantar el lado lejano del círculo y pasar la punta por debajo, hacia arriba por el
    // medio y afuera por encima del lado cercano.
    {
      at: 0.6,
      grab: 3.0,
      path: [{ t: 3.3, p: [0.08, 0.05, -0.045] }, { t: 4.0 }, { t: 4.3, p: [0.08, R, -0.045] }],
    },
    {
      at: 1,
      grab: 3.0,
      force: 45, // arrastra la cola pesada por adentro; más liviana, se traba en el borde
      path: [
        { t: 3.35, p: [0.05, R, -0.13] },
        { t: 3.6, p: [0.06, R, -0.04] },
        { t: 3.8, p: [0.06, R, 0.0] },
        { t: 4.05, p: [0.07, 0.05, 0.01] },
        { t: 4.3, p: [0.11, 0.05, 0.07] },
        { t: 4.6, p: [0.2, 0.04, 0.08] },
      ],
    },

    // Fase 3: tirar fuerte de las dos puntas, así el nudo se ajusta: una soga gruesa y rígida
    // necesita un par de cientos de newtons.
    // Los objetivos están donde las dos colas salen parejas, así el nudo (en x ≈ -0.06, con más
    // soga a su izquierda) se queda quieto.
    {
      at: 0,
      grab: 4.6,
      compliance: 0.001,
      force: 250,
      path: [{ t: 5.8, p: [-0.95, 0.04, 0] }, { t: 6.6 }],
    },
    {
      at: 1,
      grab: 4.6,
      compliance: 0.001,
      force: 250,
      path: [{ t: 5.8, p: [0.35, 0.04, 0] }, { t: 6.6 }],
    },
  ],
};
