import type { KnotDef, Vec3 } from "./types";

// El nudo llano (de rizo) que une dos sogas, atado a través de un seno; la cámara mira desde +z,
// así que +z es la parte de abajo de la pantalla. Las dos sogas arrancan derechas: la beige (soga
// 1) desde la derecha, con su punta llegando bastante más allá del origen, y la azul (soga 0) desde
// la izquierda, un poco más cerca de la cámara. La punta beige se dobla hacia atrás, a la derecha,
// formando una C: la parte fija del lado cercano, la curva alrededor de la izquierda del origen, la
// cola del lado lejano. La punta azul entra por debajo de la curva y sale por encima de la pata
// cercana, pasa por debajo de las dos patas, vuelve por encima de la pata lejana y baja por adentro
// de la C al lado de su propia parte fija, así las dos partes azules salen por el mismo lado. Tirar
// de las cuatro puntas.
const R = 0.012;
const W = 0.044; // radio de la C beige: apretado, así la curva se lleva poca cola
// La cola de la C llega hasta x = 0.285 del lado lejano: corta, así termina tan larga como la cola
// azul. La punta azul gira alrededor de su extremo, lo que ata el mismo nudo que pasar por debajo.
const TAN_END = 0.285;
const BLUE_Z = 0.015; // la azul corre por adentro de la C un poco hacia el lado cercano, dejando lugar para su punta
const BLUE_END: Vec3 = [-0.18, R, 0.12]; // la punta azul arranca lejos de donde rueda la curva beige
const BLUE = 1.37;
const TAN = 0.85 + Math.PI * W + TAN_END;
const tanStart: Vec3[] = [
  [0.85, R, W],
  [0.85 - TAN, R, W],
];
const blueStart: Vec3[] = [[BLUE_END[0] - BLUE, R, BLUE_END[2]], BLUE_END];
// Fracción a lo largo de cada soga de un punto dado por su distancia al extremo fijo.
const blue = (d: number) => d / BLUE;
const tan = (d: number) => d / TAN;
const T_RIM = 0.85; // beige: donde arranca la C (pata cercana en x = 0)
const T_FAR = T_RIM + Math.PI * W; // y donde arranca la pata lejana

export const squareKnot: KnotDef = {
  id: "square-knot",
  slug: "nudo-llano",
  name: "Nudo llano",
  summary:
    "También llamado nudo de rizo o cuadrado. Une dos puntas bien ajustadas, para atados, vendajes y tomar rizos en una vela; no sirve para cargas importantes.",
  ropes: [
    { length: BLUE, radius: R, color: "#2f5fb3", start: blueStart },
    { length: TAN, radius: R, start: tanStart },
  ],
  duration: 13.9,
  steps: [
    { t: 0, title: "Doblá hacia atrás la punta beige formando una C" },
    {
      t: 2.6,
      title:
        "Punta azul: entra por debajo de la curva de la C y sale por encima de su pata cercana",
    },
    { t: 5.2, title: "Punta azul: por debajo de las dos patas de la C" },
    { t: 7.3, title: "Punta azul: vuelve por encima de la pata lejana y baja por dentro de la C" },
    { t: 9.9, title: "Tirá de las puntas y después de las partes fijas para asentar el nudo" },
    { t: 13.3, title: "Listo: un nudo llano" },
  ],
  guides: [
    // La punta beige encabeza el pliegue hacia la derecha por el lado lejano; la curva rueda detrás
    // y se detiene alrededor del origen. Una mano sostiene donde va a empezar la C.
    { rope: 1, at: tan(T_RIM), grab: 0.2, path: [{ t: 2.8 }] },
    {
      rope: 1,
      at: 1,
      grab: 0.2,
      path: [
        { t: 0.6, p: [0.85 - TAN + 0.04, 0.03, -W] },
        { t: 2.6, p: [TAN_END, R, -W] },
      ],
    },
    // Levantar la curva de la C mientras la punta azul entra por debajo.
    {
      rope: 1,
      at: tan(T_RIM + (Math.PI * W) / 2),
      grab: 2.6,
      path: [{ t: 3.0, p: [-W, 0.05, 0] }, { t: 3.7 }, { t: 4.1, p: [-W, R, 0] }, { t: 4.2 }],
    },
    // Sostener quietas la parte fija azul y la curva de la C mientras se trabaja con la punta.
    { at: blue(0.5), grab: 4.4, path: [{ t: 9.9 }] },
    {
      rope: 1,
      at: tan(T_RIM + 0.75 * Math.PI * W),
      grab: 4.2,
      path: [
        { t: 7.7 },
        // Levantar la esquina lejana del borde para que la punta pueda zambullirse por debajo.
        { t: 8.2, p: [-0.035, 0.055, -0.035] },
        { t: 9.4 },
        { t: 9.7, p: [-0.035, R, -0.035] },
        { t: 9.9 },
      ],
    },
    // Una mano pellizca las dos patas de la C y las levanta para que la punta pueda pasar por debajo.
    {
      rope: 1,
      at: tan(T_RIM - 0.28),
      grab: 5.2,
      path: [{ t: 5.7, p: [0.28, 0.08, W] }, { t: 6.9 }, { t: 7.3, p: [0.28, R, W] }, { t: 9.9 }],
    },
    {
      rope: 1,
      at: tan(T_FAR + 0.28),
      grab: 5.2,
      path: [{ t: 5.7, p: [0.28, 0.08, -W] }, { t: 6.9 }, { t: 7.3, p: [0.28, R, -W] }, { t: 9.9 }],
    },
    {
      at: 1,
      grab: 2.6,
      force: 90, // arrastra toda la soga azul; más liviana, se atrasa y no agarra la pata cercana
      path: [
        // Entra por debajo de la curva levantada, por encima de la pata cercana y sale hacia la derecha.
        { t: 3.3, p: [-0.1, R, 0.02] },
        { t: 4.0, p: [0.06, R, BLUE_Z] },
        { t: 4.3, p: [0.1, 0.05, W] },
        { t: 4.6, p: [0.14, R, 0.1] },
        { t: 5.2, p: [0.53, R, 0.1] },
        // Gira como una página por debajo de la pata cercana levantada y alrededor de la punta de
        // la pata lejana, se enrosca por encima de la pata lejana hacia adentro de la C, después
        // baja por debajo de la esquina lejana del borde y sale.
        { t: 5.9, p: [0.44, R, 0.0] },
        { t: 6.3, p: [0.35, R, -0.08] },
        { t: 6.7, p: [0.27, R, -0.16] },
        { t: 7.1, p: [0.19, R, -0.19] },
        { t: 7.45, p: [0.19, 0.06, -0.1] },
        { t: 7.75, p: [0.15, 0.06, -0.03] },
        { t: 8.05, p: [0.1, R, -0.015] },
        { t: 8.4, p: [0.03, R, -0.02] },
        { t: 8.8, p: [-0.03, R, -0.04] },
        { t: 9.3, p: [-0.09, R, -0.1] },
        { t: 9.9, p: [-0.12, R, -0.18] },
      ],
    },

    // Tirar de las dos puntas juntas un poco hacia arriba de la pantalla, en espejo respecto del
    // nudo, y sostenerlas mientras se separan las partes fijas, así el bucle azul y la C beige se
    // ajustan al mismo tiempo; después soltar para que el nudo se vuelva a acomodar sobre la línea
    // de las partes fijas.
    {
      at: 1,
      grab: 9.9,
      compliance: 0.001,
      force: 450,
      path: [
        { t: 10.7, p: [-0.16, 0.04, -0.16] },
        { t: 11.4, p: [-0.12, 0.04, -0.13] },
        { t: 12.4 },
      ],
    },
    {
      rope: 1,
      at: 1,
      grab: 9.9,
      compliance: 0.001,
      force: 450,
      path: [{ t: 10.7, p: [0.24, 0.04, -0.16] }, { t: 11.4, p: [0.2, 0.04, -0.13] }, { t: 12.4 }],
    },
    {
      at: 0,
      grab: 10.7,
      compliance: 0.001,
      force: 450,
      path: [{ t: 12.5, p: [-1.15, 0.04, 0] }, { t: 13.3 }],
    },
    {
      rope: 1,
      at: 0,
      grab: 10.7,
      compliance: 0.001,
      force: 450,
      path: [{ t: 12.5, p: [1.15, 0.04, 0] }, { t: 13.3 }],
    },
  ],
};
