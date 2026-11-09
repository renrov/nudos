import * as THREE from "three";
import type { Step, Vec3 } from "../knots/types";
import {
  PRESETS,
  formatKnot,
  knotOf,
  presetOf,
  toGuide,
  type Recording,
  type Track,
} from "../record/recording";
import { MaterialFrames } from "../sim/frames";
import { FPS, RopeSim, type Hand, type SimState } from "../sim/rope";
import { createRopeMaterial } from "./ropeMaterial";
import { RopeMesh } from "./ropeMesh";
import { createPropMesh, createStage } from "./stage";
import { NATURAL_ROPE } from "./viewer";

const STORAGE_KEY = "knot-recorder-v2";
const PICK_PX = 24; // qué tan cerca del puntero tiene que estar un punto de la soga para ponerle una mano
const DOT_PX = 16; // qué tan cerca tiene que estar el punto de una mano para agarrarlo
const RELEASE = 0.3; // segundos que tarda una mano en soltar, como hace una guía en su última key
const HOLD = 0.1; // cada movimiento termina con este momento quieto, así los movimientos se unen sin tirones
const LIFT_STEP = 0.005; // metros por cada W/S o muesca de la rueda
const PICK_UP = 3; // una mano nueva planea levantar su punto esta cantidad de radios, como dedos que lo agarran
const MAX_HEIGHT = 0.2;
const UNDO_DEPTH = 200;
const ACCENT = "#c62f2b";
const STEM = 0.09; // la manija para levantar de la mano elegida queda a esta altura sobre su punto
const HANDLE_PX = 18; // qué tan cerca de la punta de la manija tiene que ser un clic

/** Qué tan fuerte tira una mano: una mano suave (lo predeterminado de una guía), una firme o un tirón que ajusta. */
export const GRIPS = {
  light: {},
  firm: { force: 60 },
  pull: { force: 250, compliance: 0.001 },
} as const;
export type Grip = keyof typeof GRIPS;
export const DURATIONS = [0.5, 1, 2];

/**
 * Una mano sobre la soga: dónde está ahora (`hand.target`), a dónde la lleva el próximo movimiento
 * y sus movimientos hasta ahora.
 */
interface HandState {
  id: number;
  grip: Grip;
  hand: Hand;
  plan: Vec3;
  track: Track;
}

export interface HandView {
  id: number;
  grip: Grip;
  height: number;
  /** Se movió su punto: el próximo movimiento la lleva ahí. */
  planned: boolean;
}

export interface RecorderSnapshot {
  time: number;
  preset: string;
  moves: number;
  steps: Step[];
  hands: HandView[];
  selected: number | null;
  grip: Grip;
  duration: number;
  speed: number;
  /** "move" mientras se reproduce un movimiento, "replay" mientras se reproduce toda la grabación. */
  busy: "move" | "replay" | null;
  canUndo: boolean;
  canRedo: boolean;
  /** A dónde va la mano elegida, en metros. */
  plan: Vec3 | null;
  code: string;
}

/** Las marcas que se dibujan para una mano. */
interface Marks {
  dot: THREE.Mesh;
  ghost: THREE.Mesh;
  arrow: THREE.Mesh;
  drop: THREE.Line; // desde el punto hasta la mesa, para mostrar su altura
  link: THREE.Line; // desde donde está la mano hasta donde va
  stem: THREE.Mesh; // el palito de la manija para levantar
}

/** A qué vuelve deshacer, y qué restaura una recarga. */
interface Saved {
  preset: string;
  sim: SimState;
  hands: HandState[];
  letting: Hand[];
  guides: Recording["guides"];
  steps: Step[];
  nextId: number;
}

/**
 * El taller de nudos. Hacé clic en la soga para ponerle una mano; una mano sostiene su punto hasta
 * que la soltás. Con el tiempo frenado, arrastrá los puntos de las manos a donde tienen que ir (W/S
 * para la altura), todos los que quieras, y después reproducí el movimiento: van todas juntas
 * durante lo que dure el movimiento. Cada mano se graba como una guía, y la grabación se repite tal
 * como la bakea la app.
 */
export class KnotRecorder {
  private readonly stage: ReturnType<typeof createStage>;
  private readonly clock = new THREE.Timer();
  private readonly listeners = new Set<() => void>();
  private readonly materials = new Map<string, THREE.Material>();
  private preset = PRESETS[0].name;
  private guides: Recording["guides"] = [];
  private steps: Step[] = [];
  private sim!: RopeSim;
  private live: RopeSim | null = null; // la simulación editada, guardada aparte mientras se reproduce una repetición
  private hands: HandState[] = [];
  private nextId = 1;
  private selected: number | null = null;
  private undoStack: Saved[] = [];
  private redoStack: Saved[] = [];
  private readonly marks = new Map<number, Marks>();
  private readonly arrowGeometry = new THREE.ConeGeometry(0.013, 0.03, 20);
  private readonly stemGeometry = new THREE.CylinderGeometry(0.003, 0.003, 1, 10);
  private readonly lineMaterial = new THREE.LineBasicMaterial({
    color: ACCENT,
    depthTest: false,
    transparent: true,
    opacity: 0.6,
  });
  private meshes: RopeMesh[] = [];
  private props: THREE.Mesh[] = [];
  private frames: MaterialFrames[] = [];
  private buffers: { positions: Float32Array; normals: Float32Array }[] = [];
  private readonly dots = new THREE.Group();
  private readonly dotGeometry = new THREE.SphereGeometry(1, 16, 12);
  private readonly dotMaterial = new THREE.MeshBasicMaterial({ color: ACCENT, depthTest: false });
  private readonly ghostMaterial = new THREE.MeshBasicMaterial({
    color: ACCENT,
    depthTest: false,
    transparent: true,
    opacity: 0.35,
  });
  private grip: Grip = "light";
  private duration = 1;
  private speed = 1;
  private busy: RecorderSnapshot["busy"] = null;
  private move: { start: number; end: number; from: Map<HandState, Vec3> } | null = null;
  private replayEnd = 0;
  private carry = 0;
  /** Un punto arrastrado por la mesa a `height`, o la manija para levantar arrastrada hacia arriba y hacia abajo. */
  private dragging:
    | { state: HandState; height: number; lift?: undefined }
    | { state: HandState; height: number; lift: { grabY: number; startY: number } }
    | null = null;
  private snapshot!: RecorderSnapshot;
  private shownTime = -1;
  private version = 0;
  private code = { version: -1, text: "" };

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.stage = createStage(canvas);
    this.stage.scene.add(this.dots);
    const saved = load();
    this.reset(saved?.preset ?? PRESETS[0].name);
    if (saved && saved.sim.x.length === this.sim.n * 3) this.apply(saved);
    this.publish();
    // Antes de los controles de órbita, así un clic sobre la soga o un punto es nuestro y no un
    // giro de la vista.
    canvas.addEventListener("pointerdown", this.onDown, { capture: true });
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointercancel", this.onUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false, capture: true });
    window.addEventListener("keydown", this.onKey);
    this.stage.renderer.setAnimationLoop((now) => this.frame(now));
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  /** Vuelve a empezar desde otro layout. */
  setPreset(name: string) {
    if (this.busy) return;
    this.checkpoint();
    this.reset(name);
    this.changed();
  }

  clear() {
    this.setPreset(this.preset);
  }

  setGrip(grip: Grip) {
    this.grip = grip;
    this.publish();
  }

  setDuration(seconds: number) {
    this.duration = seconds;
    this.publish();
  }

  setSpeed(speed: number) {
    this.speed = speed;
    this.publish();
  }

  select(id: number | null) {
    this.selected = id;
    this.publish();
  }

  /** Reproduce el movimiento planeado: cada mano va a su punto, todas juntas, durante `seconds`. */
  play(seconds = this.duration) {
    if (this.busy) return;
    this.checkpoint();
    const start = this.sim.time;
    const from = new Map<HandState, Vec3>();
    for (const s of this.hands) {
      if (same(s.plan, s.hand.target)) continue;
      from.set(s, [...s.hand.target]);
      // Una mano que está quieta desde su última key se queda ahí hasta ahora, y después se mueve.
      const last = s.track.keys.at(-1)?.t ?? s.track.grab;
      if (last < start - 1e-6) s.track.keys.push({ t: start, p: [...s.hand.target] });
    }
    this.move = { start, end: start + seconds, from };
    this.busy = "move";
    this.publish();
  }

  /** Deja correr el tiempo con todas las manos quietas, para que la soga se acomode o una mano termine de soltar. */
  wait() {
    for (const s of this.hands) s.plan = [...s.hand.target];
    this.play(0.5);
  }

  /** Suelta una mano: se abre durante un momento de tiempo corriendo (el próximo movimiento o espera). */
  letGo(id = this.selected) {
    const s = this.hands.find((h) => h.id === id);
    if (!s || this.busy) return;
    this.checkpoint();
    s.hand.release = this.sim.time + RELEASE;
    this.guides.push(toGuide(s.track, s.hand.release));
    this.hands = this.hands.filter((h) => h !== s);
    if (this.selected === id) this.selected = this.hands.at(-1)?.id ?? null;
    this.changed();
  }

  /** Sube (1) o baja (-1) el punto de la mano elegida. */
  lift(direction: number) {
    const s = this.hands.find((h) => h.id === this.selected);
    if (!s || this.busy) return;
    const floor = radiusOf(this.preset, s.track.rope);
    s.plan[1] = Math.min(MAX_HEIGHT, Math.max(floor, s.plan[1] + direction * LIFT_STEP));
    if (this.dragging?.state === s) this.dragging.height = s.plan[1];
    this.changed();
  }

  markStep(title: string) {
    this.steps.push({ t: Number(this.sim.time.toFixed(2)), title });
    this.changed();
  }

  undo() {
    this.travel(this.undoStack, this.redoStack);
  }

  redo() {
    this.travel(this.redoStack, this.undoStack);
  }

  /** Pone el punto de la mano elegida en un lugar exacto (metros; y es la altura). */
  setPlan(axis: 0 | 1 | 2, value: number) {
    const s = this.hands.find((h) => h.id === this.selected);
    if (!s || this.busy || !Number.isFinite(value)) return;
    const floor = radiusOf(this.preset, s.track.rope);
    s.plan[axis] = axis === 1 ? Math.min(MAX_HEIGHT, Math.max(floor, value)) : value;
    this.changed();
  }

  /** Vuelve atrás (o adelante) al estado que está arriba de `from`, guardando el presente en `to`. */
  private travel(from: Saved[], to: Saved[]) {
    const saved = from.pop();
    if (!saved || this.busy) return;
    to.push(this.save());
    if (saved.preset !== this.preset) this.reset(saved.preset);
    this.apply(saved);
    this.changed();
  }

  /** Reproduce todo lo grabado desde el principio en una simulación nueva, tal como la va a bakear la app. */
  replay() {
    if (this.busy) return;
    const knot = knotOf(this.recording());
    this.live = this.sim;
    this.sim = new RopeSim(knot);
    this.replayEnd = knot.duration;
    this.busy = "replay";
    this.publish();
  }

  /** Vuelve de una repetición a donde estaba la edición. */
  stopReplay() {
    if (this.busy !== "replay" || !this.live) return;
    this.sim = this.live;
    this.live = null;
    this.busy = null;
    this.publish();
  }

  dispose() {
    const c = this.canvas;
    c.removeEventListener("pointerdown", this.onDown, { capture: true });
    c.removeEventListener("pointermove", this.onMove);
    c.removeEventListener("pointerup", this.onUp);
    c.removeEventListener("pointercancel", this.onUp);
    c.removeEventListener("wheel", this.onWheel, { capture: true });
    window.removeEventListener("keydown", this.onKey);
    this.stage.renderer.setAnimationLoop(null);
    this.clearScene();
    for (const m of this.materials.values()) m.dispose();
    for (const m of this.marks.values()) for (const l of [m.drop, m.link]) l.geometry.dispose();
    for (const m of [
      this.stemGeometry,
      this.dotMaterial,
      this.ghostMaterial,
      this.lineMaterial,
      this.dotGeometry,
      this.arrowGeometry,
    ])
      m.dispose();
    this.stage.dispose();
  }

  /** Todo lo grabado hasta ahora; las manos que siguen agarrando se escriben como si soltaran ahora. */
  private recording(): Recording {
    const release = this.sim.time + RELEASE;
    const open = this.hands.map((s) => toGuide(s.track, Math.max(release, s.track.grab + RELEASE)));
    return { preset: this.preset, guides: [...this.guides, ...open], steps: this.steps };
  }

  /** Un arranque nuevo desde el preset `name`: la soga tendida, sin manos. */
  private reset(name: string) {
    this.preset = name;
    this.guides = [];
    this.steps = [];
    this.hands = [];
    this.selected = null;
    this.clearScene();
    const knot = knotOf({ preset: name, guides: [], steps: [] });
    this.sim = new RopeSim(knot);
    const anisotropy = this.stage.renderer.capabilities.getMaxAnisotropy();
    this.meshes = knot.ropes.map((def, k) => {
      const color = def.color ?? NATURAL_ROPE;
      if (!this.materials.has(color))
        this.materials.set(color, createRopeMaterial(color, anisotropy));
      const mesh = new RopeMesh(this.sim.ropes[k].count, def, this.materials.get(color)!);
      this.stage.scene.add(mesh);
      return mesh;
    });
    this.props = (knot.props ?? []).map(createPropMesh);
    for (const p of this.props) this.stage.scene.add(p);
    this.frames = this.sim.ropes.map((r) => new MaterialFrames(r.count));
    this.buffers = this.sim.ropes.map((r) => ({
      positions: new Float32Array(r.count * 3),
      normals: new Float32Array(r.count * 3),
    }));
  }

  private save(): Saved {
    return structuredClone({
      preset: this.preset,
      sim: this.sim.save(),
      hands: this.hands,
      letting: [...this.sim.hands].filter((h) => h.release !== undefined),
      guides: this.guides,
      steps: this.steps,
      nextId: this.nextId,
    });
  }

  private apply(saved: Saved) {
    const s = structuredClone(saved);
    this.sim.restore(s.sim);
    this.sim.hands.clear();
    for (const h of [...s.hands.map((h) => h.hand), ...s.letting]) this.sim.hands.add(h);
    this.hands = s.hands;
    this.guides = s.guides;
    this.steps = s.steps;
    this.nextId = s.nextId;
    if (!this.hands.some((h) => h.id === this.selected))
      this.selected = this.hands.at(-1)?.id ?? null;
  }

  private checkpoint() {
    this.redoStack = [];
    this.undoStack.push(this.save());
    if (this.undoStack.length > UNDO_DEPTH) this.undoStack.shift();
  }

  private clearScene() {
    for (const o of [...this.meshes, ...this.props]) {
      this.stage.scene.remove(o);
      o.geometry.dispose();
    }
    for (const p of this.props) (p.material as THREE.Material).dispose();
    this.meshes = [];
    this.props = [];
  }

  private frame(now: number) {
    this.clock.update(now);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    if (this.busy) {
      this.carry += dt * this.speed;
      for (let i = 0; this.busy && this.carry >= 1 / FPS && i < 4; i++) {
        this.carry -= 1 / FPS;
        this.tick();
      }
    } else this.carry = 0;
    this.draw();
    this.stage.render(now);
    if (Math.floor(this.sim.time * 10) !== this.shownTime || this.busy !== this.snapshot.busy)
      this.publish();
  }

  /** Un cuadro de un movimiento o una repetición en curso. */
  private tick() {
    const move = this.move;
    if (this.busy === "move" && move) {
      // Cada mano va suave de donde estaba a su punto, arrancando y frenando en reposo: la curva
      // que sigue una guía entre dos keys en las que se queda quieta.
      const t = this.sim.time + 1 / FPS;
      const u = Math.min(1, Math.max(0, (t - move.start) / (move.end - move.start || 1)));
      const e = u * u * (3 - 2 * u);
      for (const [s, from] of move.from)
        s.hand.target = from.map((c, i) => c + (s.plan[i] - c) * e) as Vec3;
      this.sim.step();
      if (this.sim.time >= move.end + HOLD - 1e-9) {
        for (const s of move.from.keys()) {
          s.hand.target = [...s.plan];
          s.track.keys.push({ t: move.end, p: [...s.plan] });
        }
        this.move = null;
        this.busy = null;
        this.changed();
      }
    } else if (this.busy === "replay") {
      this.sim.step();
      if (this.sim.time >= this.replayEnd) this.stopReplay();
    }
  }

  private draw() {
    this.sim.ropes.forEach((r, k) => {
      const x = this.sim.x.subarray(r.start * 3, (r.start + r.count) * 3);
      this.frames[k].update(x);
      this.buffers[k].positions.set(x);
      this.buffers[k].normals.set(this.frames[k].normals);
      this.meshes[k].update(this.buffers[k].positions, this.buffers[k].normals);
    });
    // Cada mano: un punto a donde va, una línea hasta la mesa debajo de él y, mientras no llegó, un
    // punto tenue donde está y una línea entre los dos. La elegida tiene un punto más grande y una
    // manija para levantar encima.
    const replaying = this.busy === "replay";
    for (const [id, m] of this.marks)
      if (replaying || !this.hands.some((s) => s.id === id)) {
        this.dots.remove(m.dot, m.ghost, m.arrow, m.drop, m.link, m.stem);
        for (const l of [m.drop, m.link]) l.geometry.dispose();
        this.marks.delete(id);
      }
    if (replaying) return;
    for (const s of this.hands) {
      const m = this.marks.get(s.id) ?? this.addMarks(s.id);
      const selected = s.id === this.selected;
      const [x, y, z] = s.plan;
      m.dot.position.set(x, y, z);
      m.dot.scale.setScalar(selected ? 0.012 : 0.008);
      m.ghost.position.set(...s.hand.target);
      m.ghost.visible = m.link.visible = !same(s.plan, s.hand.target);
      setLine(m.drop, [x, y, z], [x, 0, z]);
      setLine(m.link, s.hand.target, s.plan);
      m.arrow.visible = m.stem.visible = selected && !this.busy;
      m.arrow.position.set(x, y + STEM, z);
      m.stem.position.set(x, y + STEM / 2, z);
      m.stem.scale.set(1, STEM, 1);
    }
  }

  private addMarks(id: number): Marks {
    const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, size = 1) => {
      const m = new THREE.Mesh(geometry, material);
      m.scale.setScalar(size);
      return m;
    };
    const line = () =>
      new THREE.Line(
        new THREE.BufferGeometry().setAttribute(
          "position",
          new THREE.BufferAttribute(new Float32Array(6), 3),
        ),
        this.lineMaterial,
      );
    const m: Marks = {
      dot: mesh(this.dotGeometry, this.dotMaterial),
      ghost: mesh(this.dotGeometry, this.ghostMaterial, 0.006),
      arrow: mesh(this.arrowGeometry, this.dotMaterial),
      drop: line(),
      link: line(),
      stem: mesh(this.stemGeometry, this.dotMaterial),
    };
    for (const o of Object.values(m)) {
      o.renderOrder = 1;
      o.frustumCulled = false;
      this.dots.add(o);
    }
    this.marks.set(id, m);
    return m;
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.target instanceof Element && e.target.closest("input, textarea, select, button")) return;
    if ((e.metaKey || e.ctrlKey) && e.code === "KeyZ") {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
      return;
    }
    const action = {
      KeyW: () => this.lift(1),
      ArrowUp: () => this.lift(1),
      KeyS: () => this.lift(-1),
      ArrowDown: () => this.lift(-1),
      Space: () => this.play(),
      Enter: () => this.play(),
      Backspace: () => this.letGo(),
      Delete: () => this.letGo(),
      Escape: () => this.select(null),
    }[e.code];
    const digit = /^Digit([1-9])$/.exec(e.code);
    if (action) action();
    else if (digit) this.select(this.hands[Number(digit[1]) - 1]?.id ?? this.selected);
    else return;
    e.preventDefault();
  };

  /** Sobre un punto: elegirlo y arrastrarlo. Sobre la soga: elegir la mano que está ahí, o ponerle una mano nueva. */
  private onDown = (e: PointerEvent) => {
    if (this.busy || e.button !== 0) return;
    const lifting = this.hands.find((s) => s.id === this.selected && this.onHandle(e, s));
    if (lifting) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const grabY = this.onStem(e, lifting)?.y ?? lifting.plan[1] + STEM;
      this.dragging = {
        state: lifting,
        height: lifting.plan[1],
        lift: { grabY, startY: lifting.plan[1] },
      };
      this.stage.controls.enabled = false;
      this.canvas.setPointerCapture(e.pointerId);
      this.canvas.style.cursor = "ns-resize";
      return;
    }
    let state = this.dotAt(e);
    if (!state) {
      const index = this.ropeAt(e);
      if (index < 0) return;
      state = this.hands.find((s) => s.hand.index === index) ?? this.addHand(index);
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    this.selected = state.id;
    this.dragging = { state, height: state.plan[1] };
    this.stage.controls.enabled = false;
    this.canvas.setPointerCapture(e.pointerId);
    this.canvas.style.cursor = "grabbing";
    this.publish();
  };

  private onMove = (e: PointerEvent) => {
    const drag = this.dragging;
    if (!drag) {
      if (this.busy || e.buttons !== 0) return;
      const selected = this.hands.find((s) => s.id === this.selected);
      this.canvas.style.cursor =
        selected && this.onHandle(e, selected)
          ? "ns-resize"
          : this.dotAt(e) || this.ropeAt(e) >= 0
            ? "pointer"
            : "";
      return;
    }
    if (drag.lift) {
      const hit = this.onStem(e, drag.state);
      if (!hit) return;
      const floor = radiusOf(this.preset, drag.state.track.rope);
      const y = drag.lift.startY + hit.y - drag.lift.grabY;
      drag.state.plan[1] = Math.min(MAX_HEIGHT, Math.max(floor, y));
      drag.height = drag.state.plan[1];
      this.publish();
      return;
    }
    const point = this.onPlane(e, drag.height);
    if (point) drag.state.plan = [point.x, drag.height, point.z];
  };

  private onUp = () => {
    if (!this.dragging) return;
    this.dragging = null;
    this.stage.controls.enabled = true;
    this.canvas.style.cursor = "pointer";
    this.changed();
  };

  /** La rueda sube o baja un punto mientras se lo arrastra. */
  private onWheel = (e: WheelEvent) => {
    if (!this.dragging) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    this.lift(-Math.sign(e.deltaY));
  };

  private addHand(index: number): HandState {
    this.checkpoint();
    const k = this.sim.ropes.findIndex((r) => index < r.start + r.count);
    const r = this.sim.ropes[k];
    const x = this.sim.x;
    const at: Vec3 = [x[index * 3], x[index * 3 + 1], x[index * 3 + 2]];
    const grip = GRIPS[this.grip];
    const hand: Hand = { index, target: [...at], ...grip };
    this.sim.hands.add(hand);
    const state: HandState = {
      id: this.nextId++,
      grip: this.grip,
      hand,
      plan: [at[0], Math.max(at[1], PICK_UP * radiusOf(this.preset, k)), at[2]],
      track: {
        rope: k,
        at: (index - r.start) / (r.count - 1),
        grab: this.sim.time,
        keys: [],
        ...grip,
      },
    };
    this.hands.push(state);
    this.changed();
    return state;
  }

  /** Si el puntero está sobre la manija para levantar de la mano `s`. */
  private onHandle(e: PointerEvent, s: HandState): boolean {
    return this.screenDistance(e, [s.plan[0], s.plan[1] + STEM, s.plan[2]]) < HANDLE_PX;
  }

  /** Dónde cruza el rayo del puntero el plano vertical que pasa por el punto de la mano `s`, de frente a la cámara. */
  private onStem(e: PointerEvent, s: HandState): THREE.Vector3 | null {
    const cam = this.stage.camera.position;
    const normal = new THREE.Vector3(cam.x - s.plan[0], 0, cam.z - s.plan[2]).normalize();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      normal,
      new THREE.Vector3(...s.plan),
    );
    return this.ray(e).intersectPlane(plane, new THREE.Vector3());
  }

  /** La mano cuyo punto está debajo del puntero. */
  private dotAt(e: PointerEvent): HandState | null {
    let best: HandState | null = null;
    let bestDist = DOT_PX;
    for (const s of this.hands) {
      const d = this.screenDistance(e, s.plan);
      if (d < bestDist) [best, bestDist] = [s, d];
    }
    return best;
  }

  /** La partícula más cercana al puntero en pantalla, prefiriendo la soga de arriba; -1 si no hay ninguna cerca. */
  private ropeAt(e: PointerEvent): number {
    let best = -1;
    let bestScore = PICK_PX;
    const x = this.sim.x;
    for (let i = 0; i < this.sim.n; i++) {
      const p: Vec3 = [x[i * 3], x[i * 3 + 1], x[i * 3 + 2]];
      const score = this.screenDistance(e, p) - p[1] * 100;
      if (score < bestScore) [best, bestScore] = [i, score];
    }
    return best;
  }

  private screenDistance(e: PointerEvent, p: Vec3): number {
    const rect = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector3(...p).project(this.stage.camera);
    const px = ((v.x + 1) / 2) * rect.width + rect.left;
    const py = ((1 - v.y) / 2) * rect.height + rect.top;
    return Math.hypot(px - e.clientX, py - e.clientY);
  }

  /** Dónde cruza el rayo del puntero el plano horizontal a `height`. */
  private onPlane(e: PointerEvent, height: number): THREE.Vector3 | null {
    return this.ray(e).intersectPlane(
      new THREE.Plane(new THREE.Vector3(0, 1, 0), -height),
      new THREE.Vector3(),
    );
  }

  private ray(e: PointerEvent): THREE.Ray {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const caster = new THREE.Raycaster();
    caster.setFromCamera(ndc, this.stage.camera);
    return caster.ray;
  }

  private changed() {
    this.version++;
    if (!this.busy) store(this.save());
    this.publish();
  }

  private publish() {
    this.shownTime = Math.floor(this.sim.time * 10);
    if (this.code.version !== this.version)
      this.code = { version: this.version, text: formatKnot(knotOf(this.recording())) };
    this.snapshot = {
      time: this.sim.time,
      preset: this.preset,
      moves: this.guides.length + this.hands.length,
      steps: [...this.steps],
      hands: this.hands.map((s) => ({
        id: s.id,
        grip: s.grip,
        height: s.plan[1],
        planned: !same(s.plan, s.hand.target),
      })),
      selected: this.selected,
      grip: this.grip,
      duration: this.duration,
      speed: this.speed,
      busy: this.busy,
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      plan: ((p) => (p ? [...p] : null))(
        this.hands.find((h) => h.id === this.selected)?.plan,
      ) as Vec3 | null,
      code: this.code.text,
    };
    this.listeners.forEach((l) => l());
  }
}

function setLine(line: THREE.Line, a: Vec3, b: Vec3) {
  const attr = line.geometry.getAttribute("position") as THREE.BufferAttribute;
  attr.setXYZ(0, ...a);
  attr.setXYZ(1, ...b);
  attr.needsUpdate = true;
}

const same = (a: Vec3, b: Vec3) => a.every((c, i) => Math.abs(c - b[i]) < 1e-6);

function radiusOf(preset: string, rope: number): number {
  return presetOf({ preset, guides: [], steps: [] }).ropes[rope].radius;
}

function load(): Saved | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Saved | null;
    return saved?.sim && Array.isArray(saved.hands) ? saved : null;
  } catch {
    return null;
  }
}

function store(saved: Saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Ventanas privadas y almacenamiento lleno: el trabajo simplemente no se guarda entre recargas.
  }
}
