import type { KnotDef } from "./types";

// La soga está tendida a lo largo de x, de -0.55 (extremo fijo) a 1.25 (punta); la cámara mira desde +z.
// En pantalla, +z es el lado cercano y -z el lado lejano. Un punto arranca en x = at * 1.8 - 0.55.
// Layout (vista de arriba): el bucle chico (lóbulo, radio 0.06) está centrado en (-0.01, 0), así el
// nudo queda en el medio de la escena; la parte fija entra desde la izquierda y el lado de la gaza
// la cruza por encima en (-0.08, 0). La gaza queda a la derecha, con su pata cercana en z = 0.09, y
// la cola sube por el lóbulo, rodea la parte fija en x = -0.14 y vuelve a bajar por el lóbulo.
const R = 0.012;
const LENGTH = 1.8;
const LIFT = 0.06; // un tramo levantado para que la punta pueda pasar por debajo

export const bowline: KnotDef = {
  id: "bowline",
  slug: "as-de-guia",
  name: "As de guía",
  summary:
    "Una gaza fija en la punta de la soga que no se corre ni se traba, y se desata fácil después de aguantar carga.",
  ropes: [
    {
      length: LENGTH,
      radius: R,
      start: [
        [-0.55, R, 0],
        [1.25, R, 0],
      ],
    },
  ],
  duration: 18,
  steps: [
    { t: 0, title: "Estirá la soga en línea recta" },
    { t: 0.4, title: "Hacé un bucle chico, con el lado de la punta arriba" },
    { t: 3.4, title: "Llevá la punta en redondo para formar la gaza" },
    { t: 7, title: "Subila por el bucle chico desde abajo" },
    { t: 9.6, title: "Rodeá la parte fija por detrás" },
    { t: 11.9, title: "Volvé a bajar por el bucle chico" },
    { t: 14.5, title: "Sostené la cola contra la gaza y tirá de la parte fija" },
    { t: 17.4, title: "Listo: un as de guía" },
  ],
  guides: [
    // Sujeta la parte fija contra la mesa; una vez que la punta la rodeó, tirar de la punta la
    // haría girar para cualquier lado.
    { at: 0.06, grab: 0.4, path: [{ t: 14.9 }] },

    // El bucle chico. Estos lo sostienen en su lugar hasta que el tirón toma el control.
    {
      at: 0.175, // lado fijo del cruce
      grab: 0.4,
      path: [{ t: 1.4, p: [-0.067, R, 0.01] }, { t: 14.9 }],
    },
    {
      at: 0.22, // lado cercano del bucle
      grab: 0.6,
      path: [{ t: 1.6, p: [-0.01, 0.03, 0.06] }, { t: 2.2, p: [-0.01, R, 0.06] }, { t: 3.4 }],
    },
    {
      at: 0.272, // derecha del bucle, donde la punta pasa por debajo: se levanta para la subida y para la bajada
      grab: 0.8,
      path: [
        { t: 1.8, p: [0.05, 0.03, 0] },
        { t: 2.4, p: [0.05, R, 0] },
        { t: 7.2 },
        { t: 7.6, p: [0.05, LIFT, 0] },
        { t: 8.5 }, // la punta está debajo y adentro del agujero
        { t: 8.9, p: [0.05, R, 0] },
        { t: 13.2 },
        { t: 13.6, p: [0.05, LIFT, 0] },
        { t: 14.1 },
        { t: 14.4, p: [0.05, R, 0] },
        { t: 14.9 },
      ],
    },
    {
      at: 0.324, // lado lejano del bucle
      grab: 1.0,
      path: [{ t: 2.0, p: [0, 0.03, -0.06] }, { t: 2.6, p: [-0.012, R, -0.06] }, { t: 3.4 }],
    },
    {
      at: 0.379, // la mano: apoya el lado de la gaza sobre la parte fija
      grab: 1.2,
      path: [
        { t: 2.0, p: [0.05, 0.05, -0.1] },
        { t: 2.6, p: [-0.07, 0.06, -0.03] },
        { t: 3.0, p: [-0.082, 3 * R, 0] },
        { t: 14.9 },
      ],
    },
    {
      at: 0.446, // inicio de la gaza, al lado del lado cercano del bucle
      grab: 1.4,
      path: [{ t: 2.4, p: [0.1, 0.03, 0.13] }, { t: 3.1, p: [-0.036, R, 0.095] }, { t: 6.6 }],
    },

    // La gaza: la punta gira por el lado lejano y su pliegue se tiende hacia la derecha.
    {
      at: 0.732,
      grab: 4.0,
      path: [{ t: 5.4, p: [0.45, R, 0.02] }, { t: 6.6 }],
    },
    {
      at: 1,
      grab: 3.4,
      force: 35, // levanta la punta y la soga que se arrastra por la mesa; más liviana, se atrasa y después latiguea
      path: [
        { t: 4.2, p: [0.8, 0.05, -0.1] },
        { t: 5.0, p: [0.5, 0.05, -0.17] },
        { t: 5.8, p: [0.2, 0.04, -0.11] },
        { t: 6.4, p: [0.09, R, -0.04] },

        // Hacia arriba por el bucle: entra por debajo de su lado derecho levantado, por la mesa,
        // hasta el medio del agujero (centro del bucle cerca de (-0.02, 0)), sale hacia arriba y
        // después pasa por encima de su lado lejano, junto al cruce.
        { t: 7.7, p: [0.1, R, -0.01] },
        { t: 8.1, p: [0.05, R, -0.01] },
        { t: 8.5, p: [-0.015, R, 0] },
        { t: 8.9, p: [-0.03, 0.05, -0.02] },
        { t: 9.2, p: [-0.07, 0.045, -0.045] },
        { t: 9.6, p: [-0.22, R, -0.13] }, // pasar bastante cola, si no vuelve a salirse

        // Por detrás de la parte fija, del lado lejano al lado cercano.
        { t: 10.1, p: [-0.16, R, -0.05] },
        { t: 10.5, p: [-0.15, R, 0] },
        { t: 10.9, p: [-0.16, R, 0.06] },
        { t: 11.3, p: [-0.21, R, 0.17] },
        { t: 11.9, p: [-0.27, R, 0.32] }, // cola suficiente pasada la parte fija para volver a pasar

        // Hacia abajo por el bucle: por encima de los tramos del cruce, derecho hacia abajo al
        // agujero al lado del tramo que subió (con carga, el bucle se achica a más o menos (-0.01,
        // -0.01), radio 0.045, así que hay que apuntar al medio, no al borde), y después por debajo
        // del lado derecho levantado.
        { t: 12.5, p: [-0.17, 0.045, 0.15] },
        { t: 12.9, p: [-0.1, 0.05, 0.06] },
        { t: 13.3, p: [-0.03, 0.065, 0] },
        { t: 13.6, p: [0.01, 0.035, -0.005] },
        { t: 13.9, p: [0.02, R, -0.005] },
        { t: 14.2, p: [0.08, R, 0] },
        { t: 14.5, p: [0.27, R, 0.0] }, // bien adentro de la gaza, así queda una buena cola
        { t: 14.8 }, // sostener hasta que el tirón agarra la punta
      ],
    },
    {
      at: 0.135, // la parte fija se levanta para que la punta pase por debajo
      grab: 9.6,
      path: [{ t: 10.0, p: [-0.15, LIFT, 0] }, { t: 11.8 }, { t: 12.1, p: [-0.15, R, 0] }],
    },

    // Tirar de la parte fija contra la gaza y la cola. Los dos lados de la gaza se sostienen
    // separados sobre la mesa, así el nudo no puede volcarse de costado; un solo tirón en la punta
    // lejana de la gaza lo retorcía.
    // Después cada mano vuelve suave a donde está su soga antes de soltar: si se suelta en pleno
    // tirón, la soga rígida abre el nudo de un latigazo.
    {
      at: 0,
      grab: 14.5,
      compliance: 0.001,
      force: 150,
      path: [{ t: 15.9, p: [-0.8, R, 0] }, { t: 16.3 }, { t: 16.8, p: [-0.48, R, 0] }, { t: 17.2 }],
    },
    {
      at: 0.54, // lado cercano de la gaza
      grab: 14.5,
      compliance: 0.001,
      force: 55,
      path: [
        { t: 15.9, p: [0.45, R, 0.06] },
        { t: 16.3 },
        { t: 16.8, p: [0.27, R, 0.05] },
        { t: 17.2 },
      ],
    },
    {
      at: 0.656, // lado lejano de la gaza
      grab: 14.5,
      compliance: 0.001,
      force: 55,
      path: [
        { t: 15.9, p: [0.45, R, -0.06] },
        { t: 16.3 },
        { t: 16.8, p: [0.25, R, -0.05] },
        { t: 17.2 },
      ],
    },
    {
      at: 1,
      grab: 14.5,
      compliance: 0.001,
      force: 40,
      path: [{ t: 15.9, p: [0.41, R, 0] }, { t: 16.3 }, { t: 16.8, p: [0.2, R, 0] }, { t: 17.2 }],
    },
  ],
};
