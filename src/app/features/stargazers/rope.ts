import { KNOT_KINDS, type KnotKind, LEAD, jitter, knotFor, ropeLayout } from "./layout";

/** Una entrada de la API de stargazers de GitHub (`Accept: application/vnd.github.star+json`). */
export type Star = {
  starred_at: string;
  user: { login: string; id: number; avatar_url: string; html_url: string };
};

/** Cuántas estrellas se dieron hasta `time` (estrellas ordenadas por fecha). */
export const countAt = (stars: readonly Star[], time: number) => {
  let n = 0;
  while (n < stars.length && Date.parse(stars[n].starred_at) <= time) n++;
  return n;
};

/**
 * La franja que puede usar la soga, en px del canvas (debajo del panel de intro, arriba de la barra
 * de la línea de tiempo).
 */
export type Band = { top: number; bottom: number };

// Imágenes de la soga real, de cada nudo terminado y de la punta de la soga, hechas por
// tools/stargazer-sprites.mjs a PX píxeles por diámetro de soga; la punta queda TIP diámetros
// adentro de su imagen. Dibujarlas es muchísimo más barato que armar la soga en 3D.
const PX = 32;
const TIP = 5;
const image = (src: string) => Object.assign(new Image(), { src });
const picture = (name: string) => `/stargazers/${name}.png`;
/** Todas las imágenes que dibuja la soga, así la página puede empezar a cargarlas antes de que arranque la soga. */
export const PICTURES = ["rope", "tip", ...KNOT_KINDS.map((k) => k.id)].map(picture);
const AVATAR = 2.4; // radio del avatar, en diámetros de soga: más grande que un nudo, así la gente va primero
const SPARE = 7; // tamaño de las vueltas en la pila suelta de soga que queda para las estrellas nuevas, en diámetros de soga
const ACCENT = "#b9522c";
/** La fuente de la página (ver global.css), para los textos que se dibujan en el canvas. */
const FONT = '"Archivo", ui-sans-serif, system-ui, sans-serif';
const POP = 420; // ms para que un nudo nuevo se ajuste y su avatar aparezca
const LAYING = 24; // soga que todavía se está acomodando detrás de la punta que se va soltando, en diámetros de soga
const REVEAL = 100; // soga que falta soltar (el final lento de una repetición) cuando la pila empieza a entrar en cuadro, en diámetros de soga
const MORE = 90; // lo máximo de soga extra que muestra la pila mientras faltan estrellas, en diámetros de soga
const PAY = 0.012; // por ms: qué tan rápido se suelta la punta de la soga hasta donde la necesitan los nudos
const CALM =
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const PULSE = 1800; // ms de anillos alrededor de un nudo encontrado
/** Easing independiente del frame rate: la proporción del camino a cerrar en `dt` ms, `rate` por cuadro de 60 Hz. */
const ease = (rate: number, dt: number) => 1 - (1 - rate) ** (dt / (1000 / 60));
/** Se pasa un poco y se acomoda, como un nudo que se cierra de golpe. */
const popOut = (u: number) => 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2;

/**
 * Las estrellas como una sola soga larga que serpentea por la página, de la más vieja a la más
 * nueva: cada estrella es un pequeño nudo simple con el avatar del stargazer atado al lado. Los
 * nudos se amontonan en una ráfaga de estrellas y se separan en una pausa (`gapFor`); pasando la
 * estrella más nueva, una pila suelta de soga de reserva espera a las próximas. Abre en las
 * estrellas más nuevas y se desliza (o se scrollea con la rueda) hacia atrás por las más viejas.
 *
 * Solo vuelve a dibujar cuando algo se movió o cambió, así una página quieta no cuesta nada. Corre
 * su propio loop hasta `dispose`.
 */
export class StarRope {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private t = 7; // diámetro de la soga en pantalla, px
  private y0 = 0; // el centro del serpenteo de la soga
  private sway = 0; // cuánto sube y baja al serpentear
  private stars: Star[] = [];
  private loaded = false; // no hay soga hasta que llega el feed; después, por lo menos la soga pelada y la de reserva
  private times: number[] = [];
  private shown = 0; // estrellas atadas hasta ahora
  private reach = 0; // dónde termina la soga dibujada, en diámetros: se va soltando después del final del layout
  private reachV = 0; // diámetros por ms
  private payTo: number | null = null; // la punta propia de la soga durante una repetición, en diámetros, para que se suelte de forma pareja
  private laid = false; // si ya se pusieron las primeras estrellas
  private fullEnd = 0; // dónde termina la soga una vez atadas todas las estrellas, en diámetros
  private tied = 0; // nudos a los que ya llegó la soga soltada, o sea, dibujados
  private layoutCache: ReturnType<typeof ropeLayout> = { knots: [], end: 0 };
  private born = new Map<number, number>(); // cuándo se ató cada nudo, para su aparición
  private faces = new Map<number, { img: HTMLImageElement; cut: HTMLCanvasElement | null }>();
  private spots: { i: number; x: number; y: number }[] = []; // avatares dibujados en el último cuadro, para el hover
  private hovered = -1;
  private slot: { x: number; y: number } | null = null; // el lugar vacío para el avatar de la próxima estrella
  private hoverGrow = 0; // 0 → 1 a medida que crece el avatar bajo el puntero
  private found = -1; // la estrella que alguien buscó: centrada y marcada con su número
  private foundAt = 0;
  private target: number | null = null; // posición de scroll hacia la que deslizarse
  private scroll = 0; // posición sobre la soga (px a lo largo de ella) en el borde izquierdo de la pantalla
  private velocity = 0; // px por ms, después de un deslizamiento
  private lastLead = Number.NaN; // el objetivo a seguir en el último cuadro, así la cámara se mueve con él en lugar de quedar atrás
  private follow = true; // mantener a la vista las estrellas más nuevas y la soga de reserva a medida que llegan estrellas
  private drag: { x: number; scroll: number; moved: number; last: number; at: number } | null =
    null;
  private strip: HTMLCanvasElement | null = null; // la imagen de la soga dos veces seguidas, así los cortes nunca dan la vuelta
  private knots = Object.fromEntries(KNOT_KINDS.map((k) => [k.id, image(picture(k.id))])) as Record<
    KnotKind["id"],
    HTMLImageElement
  >;
  private kinds: KnotKind[] = [];
  private tip = image(picture("tip"));
  private dirty = true; // algo cambió: dibujar el próximo cuadro
  private last = 0;
  private frame = 0;
  private resize = new ResizeObserver(() => this.layout());
  private listeners: [string, EventListener][] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private band: () => Band,
  ) {
    this.ctx = canvas.getContext("2d")!;
    const rope = image(picture("rope"));
    rope.onload = () => {
      this.strip = document.createElement("canvas");
      this.strip.width = rope.width * 2;
      this.strip.height = rope.height;
      const c = this.strip.getContext("2d")!;
      c.drawImage(rope, 0, 0);
      c.drawImage(rope, rope.width, 0);
      this.dirty = true;
    };
    for (const img of [...Object.values(this.knots), this.tip])
      img.onload = () => (this.dirty = true);
    // Si la fuente llega después del primer cuadro, volver a dibujar las etiquetas con ella.
    void document.fonts?.ready.then(() => (this.dirty = true));

    this.on("pointerdown", (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      this.drag = { x: e.clientX, scroll: this.scroll, moved: 0, last: e.clientX, at: e.timeStamp };
      this.velocity = 0;
    });
    this.on("pointermove", (e: PointerEvent) => {
      const d = this.drag;
      if (!d) return;
      d.moved = Math.max(d.moved, Math.abs(e.clientX - d.x));
      // Una velocidad de soltado suavizada, así un deslizamiento rápido sigue a la velocidad que traía.
      const v = (d.last - e.clientX) / Math.max(e.timeStamp - d.at, 1);
      this.velocity = this.velocity * 0.6 + v * 0.4;
      [d.last, d.at] = [e.clientX, e.timeStamp];
      this.scroll = d.scroll - (e.clientX - d.x);
      if (d.moved > 4) [this.follow, this.target] = [false, null];
      this.dirty = true;
    });
    this.on("pointerup", (e: PointerEvent) => {
      if (this.drag && (this.drag.moved < 5 || e.timeStamp - this.drag.at > 80)) this.velocity = 0;
      // Se limpia después del clic que sigue, así el clic puede distinguir un deslizamiento de un toque.
      setTimeout(() => (this.drag = null));
    });
    this.on("wheel", (e: WheelEvent) => {
      e.preventDefault();
      this.scroll += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      this.velocity = 0;
      [this.follow, this.target] = [false, null];
      this.dirty = true;
    });
    this.resize.observe(canvas);
    const loop = (now: number) => {
      const dt = Math.min(now - (this.last || now), 64);
      this.last = now;
      if (this.step(now, dt) || this.dirty) {
        this.dirty = false;
        this.draw(now);
      }
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  private on<E extends Event>(type: string, fn: (e: E) => void) {
    this.canvas.addEventListener(type, fn as EventListener, { passive: false });
    this.listeners.push([type, fn as EventListener]);
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.resize.disconnect();
    for (const [type, fn] of this.listeners) this.canvas.removeEventListener(type, fn);
  }

  /** Si el toque que acaba de terminar fue un deslizamiento y no un toque simple. */
  get swiped() {
    return (this.drag?.moved ?? 0) >= 5;
  }

  setStars(stars: Star[]) {
    this.stars = stars;
    this.kinds = stars.map((s) => knotFor(s.user.id));
    this.loaded = true;
    this.times = stars.map((s) => Date.parse(s.starred_at));
    this.fullEnd = ropeLayout(this.times, stars.length).end;
    this.relayout();
  }

  /**
   * Mostrar las primeras `n` estrellas: la soga crece nudo por nudo, cada uno ajustándose, y la
   * vista la sigue. Una repetición también pasa cuánto avanzó sobre la soga (en diámetros), así la
   * soga se suelta suave entre nudos en lugar de saltar de a un hueco de nudo.
   */
  setCount(n: number, along?: number) {
    this.payTo = along === undefined ? null : along + LEAD;
    this.dirty = true;
    if (n === this.shown) return;
    this.tied = Math.min(this.tied, n); // para atrás: esos nudos se desatan; los nuevos se atan cuando la soga llega a ellos
    this.follow = true;
    this.shown = n;
    this.relayout();
    if (!this.laid) {
      // Las primeras estrellas que se muestran ya están en la soga cuando abre la página: no hay
      // que ir soltando soga hasta ellas.
      [this.laid, this.reach, this.reachV, this.tied] = [
        true,
        this.payTo ?? this.layoutCache.end,
        0,
        n,
      ];
    }
  }

  /** Deslizarse hasta la estrella `i` (tiene que estar mostrada), centrarla y marcarla con su número de nudo. */
  find(i: number) {
    const { knots } = this.layoutCache;
    if (i < 0 || i >= knots.length) return;
    this.found = i;
    this.foundAt = performance.now();
    this.follow = false;
    this.velocity = 0;
    this.target = knots[i] * this.t - this.w / 2;
  }

  /** La estrella cuyo avatar está bajo un punto (px del canvas), o null. */
  pick(mx: number, my: number) {
    let best = (this.t * AVATAR + 3) ** 2;
    let hit = -1;
    for (const s of this.spots) {
      const d = (s.x - mx) ** 2 + (s.y - my) ** 2;
      if (d < best) [best, hit] = [d, s.i];
    }
    if (hit !== this.hovered) [this.hovered, this.hoverGrow, this.dirty] = [hit, 0, true];
    return hit === -1 ? null : this.stars[hit];
  }

  /** Si un punto (px del canvas) está sobre el lugar vacío que espera a la próxima estrella. */
  overSlot(mx: number, my: number) {
    const s = this.slot;
    return !!s && (s.x - mx) ** 2 + (s.y - my) ** 2 < (this.t * AVATAR + 3) ** 2;
  }

  private relayout() {
    this.layoutCache = ropeLayout(this.times, this.shown);
    this.dirty = true;
  }

  private layout() {
    this.dpr = devicePixelRatio || 1;
    if (!this.w) this.scroll = -this.canvas.clientWidth / 2; // primer tamaño: la soga arranca a mitad de pantalla
    this.w = this.canvas.clientWidth;
    this.h = this.canvas.clientHeight;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.t = this.w < 600 ? 6 : 7;
    this.faces.forEach((f) => (f.cut = null)); // volver a cortar al tamaño nuevo
    this.fit();
    this.dirty = true;
  }

  /** Ajusta el serpenteo de la soga a la franja, que cambia cuando crece el panel de intro. */
  private fit() {
    const { top, bottom } = this.band();
    const y0 = (top + bottom) / 2;
    // Lugar arriba y abajo para un nudo, su atadura y su avatar.
    const sway = Math.max(0, (bottom - top) / 2 - this.t * (AVATAR * 2 + 2.5));
    if (y0 !== this.y0 || sway !== this.sway) [this.y0, this.sway, this.dirty] = [y0, sway, true];
  }

  /** Avanza la vista `dt` ms; devuelve si algo se sigue moviendo. */
  private step(now: number, dt: number) {
    this.fit();
    const before = this.scroll;
    // La punta de la soga sigue al layout con un resorte con amortiguamiento crítico, así se suelta
    // y se recoge suave aunque el layout salte; los nudos se atan cuando llega a ellos.
    const { knots } = this.layoutCache;
    const goal = this.payTo ?? this.layoutCache.end;
    if (CALM) [this.reach, this.reachV] = [goal, 0];
    for (let left = dt; left > 0; left -= 16) {
      const h = Math.min(left, 16);
      this.reachV += (PAY * PAY * (goal - this.reach) - 2 * PAY * this.reachV) * h;
      this.reach += this.reachV * h;
    }
    const paying = Math.abs(goal - this.reach) > 0.01 || Math.abs(this.reachV) > 1e-4;
    if (!paying) [this.reach, this.reachV] = [goal, 0];
    while (this.tied < Math.min(this.shown, knots.length) && knots[this.tied] <= this.reach - 2)
      this.born.set(this.tied++, now);
    const end = this.reach * this.t;
    // Una soga más corta que la pantalla queda centrada; una más larga puede deslizar su inicio
    // hasta la mitad de la pantalla.
    const min = -this.w / 2;
    const over = end + SPARE * 4.4 * this.t - this.w;
    const max = over > 0 ? over : over / 2;
    // Durante una repetición, la pila espera justo afuera del borde derecho y entra en cuadro a lo
    // largo de los últimos nudos, mientras se acaba la soga que falta.
    const u = Math.min(Math.max(this.fullEnd - this.reach, 0) / REVEAL, 1);
    const lead = Math.max(max - u * u * (3 - 2 * u) * SPARE * 6.4 * this.t, min);
    if (this.target !== null) {
      const goal = Math.min(Math.max(this.target, min), max);
      this.scroll += (goal - this.scroll) * ease(0.1, dt);
    } else if (this.follow) {
      // Llevar la vista junto con la soga que se va soltando y después cerrar lo que queda, así no queda atrás.
      this.scroll += lead - this.lastLead || 0;
      this.scroll += (lead - this.scroll) * ease(0.12, dt);
    } else if (!this.drag) {
      this.scroll += this.velocity * dt;
      this.velocity *= Math.exp(-dt / 325); // un deslizamiento rápido se frena a lo largo de más o menos un segundo
      if (Math.abs(this.velocity) < 0.01) this.velocity = 0;
      if (this.scroll < min) this.scroll += (min - this.scroll) * ease(0.2, dt);
      if (this.scroll > max) this.scroll += (max - this.scroll) * ease(0.2, dt);
    }
    this.lastLead = lead;
    if (Math.abs(this.scroll - before) < 0.05) this.scroll = before;
    let moving = this.scroll !== before || paying;
    if (this.hovered !== -1 && this.hoverGrow < 1) {
      this.hoverGrow = Math.min(1, this.hoverGrow + dt / 160);
      moving = true;
    }
    for (const [i, at] of this.born) {
      if (now - at < POP) moving = true;
      else this.born.delete(i);
    }
    return moving || (this.found !== -1 && now - this.foundAt < PULSE);
  }

  /**
   * El serpenteo de la soga: unas pocas ondas lentas de distintos largos, así nunca se repite ni se
   * lee como un patrón. Queda quieta.
   */
  private wander(s: number) {
    const t = this.t;
    // El último tramo antes de la punta todavía se está tendiendo: entra derecho a la pila y se
    // acomoda en sus ondas a medida que se suelta más soga, en lugar de que la punta latiguee
    // subiendo y bajando por ellas.
    const u = Math.min(Math.max((this.reach * t - s) / (LAYING * t), 0), 1);
    return (
      this.y0 +
      this.sway *
        u *
        u *
        (3 - 2 * u) *
        (0.5 * Math.sin(s / (47 * t) + 1.3) +
          0.32 * Math.sin(s / (19 * t) + 4.1) +
          0.18 * Math.sin(s / (8.3 * t) + 2.2))
    );
  }

  /** Punto en pantalla y ángulo de la soga a `s` px a lo largo de ella. */
  private point(s: number): [number, number, number] {
    const y = this.wander(s);
    return [s - this.scroll, y, Math.atan(this.wander(s + 1) - y)];
  }

  /** El avatar de la estrella `i` recortado en un círculo una sola vez, a `r` px, así dibujarlo es una copia simple. */
  private face(i: number, r: number) {
    let f = this.faces.get(i);
    if (!f) {
      const img = image(`${this.stars[i].user.avatar_url}&s=96`);
      f = { img, cut: null };
      img.onload = () => (this.dirty = true);
      this.faces.set(i, f);
    }
    if (!f.cut && f.img.complete && f.img.naturalWidth) {
      const size = Math.ceil(r * 2 * this.dpr * 1.6); // lugar para los tamaños de hover y de encontrado
      const cut = document.createElement("canvas");
      cut.width = cut.height = size;
      const c = cut.getContext("2d")!;
      c.beginPath();
      c.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      c.clip();
      c.drawImage(f.img, 0, 0, size, size);
      f.cut = cut;
    }
    return f.cut;
  }

  private draw(now: number) {
    const { ctx, t } = this;
    ctx.clearRect(0, 0, this.w, this.h);
    if (!this.loaded) return;
    const { knots } = this.layoutCache;
    const end = this.reach * t;
    const strip = this.strip;
    const from = Math.max(this.scroll - t * 6, 0);
    const to = Math.min(this.scroll + this.w + t * 6, end);

    /** Una tajada de la imagen de la soga de (x0, y0) a (x1, y1), `s` px adentro de su patrón. */
    const lay = (x0: number, y0: number, x1: number, y1: number, s: number) => {
      if (!strip) return;
      if (Math.max(x0, x1) < -t * 2 || Math.min(x0, x1) > this.w + t * 2) return;
      const l = Math.hypot(x1 - x0, y1 - y0);
      const scale = PX / t;
      const a = Math.atan2(y1 - y0, x1 - x0);
      const [c, sn] = [Math.cos(a), Math.sin(a)];
      ctx.setTransform(
        c * this.dpr,
        sn * this.dpr,
        -sn * this.dpr,
        c * this.dpr,
        x0 * this.dpr,
        y0 * this.dpr,
      );
      ctx.drawImage(
        strip,
        (s * scale) % (strip.width / 2),
        0,
        l * scale,
        strip.height,
        0,
        -t,
        l + 0.8,
        2 * t,
      );
    };
    const reset = () => ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // La soga.
    for (let s = from; s < to; s += t * 2) {
      const [x0, y0] = this.point(s);
      const [x1, y1] = this.point(Math.min(s + t * 2, to));
      lay(x0, y0, x1, y1, s);
    }
    // Soga de reserva tirada en una pila suelta pasando el nudo más nuevo: vueltas desparejas que
    // serpentean y se cruzan, como cae la soga cuando la soltás. Mientras faltan estrellas guarda
    // más soga, y se desenrolla vuelta por vuelta a medida que se suelta: el punto por donde sale
    // la soga recorre las vueltas, que si no quedan quietas, y al tirar se arrastran las vueltas
    // más cercanas a ese punto.
    const [ex, ey, ea] = this.point(end);
    const R = SPARE * t;
    // La parte de arriba de la pila coincide con la altura de la soga, así la soga entra derecho.
    const [px, py] = [ex + R * 0.9, ey + R * 0.8];
    const loop = (a: number): [number, number] => {
      const r = R * (1 + 0.22 * Math.sin(1.3 * a + 0.7) + 0.12 * Math.sin(2.9 * a + 2.1));
      const cx = px + t * 2.2 * Math.sin(0.45 * a + 1.1);
      const cy = py + t * 1.6 * Math.cos(0.6 * a + 0.4);
      return [cx - r * Math.cos(a), cy - r * 0.8 * Math.sin(a)];
    };
    const START = Math.PI / 2; // la parte de arriba de la primera vuelta, yendo hacia la derecha como la soga que entra
    const STEP = 0.1;
    const toCome = Math.max(this.fullEnd - this.reach, 0); // diámetros que faltan soltar
    const a0 = START - Math.min(toCome, MORE) / SPARE; // por dónde sale la soga de la pila
    const a1 = START + Math.PI * 2 * 4.6;
    const [ox, oy] = loop(a0);
    const pull = Math.hypot(ex - ox, ey - oy) || 1;
    const tug = Math.min(Math.abs(this.reachV) / 0.3, 1) * t * 1.8;
    // Ángulos sobre una grilla fija (más la salida misma), así el contorno de las vueltas no titila.
    const angles = [a0];
    for (let k = Math.floor((a0 - START) / STEP) + 1; START + k * STEP <= a1; k++)
      angles.push(START + k * STEP);
    const loops = angles.map((a): [number, number] => {
      const [x, y] = loop(a);
      const w = tug * Math.exp(-((a - a0) * R) / (6 * t));
      return [x + ((ex - ox) / pull) * w, y + ((ey - oy) / pull) * w];
    });
    // Cada vuelta mantiene sus hebras en su lugar: el patrón está fijado al ángulo, no a lo que se soltó.
    const alongAt = (a: number) => (a - START) * R + 1e5;
    for (let k = 1; k < loops.length; k++)
      lay(loops[k - 1][0], loops[k - 1][1], loops[k][0], loops[k][1], alongAt(angles[k - 1]));
    // La punta cae afuera de la pila: se va alejando de a poco del centro y sale pasando las
    // vueltas, así su corte queda a la vista.
    let [lx, ly] = loops[loops.length - 1];
    const [qx, qy] = loops[loops.length - 2];
    let dir = Math.atan2(ly - qy, lx - qx);
    let along = alongAt(a1);
    const tail: [number, number][] = [];
    for (let k = 0; k < 16; k++) {
      const out = Math.atan2(ly - py, lx - px);
      const turn = Math.atan2(Math.sin(out - dir), Math.cos(out - dir));
      dir += turn * 0.18;
      const [nx, ny] = [lx + Math.cos(dir) * t, ly + Math.sin(dir) * t];
      lay(lx, ly, nx, ny, along);
      along += t;
      [lx, ly] = [nx, ny];
      tail.push([lx, ly]);
    }
    // La curva que va de la soga tendida a donde sale de la pila, por encima de las vueltas sobre
    // las que se arrastra; sus hebras se deslizan hacia la soga tendida a medida que se suelta.
    const [sx0, sy0] = loops[0];
    const [dx, dy] = [loops[1][0] - sx0, loops[1][1] - sy0];
    const dl = Math.hypot(dx, dy) || 1;
    const c1 = [ex + Math.cos(ea) * t * 4, ey + Math.sin(ea) * t * 4];
    const c2 = [sx0 - (dx / dl) * t * 4, sy0 - (dy / dl) * t * 4];
    const bridge: [number, number][] = [[ex, ey]];
    let bridgeLength = 0;
    for (let k = 1; k <= 10; k++) {
      const u = k / 10;
      const v = 1 - u;
      bridge.push([
        ex * v ** 3 + 3 * c1[0] * v * v * u + 3 * c2[0] * v * u * u + sx0 * u ** 3,
        ey * v ** 3 + 3 * c1[1] * v * v * u + 3 * c2[1] * v * u * u + sy0 * u ** 3,
      ]);
      bridgeLength += Math.hypot(bridge[k][0] - bridge[k - 1][0], bridge[k][1] - bridge[k - 1][1]);
    }
    along = alongAt(a0) - bridgeLength;
    for (let k = 1; k < bridge.length; k++) {
      const [[x0, y0], [x1, y1]] = [bridge[k - 1], bridge[k]];
      lay(x0, y0, x1, y1, along);
      along += Math.hypot(x1 - x0, y1 - y0);
    }
    const pile = [...bridge, ...loops, ...tail];
    reset();

    // Las puntas reales de la soga: su inicio, y su final caído afuera de la pila de reserva.
    if (this.tip.complete && this.tip.naturalWidth) {
      const tw = (this.tip.width / PX) * t;
      const th = (this.tip.height / PX) * t;
      // El inicio apunta hacia atrás siguiendo la pendiente de la soga, así continúa su línea.
      const [sx, sy, sa] = this.point(0);
      for (const [x, y, a] of [
        [sx, sy, sa + Math.PI],
        [lx, ly, dir],
      ]) {
        if (x < -tw || x > this.w + tw) continue;
        ctx.translate(x, y);
        ctx.rotate(a);
        if (Math.cos(a) < 0) ctx.scale(1, -1); // apunta a la izquierda: espejar, así su luz queda arriba
        ctx.drawImage(this.tip, -TIP * t, -th / 2, tw, th);
        reset();
      }
    }

    // Cada estrella: su nudo en la soga, su avatar atado al lado, alternando arriba y abajo.
    // Los nudos nuevos aparecen creciendo desde la nada con un pequeño rebote.
    const r = t * AVATAR;
    const pop = (i: number) => {
      const at = this.born.get(i);
      return at === undefined ? 1 : popOut(Math.min((now - at) / POP, 1));
    };
    this.spots = [];
    ctx.strokeStyle = "rgb(35 32 28 / 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const tied: [number, number, number, number][] = []; // x, y y ángulo del nudo, estrella
    knots.forEach((k, i) => {
      if (i >= this.tied) return; // la soga todavía no se soltó hasta acá
      const s = k * t;
      if (s < this.scroll - r * 3 || s > this.scroll + this.w + r * 3) return;
      // Sobre la cuerda entre los puntos de la soga bajo las dos puntas de su imagen, así las dos
      // puntas quedan sobre la soga aunque se curve.
      const img = this.knots[this.kinds[i].id];
      const half = img.naturalWidth ? (img.width / PX / 2) * t : t * 2.5;
      const [x0, y0] = this.point(s - half);
      const [x1, y1] = this.point(s + half);
      const [x, y] = [(x0 + x1) / 2, (y0 + y1) / 2];
      const a = Math.atan2(y1 - y0, x1 - x0);
      // Lados alternados, cada atadura un poco más larga o más corta y un poco inclinada, como a mano.
      const side = i % 2 ? 1 : -1;
      const off = (t * 1.3 + r + jitter(i, 1) * t * 1.6) * pop(i);
      const lean = a + (jitter(i, 2) - 0.5) * 0.7;
      const ax = x - Math.sin(lean) * off * side;
      const ay = y + Math.cos(lean) * off * side;
      ctx.moveTo(x, y);
      ctx.lineTo(ax, ay);
      tied.push([x, y, a, i]);
      this.spots.push({ i, x: ax, y: ay });
    });
    ctx.stroke();
    for (const [x, y, a, i] of tied) {
      const img = this.knots[this.kinds[i].id];
      if (!img.complete || !img.naturalWidth) continue;
      // Se ajusta: aparece floja y larga a lo largo de la soga, y después se aprieta.
      const at = this.born.get(i);
      const u = at === undefined ? 1 : Math.min((now - at) / POP, 1);
      const loose = (1 - u) ** 3;
      const kw = (img.width / PX) * t * (1 + 0.6 * loose);
      const kh = (img.height / PX) * t * (1 + 0.2 * loose);
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.drawImage(img, -kw / 2, -kh / 2, kw, kh);
      reset();
    }

    // Avatares, la estrella buscada al final para que quede encima de sus vecinas.
    this.spots.sort((a, b) => Number(a.i === this.found) - Number(b.i === this.found));
    const grow = 1 - (1 - this.hoverGrow) ** 3;
    for (const { i, x, y } of this.spots) {
      const found = i === this.found;
      const hover = i === this.hovered;
      const rr = r * pop(i) * (found ? 1.6 : 1 + (hover ? 0.35 * grow : 0));
      if (rr < 0.5) continue;
      const cut = this.face(i, r);
      if (cut) ctx.drawImage(cut, x - rr, y - rr, rr * 2, rr * 2);
      else {
        ctx.fillStyle = "#d8cfc2";
        ctx.beginPath();
        ctx.arc(x, y, rr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.strokeStyle = found || hover || i === this.tied - 1 ? ACCENT : "#fffdf9";
      ctx.lineWidth = found || hover ? 2.5 : 2;
      ctx.stroke();
      if (found) {
        // Por un momento salen anillos del avatar encontrado.
        const age = now - this.foundAt;
        for (let k = 0; k < 3; k++) {
          const u = (age - k * 260) / 900;
          if (u <= 0 || u >= 1) continue;
          ctx.globalAlpha = 1 - u;
          ctx.beginPath();
          ctx.arc(x, y, rr + u * r * 2.2, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // Una etiqueta con el número del nudo arriba del avatar.
        const label = `#${i + 1}`;
        ctx.font = `800 14px ${FONT}`;
        const w = ctx.measureText(label).width + 18;
        const ty = y - rr - 32;
        ctx.fillStyle = ACCENT;
        ctx.beginPath();
        ctx.roundRect(x - w / 2, ty, w, 24, 12);
        ctx.fill();
        ctx.fillStyle = "#fffdf9";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, x, ty + 12);
      }
    }

    // Un lugar vacío y punteado para la próxima estrella, atado donde va a ir su nudo, una vez que
    // se muestran todas las estrellas.
    this.slot = null;
    if (this.tied === this.stars.length) {
      const i = this.shown;
      const [x, y, a] = this.point(end - 4 * t);
      const side = i % 2 ? 1 : -1;
      const off = t * 1.3 + r + jitter(i, 1) * t * 1.6;
      const [sx, sy] = [x - Math.sin(a) * off * side, y + Math.cos(a) * off * side];
      this.slot = { x: sx, y: sy };
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(sx - Math.sin(a) * -r * side, sy + Math.cos(a) * -r * side);
      ctx.stroke();
      ctx.fillStyle = "rgb(255 253 249 / 0.7)";
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ACCENT;
      ctx.font = `700 ${Math.round(r)}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("★", sx, sy + 1);
    }

    // Una nota sobre la soga de reserva, arriba de la pila, de la soga que entra a ella y del lugar vacío.
    const top = Math.min(...pile.map(([, y]) => y), this.slot ? this.slot.y - r : Infinity);
    ctx.fillStyle = ACCENT;
    ctx.font = `700 12px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("tu nudo va acá", px, top - t * 1.5); // se mueve con la pila
  }
}
