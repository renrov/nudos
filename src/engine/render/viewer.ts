import * as THREE from "three";
import { partsOf } from "../knots/parts";
import type { RopePart } from "../knots/types";
import type { KnotSession } from "../session";
import { createRopeMaterial } from "./ropeMaterial";
import { RopeMesh } from "./ropeMesh";
import { createPropMesh, createStage, type Stage } from "./stage";

export const NATURAL_ROPE = "#c39f6a";
/** px entre el punto de una parte y su nombre; el mismo que el palito de las etiquetas en el CSS. */
const LABEL_GAP = 22;

/**
 * Dibuja una sesión de nudo en un canvas: es dueño del stage de three.js y del loop de render,
 * avanza el player de la sesión y solo vuelve a dibujar cuando cambió la soga o la vista. Mostrá
 * otra sesión para cambiar de nudo.
 */
export class KnotViewer {
  private readonly stage: Stage;
  private readonly materials = new Map<string, THREE.Material>();
  private readonly clock = new THREE.Timer();
  private session: KnotSession | null = null;
  private ropes: RopeMesh[] = [];
  private props: THREE.Mesh[] = [];
  private firstDraw: (() => void) | null = null;
  /** Tiempo del cuadro que muestran las sogas; NaN hasta que se arma el primer cuadro de la sesión. */
  private shownTime = NaN;
  /** Las posiciones del cuadro que se muestra, para ubicar las etiquetas de las partes. */
  private positions: Float32Array | null = null;
  /** Si se marcan las partes de la soga (`partsOf` del nudo); se vuelven a armar para cada sesión. */
  private partsOn = false;
  private readonly partsListeners = new Set<() => void>();
  private parts: { def: RopePart; index: number; el: HTMLElement }[] = [];
  private partsMoved = false;
  private readonly point = new THREE.Vector3();

  /** `partsLayer` es una capa sobre el canvas, del mismo tamaño, para las etiquetas de las partes. */
  constructor(
    canvas: HTMLCanvasElement,
    private readonly partsLayer: HTMLElement | null = null,
  ) {
    this.stage = createStage(canvas);
    this.stage.renderer.setAnimationLoop((now) => this.frame(now));
  }

  /** Reemplaza lo que se muestra; la sesión anterior la sigue liberando quien llama. */
  show(session: KnotSession, onFirstDraw?: () => void) {
    this.clear();
    this.session = session;
    this.firstDraw = onFirstDraw ?? null;
    const { knot, timeline } = session;
    const anisotropy = this.stage.renderer.capabilities.getMaxAnisotropy();
    this.ropes = knot.ropes.map((def, k) => {
      const color = def.color ?? NATURAL_ROPE;
      if (!this.materials.has(color))
        this.materials.set(color, createRopeMaterial(color, anisotropy));
      const mesh = new RopeMesh(timeline.counts[k], def, this.materials.get(color)!);
      this.stage.scene.add(mesh);
      return mesh;
    });
    this.props = (knot.props ?? []).map(createPropMesh);
    for (const prop of this.props) this.stage.scene.add(prop);
    this.buildParts();
  }

  /**
   * Marca las partes de la soga del nudo con etiquetas que la siguen cuadro a cuadro, cada una solo
   * mientras existe esa parte.
   */
  setPartsShown(on: boolean) {
    if (on === this.partsOn) return;
    this.partsOn = on;
    this.buildParts();
    this.partsListeners.forEach((l) => l());
  }

  partsShown = () => this.partsOn;

  /** Llama a `listener` cuando se prenden o apagan las partes; devuelve cómo desuscribirse. */
  onPartsChange = (listener: () => void) => {
    this.partsListeners.add(listener);
    return () => this.partsListeners.delete(listener);
  };

  resetView() {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.stage.resetView(performance.now(), reduce);
  }

  isDefaultView = () => this.stage.isDefaultView();

  onViewChange = (listener: () => void) => this.stage.onViewChange(listener);

  dispose() {
    this.stage.renderer.setAnimationLoop(null);
    this.partsOn = false;
    this.clear();
    for (const material of this.materials.values()) material.dispose();
    this.stage.dispose();
  }

  private frame(now: number) {
    this.clock.update(now);
    const session = this.session;
    let changed = false;
    if (session) {
      session.player.tick(this.clock.getDelta());
      const { timeline } = session;
      // Limitado igual que lo limita sample(): mientras la reproducción espera en el borde del bakeo,
      // el cuadro dibujado sigue moviéndose con el borde. Los cuadros bakeados nunca cambian, así que
      // el mismo tiempo es la misma soga.
      const time = Math.min(Math.max(session.player.getSnapshot().time, 0), timeline.ready);
      if (time !== this.shownTime) {
        this.shownTime = time;
        changed = true;
        const { positions, normals } = timeline.sample(time);
        this.positions = positions;
        let o = 0;
        this.ropes.forEach((rope, k) => {
          const end = o + timeline.counts[k] * 3;
          rope.update(positions.subarray(o, end), normals.subarray(o, end));
          o = end;
        });
      }
    }
    const drawn = this.stage.render(now, changed);
    if (this.parts.length && (drawn || this.partsMoved)) this.placeParts();
    if (session && drawn && this.firstDraw) {
      this.firstDraw();
      this.firstDraw = null;
    }
  }

  /** Una etiqueta por parte, sobre la partícula de su soga más cercana a `at`. */
  private buildParts() {
    for (const part of this.parts) part.el.remove();
    this.parts = [];
    const session = this.session;
    if (!this.partsOn || !this.partsLayer || !session) return;
    const { counts } = session.timeline;
    const offsets = counts.map((_, k) => counts.slice(0, k).reduce((a, b) => a + b, 0));
    const { ropes } = session.knot;
    for (const def of partsOf(session.knot)) {
      const k = def.rope ?? 0;
      if (k >= counts.length) continue;
      const el = document.createElement("div");
      // Con varias sogas, cada etiqueta va del color de su soga, con letra clara u oscura según cuál
      // se lea mejor; con una sola, el color de etiqueta del sitio (en el CSS).
      if (ropes.length > 1) {
        const color = new THREE.Color(ropes[k].color ?? NATURAL_ROPE);
        const luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
        el.style.setProperty("--part", `#${color.getHexString()}`);
        el.style.setProperty("--part-ink", luminance > 0.18 ? "var(--ink)" : "var(--paper)");
      }
      el.append(Object.assign(document.createElement("span"), { textContent: def.name }));
      el.hidden = true;
      this.partsLayer.append(el);
      this.parts.push({ def, index: offsets[k] + Math.round(def.at * (counts[k] - 1)), el });
    }
    this.partsMoved = true;
  }

  /**
   * Lleva cada etiqueta a donde se ve su partícula y oculta las que no existen en este tiempo. El
   * nombre va arriba del punto; si pisa a una etiqueta ya ubicada, prueba abajo y después un escalón
   * más lejos, en el orden de `parts`.
   */
  private placeParts() {
    const positions = this.positions;
    if (!positions) return;
    this.partsMoved = false;
    const { clientWidth: w, clientHeight: h } = this.stage.renderer.domElement;
    const t = this.shownTime;
    const taken: [number, number, number, number][] = [];
    for (const { def, index, el } of this.parts) {
      const p = this.point
        .set(positions[3 * index], positions[3 * index + 1], positions[3 * index + 2])
        .project(this.stage.camera);
      el.hidden = t < (def.from ?? -Infinity) || t > (def.to ?? Infinity) || p.z > 1;
      if (el.hidden) continue;
      const x = ((p.x + 1) / 2) * w;
      const y = ((1 - p.y) / 2) * h;
      el.style.transform = `translate(${x}px, ${y}px)`;
      const tag = el.firstElementChild as HTMLElement;
      const [tw, th] = [tag.offsetWidth + 10, tag.offsetHeight + 6];
      const box = (down: boolean, lift: number): [number, number, number, number] => {
        const top = down ? y + LABEL_GAP + lift : y - LABEL_GAP - lift - th;
        return [x - tw / 2, top, x + tw / 2, top + th];
      };
      const free = (b: [number, number, number, number]) =>
        !taken.some((o) => o[0] < b[2] && b[0] < o[2] && o[1] < b[3] && b[1] < o[3]);
      // Arriba, abajo, y un escalón más lejos cada vez; si no hay lugar, arriba igual.
      const spots = [0, th, 2 * th].flatMap((lift) =>
        [false, true].map((down) => ({ down, lift })),
      );
      const spot = spots.find(({ down, lift }) => free(box(down, lift))) ?? spots[0];
      taken.push(box(spot.down, spot.lift));
      el.dataset.down = String(spot.down);
      el.style.setProperty("--lift", `${spot.lift}px`);
    }
  }

  /**
   * Saca las sogas y los props que se muestran y libera lo que es de ellos; los materiales de soga
   * se comparten y se conservan.
   */
  private clear() {
    const shared = new Set(this.materials.values());
    for (const object of [...this.ropes, ...this.props]) {
      this.stage.scene.remove(object);
      object.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        o.geometry.dispose();
        for (const m of [o.material].flat()) if (!shared.has(m)) m.dispose();
      });
    }
    for (const part of this.parts) part.el.remove();
    this.parts = [];
    this.ropes = [];
    this.props = [];
    this.session = null;
    this.shownTime = NaN;
    this.positions = null;
  }
}
