import { useRef, useState, useSyncExternalStore } from "react";
import {
  DURATIONS,
  GRIPS,
  KnotRecorder,
  type Grip,
  type RecorderSnapshot,
} from "../../../engine/render/recorder";
import { PRESETS } from "../../../engine/record/recording";
import { useMountEffect } from "../../shared/hooks";
import {
  CloseIcon,
  CopyIcon,
  DragIcon,
  FoldIcon,
  LetGoIcon,
  PlayIcon,
  RedoIcon,
  ReplayIcon,
  UndoIcon,
  WaitIcon,
} from "../../shared/ui/icons";
import styles from "./recorder.module.css";

const SPEEDS = [1, 0.5, 0.25];
/** Cómo se llama cada agarre en pantalla. */
const GRIP_LABELS: Record<Grip, string> = { light: "suave", firm: "firme", pull: "tirón" };
/** Qué está haciendo el grabador, en pantalla. */
const BUSY_LABELS = { move: "moviendo", replay: "repitiendo" } as const;
const noRecorder = () => () => {};

/**
 * El taller de nudos: ponele manos a la soga, planeá a dónde van, reproducí el movimiento y obtené
 * todo como las guías de un nudo.
 */
export function Recorder() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [recorder, setRecorder] = useState<KnotRecorder | null>(null);
  useMountEffect(() => {
    const r = new KnotRecorder(canvas.current!);
    setRecorder(r);
    return () => r.dispose();
  });
  const state = useSyncExternalStore(
    recorder?.subscribe ?? noRecorder,
    () => recorder?.getSnapshot() ?? null,
    () => null,
  );

  return (
    <>
      <canvas ref={canvas} className={styles.scene} aria-label="Soga para atar con las manos" />
      {recorder && state && <Panel recorder={recorder} state={state} />}
    </>
  );
}

const PANEL_KEY = "knot-recorder-panel";

/** A dónde se arrastró el panel, guardado entre recargas; null para su esquina. */
function loadPlace(): { x: number; y: number } | null {
  try {
    return JSON.parse(localStorage.getItem(PANEL_KEY) ?? "null");
  } catch {
    return null;
  }
}

function Panel({ recorder, state }: { recorder: KnotRecorder; state: RecorderSnapshot }) {
  const idle = !state.busy;
  const [place, setPlace] = useState(loadPlace);
  const [folded, setFolded] = useState(false);
  const grab = useRef<{ dx: number; dy: number } | null>(null);

  const startDrag = (e: React.PointerEvent<HTMLElement>) => {
    if ((e.target as Element).closest("button")) return;
    const box = e.currentTarget.parentElement!.getBoundingClientRect();
    grab.current = { dx: e.clientX - box.left, dy: e.clientY - box.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const drag = (e: React.PointerEvent<HTMLElement>) => {
    if (!grab.current) return;
    const box = e.currentTarget.parentElement!.getBoundingClientRect();
    const x = Math.min(Math.max(0, e.clientX - grab.current.dx), innerWidth - box.width);
    const y = Math.min(Math.max(0, e.clientY - grab.current.dy), innerHeight - 40);
    setPlace({ x, y });
  };
  const endDrag = () => {
    if (!grab.current) return;
    grab.current = null;
    try {
      localStorage.setItem(PANEL_KEY, JSON.stringify(place));
    } catch {
      // El panel simplemente vuelve a su esquina al recargar.
    }
  };

  return (
    <section
      className={styles.panel}
      aria-label="Taller de nudos"
      style={
        place
          ? {
              left: place.x,
              top: place.y,
              right: "auto",
              bottom: "auto",
              maxHeight: `calc(100dvh - ${place.y + 16}px)`,
            }
          : undefined
      }
    >
      <header
        className={styles.titleBar}
        onPointerDown={startDrag}
        onPointerMove={drag}
        onPointerUp={endDrag}
        title="Arrastrá para mover el panel"
      >
        <DragIcon />
        <h2>Taller de nudos</h2>
        <button
          type="button"
          className={styles.icon}
          aria-label={folded ? "Desplegar el panel" : "Plegar el panel"}
          aria-expanded={!folded}
          onClick={() => setFolded(!folded)}
        >
          <FoldIcon className={folded ? styles.flipped : undefined} />
        </button>
      </header>

      <div className={styles.toolbar} role="toolbar" aria-label="Movimientos">
        <Tool
          label="Reproducir el movimiento (Espacio)"
          primary
          disabled={!idle}
          onClick={() => recorder.play()}
        >
          <PlayIcon />
        </Tool>
        <Tool label="Esperar ½ s" disabled={!idle} onClick={() => recorder.wait()}>
          <WaitIcon />
        </Tool>
        <Tool
          label="Soltar la mano elegida (Retroceso)"
          disabled={!idle || state.selected === null}
          onClick={() => recorder.letGo()}
        >
          <LetGoIcon />
        </Tool>
        <span className={styles.gap} />
        <Tool
          label="Deshacer (⌘Z)"
          disabled={!idle || !state.canUndo}
          onClick={() => recorder.undo()}
        >
          <UndoIcon />
        </Tool>
        <Tool
          label="Rehacer (⇧⌘Z)"
          disabled={!idle || !state.canRedo}
          onClick={() => recorder.redo()}
        >
          <RedoIcon />
        </Tool>
        {state.busy === "replay" ? (
          <Tool label="Volver a editar" onClick={() => recorder.stopReplay()}>
            <CloseIcon />
          </Tool>
        ) : (
          <Tool
            label="Repetir todo, como lo va a precalcular la app"
            disabled={!idle || !state.moves}
            onClick={() => recorder.replay()}
          >
            <ReplayIcon />
          </Tool>
        )}
        <Tool label="Copiar código" onClick={() => navigator.clipboard.writeText(state.code)}>
          <CopyIcon />
        </Tool>
      </div>

      <p className={styles.hint}>{hint(state)}</p>

      {!folded && (
        <>
          <p className={styles.status}>
            <span>{state.time.toFixed(2).replace(".", ",")} s</span>
            <span>
              {state.moves} {state.moves === 1 ? "mano usada" : "manos usadas"}
            </span>
            {state.busy && <span className={styles.busy}>{BUSY_LABELS[state.busy]}…</span>}
          </p>

          {state.hands.length > 0 && (
            <ol className={styles.hands}>
              {state.hands.map((h, i) => (
                <li key={h.id} aria-current={h.id === state.selected}>
                  <button type="button" onClick={() => recorder.select(h.id)}>
                    Mano {i + 1} · {GRIP_LABELS[h.grip]}
                    {h.planned && " · planeada"}
                  </button>
                  <Tool
                    label={`Soltar la mano ${i + 1}`}
                    disabled={!idle}
                    onClick={() => recorder.letGo(h.id)}
                  >
                    <LetGoIcon />
                  </Tool>
                </li>
              ))}
            </ol>
          )}

          {state.plan && (
            <fieldset className={styles.coords}>
              <legend>La mano elegida va a (cm)</legend>
              {(["X", "Altura", "Z"] as const).map((name, axis) => (
                <label key={name}>
                  {name}
                  <input
                    type="number"
                    step={0.5}
                    disabled={!idle}
                    value={Number((state.plan![axis] * 100).toFixed(1))}
                    onChange={(e) =>
                      recorder.setPlan(axis as 0 | 1 | 2, Number(e.target.value) / 100)
                    }
                  />
                </label>
              ))}
            </fieldset>
          )}

          <Choice
            label="El movimiento dura"
            options={DURATIONS}
            value={state.duration}
            format={(s) => `${String(s).replace(".", ",")} s`}
            onChange={(s) => recorder.setDuration(s)}
          />
          <Choice
            label="Agarre de las manos nuevas"
            options={Object.keys(GRIPS) as Grip[]}
            value={state.grip}
            format={(g) => GRIP_LABELS[g]}
            onChange={(g) => recorder.setGrip(g)}
          />
          <Choice
            label="Velocidad"
            options={SPEEDS}
            value={state.speed}
            format={(s) => `${String(s).replace(".", ",")}×`}
            onChange={(s) => recorder.setSpeed(s)}
          />

          <StepForm onMark={(title) => recorder.markStep(title)} />

          <label>
            Empezar desde
            <select
              value={state.preset}
              disabled={!idle}
              onChange={(e) =>
                (state.moves === 0 || confirm("¿Empezar de nuevo? Se va a borrar la grabación.")) &&
                recorder.setPreset(e.target.value)
              }
            >
              {PRESETS.map((p) => (
                <option key={p.name}>{p.name}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!idle || !state.moves}
            onClick={() => confirm("¿Borrar la grabación?") && recorder.clear()}
          >
            Borrar y empezar de nuevo
          </button>

          <details>
            <summary>Cómo funciona</summary>
            <ul>
              <li>
                Hacé clic en la soga para ponerle una mano. La mano sostiene ese punto hasta que la
                soltás.
              </li>
              <li>
                El tiempo queda frenado mientras planeás. Arrastrá el punto de una mano por la mesa;
                arrastrá la flecha que está sobre el punto elegido (o apretá W/S) para subirlo o
                bajarlo. La línea debajo de un punto marca su altura. Planeá todas las manos que
                quieras.
              </li>
              <li>
                Reproducir (Espacio) lleva todas las manos juntas a sus puntos, durante el tiempo
                del movimiento. Un punto tenue muestra dónde sigue estando una mano.
              </li>
              <li>Soltar abre la mano durante el próximo movimiento o espera.</li>
              <li>
                Deshacer y rehacer vuelven exactamente al paso anterior. Repetir muestra todo como
                lo va a precalcular la app.
              </li>
              <li>
                Agarre firme o de tirón para las manos que ajustan. Arrastrá la mesa vacía para
                girar la vista.
              </li>
              <li>
                Las teclas 1–9 eligen una mano. Arrastrá el panel desde el título; plegalo para ver
                más soga.
              </li>
            </ul>
          </details>
          <details>
            <summary>Código</summary>
            <textarea readOnly value={state.code} rows={12} />
          </details>
        </>
      )}
    </section>
  );
}

function Tool({
  label,
  primary,
  disabled,
  onClick,
  children,
}: {
  label: string;
  primary?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={primary ? `${styles.icon} ${styles.primary}` : styles.icon}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function hint(state: RecorderSnapshot): string {
  if (state.busy === "replay") return "Repitiendo todo desde el principio.";
  if (state.busy) return "Reproduciendo el movimiento…";
  if (!state.hands.length) return "Hacé clic en la soga para ponerle una mano.";
  if (state.hands.some((h) => h.planned))
    return "Planeá más manos si querés y después apretá Reproducir (Espacio).";
  return "Arrastrá un punto para mover su mano, o su flecha para levantarla. Hacé clic en la soga para otra mano.";
}

function Choice<T extends string | number>({
  label,
  options,
  value,
  format = String,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  format?: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className={styles.choice}>
      <legend>{label}</legend>
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={o === value} onClick={() => onChange(o)}>
          {format(o)}
        </button>
      ))}
    </fieldset>
  );
}

function StepForm({ onMark }: { onMark: (title: string) => void }) {
  const [title, setTitle] = useState("");
  return (
    <form
      className={styles.row}
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onMark(title.trim());
        setTitle("");
      }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título del paso, desde ahora"
        aria-label="Título del paso"
      />
      <button type="submit" disabled={!title.trim()}>
        Marcar paso
      </button>
    </form>
  );
}
