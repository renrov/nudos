import type { KnotDef } from "../knots/types";
import { frameCount } from "../sim/bake";
import { FPS } from "../sim/rope";

const LOOP_REST = 1.2; // segundos que se muestra el nudo terminado antes de repetir

export interface PlayerSnapshot {
  /** Segundos dentro del nudo; puede pasarse de `duration` mientras el nudo terminado descansa antes de repetir. */
  time: number;
  /** Segundos bakeados hasta ahora; la reproducción espera acá. */
  ready: number;
  duration: number;
  playing: boolean;
  loop: boolean;
  speed: number;
  /** Índice en los pasos del nudo para `time`. */
  step: number;
}

/**
 * Estado de reproducción de un nudo, sin nada de render ni de framework. El loop de render llama a
 * `tick`; la UI lo lee con `subscribe`/`getSnapshot` (encaja con useSyncExternalStore de React) y
 * llama a las acciones.
 */
export class Player {
  private snapshot: PlayerSnapshot;
  private readonly listeners = new Set<() => void>();

  /** Arranca en pausa en el primer paso sin nada bakeado, igual en el servidor que en el navegador. */
  constructor(
    private readonly steps: KnotDef["steps"],
    duration: number,
  ) {
    this.snapshot = { time: 0, ready: 0, duration, playing: false, loop: false, speed: 1, step: 0 };
  }

  static forKnot(knot: KnotDef) {
    return new Player(knot.steps, (frameCount(knot) - 1) / FPS);
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  togglePlay = () => {
    const { playing, time, duration } = this.snapshot;
    this.set({ playing: !playing, time: !playing && time >= duration ? 0 : time });
  };

  play = () => this.set({ playing: true });

  seek = (time: number) => this.set({ time: Math.min(Math.max(time, 0), this.snapshot.duration) });

  /** Salta al inicio del paso siguiente (+1) o del anterior (-1). */
  stepBy = (delta: number) => {
    const i = Math.min(Math.max(this.snapshot.step + delta, 0), this.steps.length - 1);
    this.seek(this.steps[i].t);
  };

  setSpeed = (speed: number) => this.set({ speed });

  toggleLoop = () => this.set({ loop: !this.snapshot.loop });

  setReady = (ready: number) => this.set({ ready });

  /** Avanza `dt` segundos de tiempo real, esperando en el borde de lo que ya está bakeado. */
  tick(dt: number) {
    const { playing, ready, duration, loop, speed } = this.snapshot;
    // El paso del primer cuadro puede ser negativo (su timestamp es anterior al arranque del reloj).
    if (!playing || dt <= 0) return;
    const limit = ready < duration ? ready : duration + LOOP_REST;
    const time = Math.min(this.snapshot.time + dt * speed, limit);
    if (time >= duration + (loop ? LOOP_REST : 0)) {
      this.set(loop ? { time: 0 } : { time: duration, playing: false });
    } else this.set({ time });
  }

  private set(patch: Partial<PlayerSnapshot>) {
    const next = { ...this.snapshot, ...patch };
    next.step = this.stepAt(next.time);
    if (
      Object.keys(next).every(
        (k) => next[k as keyof PlayerSnapshot] === this.snapshot[k as keyof PlayerSnapshot],
      )
    )
      return;
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }

  private stepAt(time: number) {
    let i = 0;
    while (i < this.steps.length - 1 && time >= this.steps[i + 1].t) i++;
    return i;
  }
}
