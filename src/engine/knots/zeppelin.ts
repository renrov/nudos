import type { KnotDef, Vec3 } from "./types";

// El nudo Zeppelin "6 y 9" con dos sogas; la cámara mira desde +z, así que +z es la parte de abajo de la pantalla.
// Las dos puntas arrancan dobladas en senos en forma de U alrededor del origen: la roja (soga 1)
// entra desde la derecha por el lado lejano, dobla a la izquierda en una U chica (radio RR) y
// vuelve hacia la derecha por el lado cercano; la azul (soga 0) entra desde la izquierda por el
// lado cercano, dobla a la derecha en una U más grande (radio BR) que queda sobre la roja, y vuelve
// hacia la izquierda por el lado lejano. Después cada punta cruza su propia parte fija y cierra su
// U en un bucle: la punta roja pasa POR DEBAJO (el 9), la azul pasa POR ENCIMA (el 6, arriba). Los
// dos bucles giran en sentido antihorario en pantalla. La cola azul se enrosca por debajo de los
// bordes cercanos y sube por el medio; la cola roja se enrosca por encima de los bordes lejanos y
// baja por el medio, pasándolo. Tirar de las cuatro puntas.
const R = 0.012;
const RR = 0.045; // radio de la U roja
const BR = 0.052; // radio de la U azul: rodea por afuera a la roja, así solo apoya sobre la roja donde se cruzan
const RED_END = 0.47; // la cola roja llega hasta x = 0.47 del lado cercano
const BLUE_END = -0.54; // la cola azul llega hasta x = -0.54 del lado lejano

/** Derecho desde `from` por z = side * r, alrededor de una U de radio r en torno al origen, derecho hasta `to`. */
function bight(from: number, r: number, side: 1 | -1, to: number, lifted: boolean): Vec3[] {
  const dir = Math.sign(-from); // dirección de la parte fija
  const points: Vec3[] = [[from, R, side * r]];
  for (let deg = 90; deg >= -90; deg -= 15) {
    const a = (deg * Math.PI) / 180;
    const z = side * r * Math.sin(a);
    // La U azul cruza los tramos de la roja (z = ±RR) por encima.
    const y = lifted && Math.abs(Math.abs(z) - RR) < 0.025 ? 3.2 * R : R;
    points.push([dir * r * Math.cos(a), y, z]);
  }
  points.push([to, R, -side * r]);
  return points;
}
const length = (p: Vec3[]) =>
  p.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - p[i][0], q[1] - p[i][1], q[2] - p[i][2]), 0);

const blueStart = bight(-0.92, BR, 1, BLUE_END, true);
const redStart = bight(0.83, RR, -1, RED_END, false);
const BLUE = length(blueStart);
const RED = length(redStart);
// Fracción a lo largo de cada soga de un punto dado por su distancia al extremo fijo.
const blue = (d: number) => d / BLUE;
const red = (d: number) => d / RED;
const B_IN = 0.92; // azul: donde arranca la U (abajo), y su parte de arriba
const B_TOP = B_IN + Math.PI * BR;
const R_IN = 0.83; // roja: donde arranca la U (arriba), y su parte de abajo
const R_LOW = R_IN + Math.PI * RR;

export const zeppelin: KnotDef = {
  id: "zeppelin",
  slug: "nudo-zeppelin",
  name: "Nudo Zeppelin",
  summary: "Une dos sogas de forma segura. Aguanta mucha carga y aun así después se desata fácil.",
  ropes: [
    { length: BLUE, radius: R, color: "#2b4a79", start: blueStart },
    { length: RED, radius: R, color: "#c62f2b", start: redStart },
  ],
  duration: 11.7,
  // Cada movimiento arranca mientras termina el anterior, así las manos nunca quedan todas quietas.
  steps: [
    { t: 0, title: "Doblá las dos puntas en forma de U, la azul sobre la roja" },
    { t: 0.2, title: "Punta roja: por debajo de su propia soga, cerrando un bucle" },
    { t: 2.0, title: "Punta azul: por encima de su propia soga, cerrando un bucle arriba" },
    { t: 4.0, title: "Cola azul: por debajo del lado cercano y hacia arriba por los dos bucles" },
    { t: 6.4, title: "Cola roja: por encima del lado lejano y hacia abajo por los dos bucles" },
    { t: 8.9, title: "Tirá de las colas y después de las partes fijas para asentar el nudo" },
    { t: 11.1, title: "Listo: un nudo Zeppelin" },
  ],
  parts: [
    { name: "punta", at: 0.97 },
    { name: "punta", rope: 1, at: 0.97 },
    { name: "parte fija", at: blue(0.6) },
    { name: "parte fija", rope: 1, at: red(0.55) },
    // La parte de abajo de cada U, que sostienen las manos mientras pasan las colas.
    { name: "bucle", rope: 1, at: red(R_LOW), from: 2.0, to: 8.9 },
    { name: "bucle", at: blue(B_TOP), from: 4.0, to: 8.9 },
  ],
  guides: [
    // Las manos sostienen cada U donde está, así llevar las colas en redondo no puede sacar los
    // bucles de su lugar.
    // Los bordes cercanos (la parte de abajo de la roja y de la azul) se levantan cuando da la
    // vuelta la cola azul, así las dos colas pueden pasar por debajo.
    { rope: 1, at: red(R_IN), grab: 0.2, path: [{ t: 8.9 }] },
    {
      rope: 1,
      at: red(R_LOW),
      grab: 0.2,
      path: [
        { t: 4.4 },
        { t: 4.9, p: [0, 0.04, RR] },
        { t: 8.4 },
        { t: 8.8, p: [0, R, RR] },
        { t: 8.9 },
      ],
    },
    { at: blue(B_TOP), grab: 2.0, path: [{ t: 8.9 }] },
    {
      at: blue(B_IN),
      grab: 2.0,
      path: [
        { t: 4.4 },
        { t: 4.9, p: [0, 0.045, BR] },
        { t: 8.4 },
        { t: 8.8, p: [0, R, BR] },
        { t: 8.9 },
      ],
    },

    // Roja: levantar la parte fija más allá del bucle para que la punta pueda girar por debajo.
    {
      rope: 1,
      at: red(R_IN - 0.45),
      grab: 0.2,
      path: [{ t: 0.7, p: [0.45, 0.07, -RR] }, { t: 2.0 }, { t: 2.4, p: [0.45, R, -RR] }],
    },
    {
      rope: 1,
      at: 1,
      grab: 0.2,
      force: 45,
      path: [
        // La cola gira alrededor de la derecha de la U como una página, baja sobre la mesa, por
        // debajo de la parte fija levantada hacia el lado lejano.
        { t: 1.1, p: [0.43, R, -0.18] },
        { t: 1.7, p: [0.3, R, -0.27] },
        { t: 2.4, p: [0.15, R, -0.33] },
        { t: 6.4 },

        // La pasada: de nuevo por encima de los dos bordes lejanos, hacia abajo por el medio,
        // afuera por debajo de los bordes cercanos.
        { t: 7.0, p: [0.06, 0.04, -0.22] },
        { t: 7.5, p: [0.02, 0.06, -0.1] },
        { t: 7.9, p: [0.02, 0.05, -0.03] },
        { t: 8.3, p: [0.02, R, 0.04] },
        { t: 8.9, p: [0.02, R, 0.19] },
      ],
    },

    // Azul: la mano levanta la cola y la gira alrededor de la parte de arriba de la U como una
    // página, por encima de su propia parte fija, y sin parar la curva de vuelta por debajo de los
    // dos bordes cercanos, hacia arriba por el medio y por encima de los bordes lejanos.
    {
      at: 1,
      grab: 2.0,
      force: 45,
      path: [
        { t: 2.6, p: [-0.52, 0.08, 0.12] },
        { t: 3.2, p: [-0.39, 0.1, 0.32] },
        { t: 3.7, p: [-0.22, 0.06, 0.45] },
        { t: 4.2, p: [-0.15, R, 0.42] },
        { t: 4.8, p: [-0.07, R, 0.27] },
        { t: 5.3, p: [-0.02, R, 0.12] },
        { t: 5.7, p: [-0.02, R, 0.04] },
        { t: 6.1, p: [-0.02, 0.05, -0.02] },
        { t: 6.5, p: [-0.02, 0.06, -0.11] },
        { t: 6.9, p: [-0.02, R, -0.17] },
        { t: 8.9 },
      ],
    },

    // Tirar de las colas hacia sus costados, cerrando los dos bucles, y después separar las partes fijas.
    {
      at: 0,
      grab: 9.3,
      compliance: 0.001,
      force: 450,
      path: [{ t: 10.7, p: [-1.3, 0.04, 0] }, { t: 11.1 }],
    },
    {
      rope: 1,
      at: 0,
      grab: 9.3,
      compliance: 0.001,
      force: 450,
      path: [{ t: 10.7, p: [1.2, 0.04, 0] }, { t: 11.1 }],
    },
    {
      at: 1,
      grab: 8.9,
      compliance: 0.001,
      force: 450,
      path: [{ t: 10.0, p: [0.0, 0.04, -0.4] }, { t: 11.1 }],
    },
    {
      rope: 1,
      at: 1,
      grab: 8.9,
      compliance: 0.001,
      force: 450,
      path: [{ t: 10.0, p: [0.0, 0.04, 0.4] }, { t: 11.1 }],
    },
  ],
};
