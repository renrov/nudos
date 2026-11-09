export type Vec3 = [number, number, number];

/** Un punto por el que pasa una guía. Dejá afuera `p` para quedarse quieta en el punto anterior. */
export interface GuideKey {
  t: number;
  p?: Vec3;
}

/**
 * Un pin invisible que mueve un punto de la soga. La física hace el resto: la soga cuelga, se
 * arrastra por la mesa, choca consigo misma y se ajusta.
 */
export interface Guide {
  /** Índice en `KnotDef.ropes`. Dejalo afuera para la primera soga. */
  rope?: number;
  /** Dónde sobre la soga: 0 es el extremo fijo, 1 es la punta. */
  at: number;
  /** Segundos. La guía agarra la soga donde sea que esté en ese momento. */
  grab: number;
  /** Objetivos después de agarrar, en orden temporal. La guía suelta en la última key. */
  path: GuideKey[];
  /**
   * Suavidad del tirón (compliance de XPBD, m/N). Dejalo afuera para un agarre firme; valores más
   * grandes tiran como un resorte.
   */
  compliance?: number;
  /** Tirón máximo en newtons. Dejalo afuera para una mano liviana; ajustar una soga rígida necesita más. */
  force?: number;
}

export interface RopeDef {
  length: number;
  radius: number;
  /**
   * Dónde arranca la soga, como una polilínea desde su extremo fijo. Tendría que ser tan larga como
   * `length` y apoyar sobre la mesa (y = radius) o colgar en el aire para caer; una línea recta es
   * el inicio habitual.
   */
  start: Vec3[];
  /**
   * Color de la soga, por ejemplo "#2b4a79". Dejalo afuera para el beige natural; dale a cada soga
   * de un empalme su propio color.
   */
  color?: string;
}

/** Un objeto fijo alrededor del cual atar la soga: un poste, un segmento de aro o una barra. Nunca se mueve. */
export interface Prop {
  /** Una cápsula es el eje `a`→`b` barrido por `radius` con extremos redondeados; un cilindro tiene extremos planos. */
  kind: "capsule" | "cylinder";
  a: Vec3;
  b: Vec3;
  radius: number;
}

/** Una parte de la soga con nombre, para marcarla en vivo mientras se aprende el nudo. */
export interface RopePart {
  /**
   * Cómo la llaman los pasos: "punta", "parte fija", "bucle", "seno"… Sin el color de la soga: en un
   * nudo de varias sogas, la etiqueta ya va del color de la suya.
   */
  name: string;
  /** Índice en `KnotDef.ropes`. Dejalo afuera para la primera soga. */
  rope?: number;
  /** Dónde sobre la soga: 0 es el extremo fijo, 1 es la punta. */
  at: number;
  /** Segundos desde los que existe esa parte; afuera, desde el principio. */
  from?: number;
  /** Segundos hasta los que existe; afuera, hasta el final. */
  to?: number;
}

export interface Step {
  t: number;
  title: string;
}

/**
 * Todo lo que forma un nudo. Agregar un nudo es agregar uno de estos; las sogas arrancan a lo largo
 * de sus polilíneas `start` y la mesa está en y = 0.
 */
export interface KnotDef {
  id: string;
  /** La parte de la URL de su página, en castellano: /nudos/<slug>/. El `id` nombra sus archivos. */
  slug: string;
  name: string;
  summary: string;
  ropes: RopeDef[];
  props?: Prop[];
  duration: number;
  steps: Step[];
  guides: Guide[];
  /** Lo que marca el botón de partes; sin esto, la punta y la parte fija (ver `partsOf`). */
  parts?: RopePart[];
}
