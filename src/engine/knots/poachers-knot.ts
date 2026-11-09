import type { Guide, KnotDef, Vec3 } from "./types";

// El nudo de cazador furtivo (lazo corredizo de doble nudo simple); la cámara mira desde +z, así
// que +z es la parte de abajo de la pantalla.
// La soga arranca como un seno: la parte fija (S) corre por z = SZ desde S0 hasta la punta del seno
// y vuelve por el lado lejano (T) hasta CORNER. Ahí la punta cruza por encima de S hacia el lado
// cercano y queda tendida a lo largo del lado cercano.
const R = 0.012;
const SZ = 0.03; // los tramos quedan a 2 * SZ de distancia
const S0 = -0.589; // x del extremo fijo
const APEX = 0.27; // x donde el seno empieza a doblar
const TIP = 0.295; // x de la punta del seno
const CORNER = 0.03;
const UP = 0.045; // altura a la que se levanta un tramo
const LENGTH = 1.847;
const T0 = 0.92; // distancia a lo largo de la soga hasta la punta del seno
// La pose inicial: un seno con la punta apoyada sobre S, tal como se acomoda la soga (sacada de un
// bakeo, una de cada cuatro partículas), así nada se mueve al principio.
const start: Vec3[] = [
  [-0.5893, 0.012, 0.03],
  [-0.551, 0.012, 0.03],
  [-0.5128, 0.012, 0.03],
  [-0.4745, 0.012, 0.03],
  [-0.4362, 0.012, 0.03],
  [-0.3979, 0.012, 0.03],
  [-0.3596, 0.012, 0.03],
  [-0.3214, 0.012, 0.03],
  [-0.2831, 0.012, 0.03],
  [-0.2448, 0.012, 0.03],
  [-0.2065, 0.012, 0.03],
  [-0.1682, 0.012, 0.0299],
  [-0.13, 0.012, 0.0294],
  [-0.0917, 0.012, 0.0288],
  [-0.0534, 0.012, 0.0287],
  [-0.0152, 0.012, 0.03],
  [0.0229, 0.012, 0.0337],
  [0.0608, 0.012, 0.0396],
  [0.0983, 0.012, 0.0471],
  [0.1358, 0.012, 0.0547],
  [0.1738, 0.012, 0.0596],
  [0.2119, 0.012, 0.0579],
  [0.2479, 0.012, 0.0453],
  [0.2753, 0.012, 0.0191],
  [0.2856, 0.012, -0.0172],
  [0.2743, 0.012, -0.0533],
  [0.2462, 0.012, -0.0787],
  [0.2098, 0.012, -0.0901],
  [0.1716, 0.012, -0.0897],
  [0.1343, 0.012, -0.0814],
  [0.0989, 0.0131, -0.0672],
  [0.0663, 0.0175, -0.0476],
  [0.0378, 0.025, -0.0233],
  [0.0139, 0.0326, 0.0056],
  [-0.0048, 0.035, 0.0387],
  [-0.017, 0.0291, 0.0744],
  [-0.0216, 0.021, 0.1115],
  [-0.0177, 0.0148, 0.149],
  [-0.0054, 0.0122, 0.185],
  [0.0149, 0.012, 0.2174],
  [0.0419, 0.012, 0.2445],
  [0.0739, 0.012, 0.2653],
  [0.1094, 0.012, 0.2796],
  [0.1467, 0.012, 0.288],
  [0.1848, 0.012, 0.2918],
  [0.223, 0.012, 0.2925],
  [0.2613, 0.012, 0.2917],
  [0.2996, 0.012, 0.2906],
  [0.3378, 0.012, 0.2896],
  [0.3474, 0.012, 0.2893],
];
// Fracción a lo largo de la soga de un punto de S, o de T, en x en la pose inicial (suficientemente
// aproximado: los dos corren casi a lo largo de x).
const onS = (x: number) => (x - S0) / LENGTH;
const onT = (x: number) => (T0 + TIP - x) / LENGTH;

// Una mano que levanta la soga en `at` hasta (x, UP, z) desde `up` hasta `hold`, y la apoya para `down`.
const lift = (at: number, x: number, z: number, grab: number, times: number[]): Guide => ({
  at,
  grab,
  path: [{ t: times[0], p: [x, UP, z] }, { t: times[1] }, { t: times[2], p: [x, R, z] }],
});

const W1 = CORNER + 0.03; // x donde la punta pasa por debajo de los dos tramos: cerca de la vuelta sobre S, así la vuelta queda apretada

export const poachersKnot: KnotDef = {
  id: "poachers-knot",
  slug: "nudo-de-cazador-furtivo",
  name: "Nudo de cazador furtivo",
  summary:
    "Un lazo corredizo de doble nudo simple: un bucle que se cierra solo bajo carga y agarra fuerte. Sirve para trampas de lazo y amarres.",
  ropes: [{ length: LENGTH, radius: R, start }],
  duration: 11.94,
  steps: [
    { t: 0, title: "Hacé un seno y apoyá la punta sobre la parte fija" },
    { t: 0.3, title: "Pasá la punta por debajo de los dos tramos y ajustala un poco" },
    {
      t: 3.37,
      title: "Dale otra vuelta al lado: por encima de los dos tramos y después por debajo",
    },
    {
      t: 8.02,
      title:
        "Juntá las vueltas y después pasá la punta de vuelta por dentro de las dos, hacia la izquierda",
    },
    { t: 10.32, title: "Tirá del seno para un lado y de las dos puntas para el otro para ajustar" },
    { t: 11.23, title: "Listo: un nudo de cazador furtivo" },
  ],
  parts: [
    { name: "punta", at: 0.97 },
    { name: "parte fija", at: onS(-0.3) },
    // La punta del seno, que al final es el lazo que se cierra.
    { name: "seno", at: T0 / LENGTH, to: 10.32 },
    { name: "lazo", at: T0 / LENGTH, from: 10.32 },
  ],
  guides: [
    { at: onS(-0.45), grab: 0.2, force: 250, path: [{ t: 10.32 }] },
    { at: onS(APEX - 0.08), grab: 0.2, force: 250, path: [{ t: 10.32 }] },
    { at: onT(APEX - 0.08), grab: 0.2, force: 250, path: [{ t: 10.32 }] },
    // Levantar los dos tramos donde la punta pasa por debajo.
    lift(onS(W1), W1, SZ, 0.74, [1.47, 2.11, 2.32]),
    lift(onT(W1), W1, -SZ, 0.74, [1.47, 2.11, 2.32]),
    // Se vuelve a levantar mientras la segunda vuelta pasa el anillo de la primera por debajo de ellos.
    lift(onS(W1 - 0.01), W1 - 0.01, SZ, 4.84, [5.33, 5.89, 5.98]),
    lift(onT(W1 + 0.01), W1 + 0.01, -SZ, 4.84, [5.33, 5.89, 5.98]),
    // El paso por debajo de la segunda vuelta: las vueltas separaron S y T acá, así que hay que
    // levantarlos donde están.
    {
      at: onS(W1 + 0.08),
      grab: 5.98,
      path: [
        { t: 6.76, p: [W1 + 0.08, 0.08, 0.05] },
        { t: 7.9 },
        { t: 7.97, p: [W1 + 0.08, R, 0.05] },
      ],
    },
    {
      at: onT(W1 + 0.08),
      grab: 7.3,
      force: 250,
      path: [{ t: 7.5, p: [W1 + 0.08, 0.1, -0.07] }, { t: 7.7 }],
    },
    {
      at: 1,
      grab: 0.3,
      force: 45,
      path: [
        { t: 1.19, p: [W1 + 0.06, R, 0.2] },
        { t: 1.6, p: [W1 + 0.01, R, 0.09] },
        { t: 1.91, p: [W1, R, 0.0] },
        { t: 2.3, p: [W1, R, -0.12] },
      ],
    },
    // Sujeta T justo pasando la vuelta, así el tirón ajusta la vuelta en lugar de sacar la curva de
    // T de abajo de S.
    { at: onT(W1 + 0.04), grab: 2.3, force: 250, path: [{ t: 7.75 }] },
    // La punta tira bien lejos, pasando el sobrante de la primera vuelta por debajo de los dos
    // tramos, así no queda nada flojo debajo del seno.
    {
      at: 1,
      grab: 2.3,
      compliance: 0.001,
      force: 250,
      path: [
        { t: 2.92, p: [W1 + 0.02, R, -0.3] },
        { t: 3.34, p: [W1 + 0.03, R, -0.42] },
        { t: 3.37 },
      ],
    },
    // Segunda vuelta: de nuevo por encima de los dos tramos, justo al lado de la primera.
    {
      at: 1,
      grab: 3.37,
      force: 45,
      path: [
        { t: 4.46, p: [W1 + 0.04, 0.05, -0.08] },
        { t: 5, p: [W1 + 0.04, 0.05, 0.06] },
        { t: 5.28, p: [W1 + 0.05, R, 0.14] },
      ],
    },
    // Tirar hacia abajo ajusta el anillo de la primera vuelta alrededor de los tramos; T se
    // sostiene a la derecha de las vueltas para que su curva quede debajo de ellas.
    { at: onT(W1 + 0.14), grab: 5.23, force: 250, path: [{ t: 5.92 }] },
    {
      at: 1,
      grab: 5.28,
      compliance: 0.001,
      force: 250,
      path: [{ t: 5.89, p: [W1 + 0.05, R, 0.32] }, { t: 5.92 }],
    },
    // Después de nuevo por debajo de los dos, con un tirón suave: las vueltas dejan lugar para que
    // la punta vuelva a pasar.
    {
      at: 1,
      grab: 5.92,
      force: 45,
      path: [
        { t: 6.64, p: [W1 + 0.08, R, 0.12] },
        { t: 6.84, p: [W1 + 0.08, R, 0.06] },
        { t: 7.03, p: [W1 + 0.08, R, 0.0] },
        { t: 7.75, p: [W1 + 0.08, R, -0.16] },
        { t: 7.95, p: [W1 + 0.1, R, -0.24] },
        { t: 8.02 },
      ],
    },
    // Antes de la pasada, las dos vueltas se empujan de costado una contra la otra para que queden
    // lado a lado sin espacio, y se levantan sus partes de arriba. La primera se sostiene desde la
    // segunda vuelta en adelante, así no se cae hacia la derecha.
    {
      at: 0.69,
      grab: 5.23,
      force: 60, // firme, si no la punta empuja la parte de arriba hacia abajo al pasar por debajo
      path: [
        { t: 5.33, p: [-0.01, 4.5 * R, 0.01] },
        { t: 8.02 },
        { t: 8.24, p: [0.0, 0.1, 0.02] },
        { t: 9.46 },
        // Se levanta un poco más mientras pasa la punta, así se queda quieta y deja lugar.
        { t: 9.56, p: [0.0, 0.13, 0.02] },
        { t: 10.12 },
      ],
    },
    // Durante el tirón, una mano más suave la mantiene junto a la segunda vuelta; una firme pelea
    // contra el tirón del seno y estira la soga.
    {
      at: 0.69,
      grab: 10.12,
      force: 25,
      path: [
        // Se mantienen juntas durante el tirón y hasta el final, bajándolas suave sobre el nudo: si
        // se sueltan, la primera queda lo bastante floja para alejarse de la segunda.
        { t: 10.32, p: [0.0, 6.5 * R, 0.02] },
        { t: 11.11, p: [0.01, 6 * R, 0.02] },
        { t: 11.65 },
      ],
    },
    {
      at: 0.84,
      grab: 8.02,
      path: [
        { t: 8.24, p: [0.03, 0.1, 0.0] },
        { t: 10.12 },
        { t: 10.32, p: [0.03, 6.5 * R, 0.0] },
        { t: 11.11, p: [0.035, 6 * R, 0.0] },
        { t: 11.65 },
      ],
    },
    // Pasada: entra por encima de T al lado de la segunda vuelta, después a la izquierda por
    // adentro de las dos vueltas por encima de S, por debajo de sus partes de arriba, y sale al
    // lado de la parte fija.
    {
      at: 1,
      grab: 8.02,
      force: 120,
      path: [
        { t: 8.24 },
        { t: 8.74, p: [0.21, 0.05, -0.08] },
        { t: 9.01, p: [0.2, 3 * R, 0] },
        // Por el medio de las dos vueltas: por encima de S, por debajo de sus partes de arriba levantadas.
        { t: 9.35, p: [0.1, 5 * R, 0] },
        { t: 9.52, p: [0.04, 5 * R, 0] },
        { t: 9.74, p: [-0.04, 5 * R, 0] },
        // Sale por la izquierda, despacio y solo hasta donde va libre: un objetivo muy por delante
        // de la punta la arranca de un tirón apenas queda libre. El tirón final saca la cola.
        { t: 9.92, p: [-0.07, 4 * R, 0] },
        { t: 10.07, p: [-0.09, 3 * R, 0] },
        { t: 10.23, p: [-0.11, 2 * R, -0.01] },
        { t: 10.32 },
      ],
    },
    // Apretar, despacio, con las vueltas todavía juntas: la punta del seno hacia la derecha, contra
    // la punta y el extremo fijo hacia la izquierda, con la misma fuerza entre ellos; la punta tira más fuerte.
    {
      at: T0 / LENGTH, // la punta del seno
      grab: 10.32,
      force: 64,
      path: [{ t: 11.11, p: [APEX + SZ + 0.1, R, 0] }, { t: 11.65 }],
    },
    {
      at: 1,
      grab: 10.32, // toma la punta después de la pasada
      force: 48,
      path: [{ t: 11.11, p: [-0.32, R, -0.03] }, { t: 11.65 }],
    },
    {
      at: 0,
      grab: 10.32,
      force: 16,
      path: [{ t: 11.11, p: [S0 - 0.1, R, SZ] }, { t: 11.65 }],
    },
  ],
};
