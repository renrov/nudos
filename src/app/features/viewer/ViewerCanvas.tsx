import { useRef, useState, useSyncExternalStore } from "react";
import { KnotViewer } from "../../../engine/render/viewer";
import { useMountEffect } from "../../shared/hooks";
import { PartsIcon, ResetViewIcon } from "../../shared/ui/icons";
import styles from "./viewer.module.css";

/**
 * Arranca lo que muestra el visor; devuelve una función de limpieza. Llamá a `onDrawn` cuando el
 * primer cuadro esté en pantalla.
 */
export type StartViewer = (viewer: KnotViewer, onDrawn: () => void) => () => void;

/**
 * La vista 3D: un canvas a pantalla completa con la imagen del nudo encima hasta que se dibuja el
 * primer cuadro, así la página nunca está vacía y nada se mueve cuando aparece la escena. Volvé a
 * montarlo para empezar de nuevo.
 * `onViewer` entrega el visor (y null cuando ya no está), por ejemplo para un ResetViewButton en otro lado.
 */
export function ViewerCanvas({
  poster,
  start,
  onViewer,
}: {
  poster: string;
  start: StartViewer;
  onViewer?: (viewer: KnotViewer | null) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const partsLayer = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(false);

  useMountEffect(() => {
    const v = new KnotViewer(canvas.current!, partsLayer.current);
    const stop = start(v, () => setDrawn(true));
    v.setPartsShown(partsSaved());
    // P prende o apaga las partes de la soga, salvo escribiendo o con un diálogo abierto.
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "p" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || document.querySelector("dialog[open]")) return;
      toggleParts(v);
    };
    document.addEventListener("keydown", onKey);
    onViewer?.(v);
    return () => {
      document.removeEventListener("keydown", onKey);
      onViewer?.(null);
      stop();
      v.dispose();
    };
  });

  return (
    <>
      <canvas
        ref={canvas}
        className={styles.scene}
        aria-label="Vista 3D de la soga. Arrastrá para girarla; usá la rueda o pellizcá para hacer zoom."
      />
      <img className={styles.poster} src={poster} alt="" data-hidden={drawn} decoding="async" />
      <div ref={partsLayer} className={styles.parts} aria-hidden="true" />
    </>
  );
}

const noViewer = () => () => {};

const PARTS_KEY = "rope-parts";

/** Si el visitante dejó prendidas las partes de la soga, así siguen así en el próximo nudo. */
function partsSaved() {
  try {
    return localStorage.getItem(PARTS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Prende o apaga las partes de la soga y recuerda la elección en este dispositivo. */
function toggleParts(viewer: KnotViewer) {
  const on = !viewer.partsShown();
  viewer.setPartsShown(on);
  try {
    localStorage.setItem(PARTS_KEY, on ? "1" : "0");
  } catch {
    // Sin almacenamiento, la elección dura hasta que se cambia de nudo.
  }
}

/**
 * Prende o apaga las etiquetas de las partes de la soga (punta, parte fija, bucle…), que la siguen
 * mientras se ata. También con P. Se renderiza antes de que exista el visor (deshabilitado), como
 * ResetViewButton.
 */
export function PartsButton({ viewer }: { viewer: KnotViewer | null }) {
  const pressed = useSyncExternalStore(
    viewer?.onPartsChange ?? noViewer,
    () => viewer?.partsShown() ?? false,
    () => false,
  );
  const label = pressed ? "Ocultar las partes de la soga (P)" : "Mostrar las partes de la soga (P)";
  return (
    <button
      type="button"
      className={styles.partsToggle}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={!viewer}
      onClick={(e) => {
        if (viewer) toggleParts(viewer);
        // Después de un clic con el mouse, devolverle la barra espaciadora a reproducir/pausar.
        if (e.detail > 0) e.currentTarget.blur();
      }}
    >
      <PartsIcon />
    </button>
  );
}

/**
 * Lleva la cámara suavemente de vuelta a donde arrancó; se atenúa mientras la vista ya está ahí.
 * También se renderiza antes de que exista el visor (deshabilitado), así el layout de la página es
 * el mismo antes y después.
 */
export function ResetViewButton({ viewer }: { viewer: KnotViewer | null }) {
  const isDefault = useSyncExternalStore(
    viewer?.onViewChange ?? noViewer,
    () => viewer?.isDefaultView() ?? true,
    () => true,
  );
  return (
    <button
      type="button"
      className={styles.reset}
      aria-label="Restablecer vista"
      title="Restablecer vista"
      disabled={isDefault}
      onClick={() => viewer?.resetView()}
    >
      <ResetViewIcon />
    </button>
  );
}
