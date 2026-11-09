import type { Guide, KnotDef } from "./types";

// La soga está tendida a lo largo de x, de -0.55 (extremo izquierdo) a 2.95 (punta); la cámara mira desde +z.
// Los puntos se nombran por su distancia al extremo izquierdo, `A(s)`, así un punto arranca en x = s - 0.55.
// La cola izquierda se queda donde está y ninguna mano toca la punta hasta el cierre: cada eslabón
// es un seno de la parte larga que se pasa hacia arriba por el último bucle, así la parte larga se
// va deslizando a medida que la cadena la consume.
const R = 0.012;
const L = 3.5; // larga: el lazo y cada eslabón consumen soga, y la punta igual tiene que llegar de vuelta para el cierre
const A = (s: number) => s / L;
const Z = 0.04; // la soga queda un poco hacia la cámara, para dejar lugar a los bucles de atrás

/**
 * Un eslabón, que arranca en el tiempo `t`: dos manos abren el último bucle (su extremo en x, a
 * `tip` metros del extremo izquierdo) por los costados, y una mano pasa un seno de la parte larga
 * (a `next` metros del extremo izquierdo) por debajo, hacia arriba por adentro, lo apoya a lo largo
 * de la soga y después lo sostiene levantado como el próximo bucle.
 */
function link(
  t: number,
  x: number,
  tip: number,
  next: number,
  side = 0.06,
  back = 0.05,
  reach = 0.12,
  release = t + 6.4, // el bucle nuevo se sostiene levantado hasta que pasa el próximo eslabón (o el cierre)
): Guide[] {
  const open = (side: number, dz: number): Guide => ({
    at: A(tip + side),
    grab: t,
    force: 300,
    path: [{ t: t + 0.5, p: [x - back, 0.05, Z + dz] }, { t: t + 3.0 }],
  });
  return [
    open(-side, -0.04),
    open(side, 0.04),
    {
      // Se mueve despacio: la parte larga se desliza detrás, y un tirón rápido la hace latiguear.
      at: A(next),
      grab: t + 0.5,
      force: 150,
      path: [
        { t: t + 1.3, p: [x - back, R, Z + 0.09] },
        { t: t + 1.7, p: [x - back, R, Z] },
        { t: t + 2.1, p: [x - back, 0.09, Z] },
        { t: t + 2.7, p: [x + reach * 0.7, 0.04, Z] },
        { t: t + 3.0, p: [x + reach, R, Z] },
        { t: t + 3.5, p: [x + reach, 0.03, Z] },
        { t: release },
        { t: release + 0.4, p: [x + reach, R, Z] },
      ],
    },
  ];
}

export const daisyChain: KnotDef = {
  id: "daisy-chain",
  slug: "cadeneta",
  name: "Cadeneta",
  summary:
    "Una cadena de bucles, cada uno pasado por el anterior. Acorta una soga larga para guardarla y se deshace de un tirón cuando soltás la punta.",
  ropes: [
    {
      length: L,
      radius: R,
      start: [
        [-0.55, R, Z],
        [L - 0.55, R, Z],
      ],
    },
  ],
  duration: 32,
  steps: [
    { t: 0, title: "Estirá la soga en línea recta" },
    { t: 0.4, title: "Hacé un bucle" },
    {
      t: 3.9,
      title: "Apoyá un seno de la parte larga sobre el bucle y sacalo por debajo del lado lejano",
    },
    { t: 5.6, title: "Tirá de la punta corta para cerrar el lazo" },
    { t: 6.8, title: "Girá el seno para que apunte a lo largo de la soga" },
    { t: 8.4, title: "Pasá un seno de la parte larga hacia arriba por el bucle" },
    { t: 12.1, title: "Repetí: pasá el siguiente seno hacia arriba por el bucle más nuevo" },
    { t: 26.6, title: "Pasá la punta por el último bucle para trabar la cadena" },
    {
      t: 30.6,
      title: "Listo: una cadeneta. Soltá la punta y tirá de ella para deshacer la cadena",
    },
  ],
  parts: [
    { name: "punta corta", at: A(0.05) },
    // El primer bucle mientras se arma, y el seno que se pasa por él, cierra el lazo y queda como
    // el bucle por el que pasa el primer eslabón.
    { name: "bucle", at: A(0.601), from: 0.4, to: 3.9 },
    { name: "seno", at: A(1.071), from: 3.9, to: 8.4 },
    { name: "bucle", at: A(1.071), from: 8.4, to: 11.4 },
    // Cada eslabón (ver `link` en guides): el seno que pasa una mano, que después es el bucle más
    // nuevo, hasta que lo atraviesa el seno siguiente.
    { name: "seno", at: A(1.43), from: 8.4, to: 11.4 },
    { name: "bucle", at: A(1.43), from: 11.4, to: 15.1 },
    { name: "seno", at: A(1.79), from: 12.1, to: 15.1 },
    { name: "bucle", at: A(1.79), from: 15.1, to: 18.8 },
    { name: "seno", at: A(2.15), from: 15.8, to: 18.8 },
    { name: "bucle", at: A(2.15), from: 18.8, to: 22.5 },
    { name: "seno", at: A(2.57), from: 19.5, to: 22.5 },
    { name: "bucle", at: A(2.57), from: 22.5, to: 26.2 },
    { name: "seno", at: A(2.99), from: 23.2, to: 26.2 },
    { name: "último bucle", at: A(2.99), from: 26.2 },
    // Lo que queda libre de la parte larga, que la cadena va consumiendo.
    { name: "parte larga", at: A(1.6), to: 8.4 },
    { name: "parte larga", at: A(3.2), from: 8.4, to: 26.6 },
    { name: "punta", at: 0.99, from: 26.6 },
  ],
  guides: [
    // Sostener la soga donde se va a cruzar el bucle, y levantarla un poco para que el otro lado pase por debajo.
    {
      at: A(0.399),
      grab: 0.4,
      path: [
        { t: 1.4 },
        { t: 1.8, p: [-0.15, 0.045, Z] },
        { t: 3.4 },
        { t: 3.7, p: [-0.15, R, Z] },
      ],
    },
    // Llevar el medio del bucle hacia atrás formando una U; la parte larga se desliza para alimentarla.
    { at: A(0.601), grab: 0.4, path: [{ t: 1.4, p: [-0.1, R, -0.07] }, { t: 3.7 }] },
    // Llevar el lado derecho de la U hacia la izquierda, por debajo de la soga levantada, para cerrar el bucle.
    {
      at: A(0.811),
      grab: 1.4,
      force: 120,
      path: [
        { t: 2.0, p: [0.0, R, Z + 0.01] },
        { t: 2.7, p: [-0.14, R, Z + 0.01] },
        { t: 3.0, p: [-0.2, R, Z + 0.01] },
        { t: 3.7 },
      ],
    },

    // El lazo: apoyar un seno de la parte larga sobre el lado cercano del bucle y sacarlo por
    // debajo del lado lejano, que levanta una mano.
    {
      at: A(0.63),
      grab: 4.3,
      path: [{ t: 4.7, p: [-0.13, 0.07, -0.08] }, { t: 5.3 }, { t: 5.6, p: [-0.13, R, -0.07] }],
    },
    {
      at: A(1.071),
      grab: 3.9,
      force: 150,
      path: [
        { t: 4.4, p: [-0.12, 0.04, 0.07] },
        { t: 4.8, p: [-0.13, R, -0.01] },
        { t: 5.2, p: [-0.13, R, -0.11] },
        { t: 5.6, p: [-0.06, R, -0.11] },
        { t: 6.8 },
        { t: 7.5, p: [0.0, R, -0.05] },
        { t: 8.1, p: [-0.03, R, Z] },
        { t: 8.9, p: [-0.02, 0.03, Z] },
        { t: 11.1 },
        { t: 11.5, p: [-0.02, R, Z] },
        { t: 11.6 },
      ],
    },
    // Cerrar el lazo: tirar de la punta corta mientras el seno se queda quieto; la parte larga
    // alimenta el seno.
    {
      at: A(0.273),
      grab: 3.9,
      force: 400,
      compliance: 0.001,
      path: [{ t: 5.6 }, { t: 6.8, p: [-0.45, R, Z] }, { t: 7.0 }],
    },
    // Sostener la punta corta mientras se arma la cadena, si no cada tirón arrastra el nudo.
    { at: A(0.273), grab: 7.0, force: 400, path: [{ t: 31 }] },

    ...link(8.4, -0.02, 1.071, 1.43, 0.063, 0.06),
    ...link(12.1, 0.09, 1.43, 1.79),
    ...link(15.8, 0.19, 1.79, 2.15),
    ...link(19.5, 0.26, 2.15, 2.57, 0.06, 0.05, 0.16),
    ...link(23.2, 0.4, 2.57, 2.99, 0.06, 0.05, 0.16, 28.7),

    // El cierre: abrir el último bucle y pasar la punta misma por él, como los eslabones pasaban un seno.
    // Una vez que la punta subió, todas las manos del bucle sueltan y la punta se termina de pasar.
    {
      at: A(2.99 - 0.06),
      grab: 26.6,
      force: 300,
      path: [
        { t: 27.1, p: [0.36, 0.05, Z - 0.04] },
        { t: 28.6 },
        { t: 29.0, p: [0.36, R, Z - 0.03] },
      ],
    },
    {
      at: A(2.99 + 0.06),
      grab: 26.6,
      force: 300,
      path: [
        { t: 27.1, p: [0.36, 0.05, Z + 0.04] },
        { t: 28.6 },
        { t: 29.0, p: [0.36, R, Z + 0.03] },
      ],
    },
    {
      at: 1,
      grab: 25.8,
      force: 150,
      path: [
        { t: 27.3, p: [0.5, R, Z + 0.1] },
        { t: 27.8, p: [0.37, R, Z + 0.09] },
        { t: 28.2, p: [0.36, R, Z] },
        { t: 28.6, p: [0.36, 0.09, Z] },
        { t: 29.2, p: [0.46, 0.04, Z] },
        { t: 30.4, p: [0.75, R, Z] },
        { t: 30.6 },
      ],
    },
  ],
};
