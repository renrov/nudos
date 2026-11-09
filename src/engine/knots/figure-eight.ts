import type { KnotDef } from "./types";

// La soga está tendida a lo largo de x, de -0.9 (extremo fijo) a 1.1 (punta); la cámara mira desde +z.
// En pantalla, +z es el lado cercano (la parte de abajo de las fotos de referencia) y -z es el lado
// lejano (arriba).
// Las guías se ubican con `tip(m)`: m metros de soga hacia atrás desde la punta (x = 1.1 - m al principio).
// El nudo se ata a unos 0.9 m de la punta, así la parte fija sale hacia la izquierda.
// Layout: primero una S (la parte fija, una vuelta en U a la derecha, un tramo de vuelta hacia la
// izquierda por el lado lejano, una curva, la punta yendo a la derecha). Después la curva de arriba
// gira por encima de la parte fija, lo que cierra un ojo chico (centro (0.2, -0.06), radio 0.06) a
// la derecha, que cruza la parte fija en x = 0.15.
const R = 0.012;
const LENGTH = 2;
const tip = (m: number) => 1 - m / LENGTH;

export const figureEight: KnotDef = {
  id: "figure-eight",
  slug: "nudo-de-ocho",
  name: "Nudo de ocho",
  summary:
    "Un tope más grueso que el nudo simple y más fácil de desatar. La vuelta de más es la que dibuja el ocho.",
  ropes: [
    {
      length: LENGTH,
      radius: R,
      start: [
        [-0.9, R, 0],
        [1.1, R, 0],
      ],
    },
  ],
  duration: 17.2,
  steps: [
    { t: 0, title: "Estirá la soga en línea recta" },
    { t: 0.4, title: "Doblá la punta hacia atrás formando una S" },
    { t: 3.9, title: "Pasá la punta por encima de la soga para hacer un bucle chico a la derecha" },
    { t: 7, title: "Pasá la punta por debajo de la soga y subila al lado del bucle" },
    { t: 9.8, title: "Meté la punta hacia abajo por dentro del bucle" },
    { t: 13.2, title: "Tirá de las dos puntas para ajustar" },
    { t: 16.6, title: "Listo: un nudo de ocho" },
  ],
  parts: [
    { name: "punta", at: 0.97 },
    { name: "parte fija", at: 0.3 },
    // El lado lejano del ojo que sostienen los pines.
    { name: "bucle chico", at: tip(0.71), from: 3.9, to: 13.2 },
  ],
  guides: [
    // Los pines del ancla y del ojo sostienen hasta que el tirón toma el control, si no la parte
    // fija se arrastra.
    { at: tip(1.3), grab: 0.4, path: [{ t: 13.6 }] },

    // El ojo, desde su lado derecho hasta el cruce. En la S, son la vuelta en U y el tramo del medio.
    {
      at: tip(0.805), // lado derecho; se vuelve a levantar a los 9.6 para que la punta pase por debajo
      grab: 0.4,
      path: [
        { t: 1.4, p: [0.26, 0.03, -0.03] },
        { t: 2.4, p: [0.26, R, -0.04] },
        { t: 3.9 },
        { t: 4.6, p: [0.26, R, -0.06] },
        { t: 9.6 },
      ],
    },
    {
      at: tip(0.71), // lado lejano
      grab: 0.6,
      path: [
        { t: 1.7, p: [0.2, 0.04, -0.1] },
        { t: 2.7, p: [0.2, R, -0.1] },
        { t: 3.9 },
        { t: 4.7, p: [0.2, R, -0.12] },
        { t: 13.6 },
      ],
    },
    {
      at: tip(0.615), // lado izquierdo
      grab: 0.8,
      path: [
        { t: 2.0, p: [0.1, 0.04, -0.13] },
        { t: 3.0, p: [0.1, R, -0.13] },
        { t: 3.9 },
        { t: 4.9, p: [0.14, R, -0.06] },
        { t: 13.6 },
      ],
    },
    {
      at: tip(0.55), // la curva de arriba de la S, después el cruce: apoya sobre la parte fija
      grab: 1.0,
      path: [
        { t: 2.3, p: [0.03, 0.04, -0.17] },
        { t: 3.3, p: [0.03, R, -0.17] },
        { t: 3.9 },
        { t: 4.4, p: [0.1, 0.06, -0.08] },
        { t: 5.2, p: [0.15, 0.05, 0] },
        { t: 5.6, p: [0.15, 0.036, 0] },
        { t: 13.6 },
      ],
    },

    // La cola de la S. Estos pines la tienden; tip(0.46) suelta, y el resto da vuelta la cabeza todos juntos.
    {
      at: tip(0.46),
      grab: 1.2,
      path: [{ t: 2.5, p: [0.02, 0.04, -0.23] }, { t: 3.5, p: [0.02, R, -0.23] }, { t: 3.9 }],
    },
    {
      at: tip(0.37), // la cabeza de la S
      grab: 1.4,
      path: [
        { t: 2.7, p: [0.1, 0.04, -0.27] },
        { t: 3.6, p: [0.1, R, -0.27] },
        { t: 4.6, p: [0.1, 0.07, -0.17] },
        { t: 5.2, p: [0.09, 0.08, 0.03] },
        { t: 5.9, p: [0.1, R, 0.17] },
        { t: 7 }, // sostiene la parte de arriba de la J mientras la punta se enrosca
      ],
    },
    {
      at: tip(0.23), // evita que la cola más allá de la cabeza ande dando vueltas, y después tiende la parte de abajo de la J
      grab: 1.6,
      path: [
        { t: 2.9, p: [0.22, 0.04, -0.29] },
        { t: 3.7, p: [0.22, R, -0.29] },
        { t: 4.6, p: [0.22, 0.07, -0.18] },
        { t: 5.2, p: [0.22, 0.07, 0.05] },
        { t: 5.7, p: [0.22, 0.04, 0.2] },
        { t: 6.1, p: [0.1, R, 0.27] },
        { t: 6.6, p: [0, R, 0.27] },
        { t: 7 },
      ],
    },
    {
      at: 1,
      grab: 1.8, // al final, así la soga se pliega desde el ojo hacia afuera y nunca pasa por un bucle grande
      force: 35, // levanta la punta y la soga que se arrastra por la mesa; más liviana, se atrasa y después latiguea
      path: [
        { t: 2.5, p: [0.6, 0.06, -0.15] },
        { t: 3.3, p: [0.49, 0.04, -0.29] },
        { t: 3.9, p: [0.48, R, -0.29] }, // la cola queda derecha desde tip(0.23); más cerca, su sobrante se arquea en una onda

        // Toda la cabeza de la S se da vuelta como una página: la cabeza, el medio de la cola y la
        // punta se mueven juntos, manteniendo su separación. Después la punta va adelante hacia la
        // izquierda por el lado cercano y dobla hacia arriba, delante de la mano que tiende la
        // parte de abajo de la J, así la punta apunta a la parte fija.
        { t: 4.6, p: [0.46, 0.07, -0.18] },
        { t: 5.2, p: [0.42, 0.07, 0.05] },
        { t: 5.75, p: [0.2, 0.04, 0.3] },
        { t: 6.1, p: [-0.05, R, 0.28] },
        { t: 6.6, p: [-0.08, R, 0.16] },
        { t: 7, p: [-0.07, R, 0.08] }, // antes de llegar a la parte fija; desde acá la toma la mano de la pasada
      ],
    },

    // Levantar la parte fija en x = -0.03 y pasar la punta por debajo, del lado cercano al lado lejano.
    {
      at: tip(1.1),
      grab: 7.4,
      path: [{ t: 7.9, p: [-0.03, 0.07, 0] }, { t: 8.8 }, { t: 9.3, p: [-0.03, R, 0] }],
    },
    {
      at: 1,
      grab: 7, // desde el lado cercano, donde la dejó la vuelta
      force: 50,
      path: [
        { t: 8, p: [-0.1, R, 0.07] },
        { t: 8.4, p: [-0.03, R, 0] },
        { t: 8.8, p: [-0.02, R, -0.13] },

        // Por encima del lado lejano del ojo, hacia abajo adentro de él, y después por debajo del
        // lado derecho del ojo.
        { t: 9.8, p: [0.12, 0.07, -0.2] },
        { t: 10.4, p: [0.2, 0.07, -0.19] },
        { t: 10.9, p: [0.21, 0.04, -0.09] },
        { t: 11.4, p: [0.23, R, -0.07] },
        { t: 12, p: [0.3, R, -0.06] },
        { t: 12.6, p: [0.38, R, -0.05] },
      ],
    },
    {
      at: tip(0.805), // el lado derecho del ojo se levanta para que la punta pueda deslizarse por debajo
      grab: 9.6,
      path: [{ t: 10.2, p: [0.26, 0.07, -0.05] }, { t: 12.2 }, { t: 12.6, p: [0.26, R, -0.05] }],
    },

    // Tirar fuerte de las dos puntas, así el nudo se ajusta. Los objetivos dejan una cola corta.
    {
      at: 0,
      grab: 13.2,
      compliance: 0.001,
      force: 250,
      path: [{ t: 14.4, p: [-1.09, R, 0] }, { t: 15.2 }, { t: 15.8, p: [-1.07, R, 0] }, { t: 16 }],
    },
    {
      at: 1,
      grab: 13.2,
      compliance: 0.001,
      force: 250,
      path: [{ t: 14.4, p: [0.56, R, 0] }, { t: 15.2 }, { t: 15.8, p: [0.54, R, 0] }, { t: 16 }],
    },

    // Cuando se aprieta, el nudo se para de canto. Mientras las puntas aflojan (arriba), una mano
    // gira su parte de arriba hacia la cámara alrededor del propio centro del nudo, así queda plano
    // y muestra el 8 sin salirse de la línea de la soga.
    {
      at: 0.646,
      grab: 15.2,
      force: 40,
      path: [
        { t: 15.8, p: [0.21, 0.05, 0] },
        { t: 16.2, p: [0.21, 0.033, 0.012] },
        { t: 16.5, p: [0.21, 0.024, 0.02] },
        { t: 16.8 },
      ],
    },
  ],
};
