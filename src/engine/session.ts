import type { KnotDef } from "./knots/types";
import type { Player } from "./playback/player";
import { Timeline } from "./playback/timeline";
import { DEFAULT_PHYSICS, type RopePhysics } from "./sim/rope";

/** Un nudo que se está mirando: sus cuadros bakeándose en un worker y la reproducción sobre ellos. */
export interface KnotSession {
  readonly knot: KnotDef;
  readonly timeline: Timeline;
  readonly player: Player;
  /** Frena el bakeo; llamalo cuando se deja el nudo o se vuelve a bakear. */
  dispose(): void;
}

/**
 * Empieza a bakear `knot` y le pasa el progreso a `player`. Solo en el navegador (arranca un
 * worker); el player en sí se puede crear en cualquier lado, así las páginas prerenderizadas
 * muestran el mismo estado inicial.
 */
export function createKnotSession(
  knot: KnotDef,
  player: Player,
  physics: RopePhysics = DEFAULT_PHYSICS,
): KnotSession {
  const timeline = new Timeline(knot, () => player.setReady(timeline.ready), physics);
  return { knot, timeline, player, dispose: () => timeline.dispose() };
}
