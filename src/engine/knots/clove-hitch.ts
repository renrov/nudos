import type { KnotDef } from "./types";

// Una barra corre a lo largo de x en z = 0, elevada sobre dos soportes para que la soga pueda pasar
// por debajo; la cámara mira desde +z, así que el lado cercano (+z) es la parte de abajo de la
// pantalla. La parte fija está derecha sobre el lado cercano, desde su extremo en z = 0.45 hasta la
// barra en x = -0.06, y pasa por encima; la punta está del lado lejano en una U que abre hacia la
// derecha, con la punta apuntando a la barra. La parte de arriba de la barra está a 0.449 a lo
// largo de la soga.
const R = 0.012;
const RAIL = 0.016; // radio de la barra
const RAIL_Y = RAIL + 3 * R; // altura del centro de la barra: la soga pasa por debajo sin quedar apretada contra la mesa
const TOP = RAIL_Y + RAIL + R; // altura del centro de la soga apoyada sobre la barra
const SPAN = 0.4; // los soportes están en x = ±SPAN

export const cloveHitch: KnotDef = {
  id: "clove-hitch",
  slug: "ballestrinque",
  name: "Ballestrinque – con la punta",
  summary:
    "Ata una soga a una barra o a un poste en un toque. Se ajusta fácil, pero puede correrse si la carga hace girar la barra.",
  ropes: [
    {
      length: 1.079,
      radius: R,
      start: [
        [-0.06, R, 0.45],
        [-0.06, R, 0.05],
        [-0.06, 0.06, 0.02],
        [-0.06, TOP, 0],
        [-0.06, 0.06, -0.02],
        [-0.06, R, -0.05],
        [-0.03, R, -0.12],
        [0.05, R, -0.18],
        [0.13, R, -0.19],
        [0.18, R, -0.15],
        [0.15, R, -0.1],
        [0.08, R, -0.07],
        [0.03, R, -0.05],
      ],
    },
  ],
  props: [
    { kind: "cylinder", a: [-SPAN - 0.03, RAIL_Y, 0], b: [SPAN + 0.03, RAIL_Y, 0], radius: RAIL },
    { kind: "cylinder", a: [-SPAN, 0, 0], b: [-SPAN, RAIL_Y, 0], radius: RAIL },
    { kind: "cylinder", a: [SPAN, 0, 0], b: [SPAN, RAIL_Y, 0], radius: RAIL },
  ],
  duration: 9.2,
  steps: [
    { t: 0, title: "Apoyá la soga sobre la barra" },
    { t: 0.4, title: "Pasá la punta alrededor y por debajo de la barra" },
    { t: 2.6, title: "Cruzá por encima de la parte fija" },
    { t: 4.0, title: "Dale otra vuelta a la barra" },
    { t: 5.4, title: "Meté la punta por debajo del cruce" },
    { t: 6.8, title: "Tirá de las dos puntas para ajustar" },
    { t: 8.4, title: "Listo: un ballestrinque" },
  ],
  guides: [
    // Sujeta la parte fija justo antes de la barra mientras la punta da la vuelta.
    { at: 0.332, grab: 0.4, path: [{ t: 6.8 }] },

    // La punta. La soga de atrás cae en vueltas sueltas, como cuando se ata a mano; el tirón las ajusta.
    {
      at: 1,
      grab: 0.4,
      force: 150,
      path: [
        // Punta primero, derecho por debajo de la barra hacia el lado cercano, justo a la derecha
        // de la parte fija.
        { t: 1.4, p: [-0.01, R + 0.002, -0.03] },
        { t: 2.1, p: [-0.02, R + 0.002, 0.06] },
        { t: 2.6, p: [-0.01, 0.03, 0.13] },

        // Arriba por encima de la barra hacia el fondo a la izquierda, cruzando por encima de la parte fija.
        { t: 3.0, p: [-0.02, 0.06, 0.08] },
        { t: 3.4, p: [-0.06, TOP + 0.03, 0] },
        { t: 3.7, p: [-0.11, 0.07, -0.07] },
        { t: 4.0, p: [-0.15, 0.04, -0.12] },

        // Abajo por detrás y por debajo de la barra otra vez, a la izquierda de la parte fija.
        { t: 4.4, p: [-0.12, R + 0.002, -0.05] },
        { t: 4.7, p: [-0.12, R + 0.002, 0.06] },
        { t: 5.0, p: [-0.14, 0.03, 0.13] },

        // Arriba por el medio, por debajo del cruce, y afuera hacia el lado lejano. Corre sobre la
        // barra a la izquierda de la parte fija (x ≈ -0.06), no por encima de ella.
        { t: 5.4, p: [-0.11, 0.06, 0.08] },
        { t: 5.9, p: [-0.09, TOP + 0.003, -0.005] },
        { t: 6.3, p: [-0.09, 0.07, -0.08] },
        { t: 6.8, p: [-0.09, 0.04, -0.16] },
      ],
    },

    // Levanta el cruce de la barra para que la punta pueda pasar por debajo, y después lo vuelve a apoyar.
    {
      at: 0.701,
      grab: 5.2,
      path: [
        { t: 5.6, p: [-0.085, TOP + 0.05, -0.01] },
        { t: 6.2 },
        { t: 6.6, p: [-0.085, TOP, -0.01] },
      ],
    },

    // Dos dedos deslizan las vueltas por la barra, una hacia la otra, por debajo de donde están, y
    // las sostienen ahí mientras se tira de las puntas, así el ballestrinque se cierra en lugar de
    // quedar tan ancho como se tendió.
    {
      at: 0.538,
      grab: 6.8,
      compliance: 0.001,
      force: 120,
      path: [{ t: 7.3, p: [-0.067, 2.2 * R, -0.012] }, { t: 8.4 }],
    },
    {
      at: 0.782,
      grab: 6.8,
      compliance: 0.001,
      force: 120,
      path: [{ t: 7.3, p: [-0.123, 2.2 * R, -0.008] }, { t: 8.4 }],
    },

    // Tirar de la punta hacia el lado lejano y de la parte fija hacia el lado cercano. Cada una
    // sale del nudo al lado de la vuelta de la otra y se tira cruzando hacia ella, así las vueltas
    // se cierran a lo largo de la barra.
    {
      at: 1,
      grab: 7.2,
      compliance: 0.001,
      force: 150,
      path: [{ t: 8.0, p: [0.0, R, -0.3] }, { t: 8.4 }],
    },
    {
      at: 0,
      grab: 7.2,
      compliance: 0.001,
      force: 200,
      path: [{ t: 8.0, p: [-0.12, R, 0.66] }, { t: 8.4 }],
    },
  ],
};
