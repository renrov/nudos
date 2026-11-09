import { type ReactNode, useSyncExternalStore } from "react";
import type { KnotDef } from "../../../engine/knots/types";
import type { Player } from "../../../engine/playback/player";
import { useMountEffect } from "../../shared/hooks";
import { LoopIcon, PauseIcon, PlayIcon } from "../../shared/ui/icons";
import styles from "./player.module.css";

/** Segundos con coma decimal, como se escriben en Argentina: 4,6. */
const seconds = (t: number) => t.toFixed(1).replace(".", ",");

const SPEEDS = [
  { value: 0.25, label: "¼×" },
  { value: 0.5, label: "½×" },
  { value: 1, label: "1×" },
  { value: 2, label: "2×" },
];

/**
 * El paso actual y la barra de reproducción del reproductor de un nudo; también conecta los atajos de teclado.
 * `extra` va al final de la barra, después del botón de repetir.
 */
export function PlayerBar({
  player,
  steps,
  extra,
}: {
  player: Player;
  steps: KnotDef["steps"];
  extra?: ReactNode;
}) {
  const s = useSyncExternalStore(player.subscribe, player.getSnapshot, player.getSnapshot);
  const time = Math.min(s.time, s.duration);
  const percent = (t: number) => `${(t / s.duration) * 100}%`;
  useKeyboardShortcuts(player);

  return (
    <section className={styles.player} aria-label="Reproducción" data-baked={s.ready >= s.duration}>
      <p className={styles.step}>
        <span className={styles.stepNum}>
          {s.step + 1}/{steps.length}
        </span>
        <span className={styles.stepTitle} aria-live="polite">
          {steps[s.step].title}
        </span>
      </p>
      <div className={styles.bar}>
        <button
          type="button"
          className={styles.play}
          aria-label={s.playing ? "Pausar" : "Reproducir"}
          aria-pressed={s.playing}
          onClick={player.togglePlay}
        >
          {s.playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <div className={styles.track}>
          <div className={styles.rail}>
            <div className={styles.ready} style={{ width: percent(s.ready) }} />
            <div className={styles.played} style={{ width: percent(time) }} />
          </div>
          <ol className={styles.ticks}>
            {steps.map((step, i) => (
              <li key={step.t}>
                <button
                  type="button"
                  style={{ left: percent(step.t) }}
                  aria-label={`Paso ${i + 1}: ${step.title}`}
                  title={step.title}
                  aria-current={i === s.step ? "step" : undefined}
                  onClick={() => player.seek(step.t)}
                />
              </li>
            ))}
          </ol>
          <input
            className={styles.scrub}
            type="range"
            min={0}
            max={s.duration}
            step={0.01}
            value={time}
            aria-label="Línea de tiempo"
            aria-valuetext={`${seconds(time)} de ${seconds(s.duration)} segundos`}
            onChange={(e) => player.seek(Number(e.target.value))}
          />
        </div>
        <span className={styles.clock}>{seconds(time)}s</span>
        <div className={styles.speed} role="radiogroup" aria-label="Velocidad">
          {SPEEDS.map(({ value, label }) => (
            <label key={value}>
              <input
                type="radio"
                name="speed"
                value={value}
                checked={s.speed === value}
                onChange={() => player.setSpeed(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <button
          type="button"
          className={styles.loop}
          aria-label="Repetir"
          aria-pressed={s.loop}
          onClick={player.toggleLoop}
        >
          <LoopIcon />
        </button>
        {extra}
      </div>
    </section>
  );
}

/**
 * Espacio reproduce o pausa, las flechas avanzan y retroceden de a un paso; los controles con foco
 * conservan sus propias teclas.
 */
function useKeyboardShortcuts(player: Player) {
  useMountEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector("dialog[open]")) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return;
      if (e.key === " ") {
        e.preventDefault();
        player.togglePlay();
      } else if (e.key === "ArrowRight") player.stepBy(1);
      else if (e.key === "ArrowLeft") player.stepBy(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });
}
