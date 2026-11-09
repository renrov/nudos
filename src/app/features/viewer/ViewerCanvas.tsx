import { useRef, useState, useSyncExternalStore } from "react";
import { KnotViewer } from "../../../engine/render/viewer";
import { useMountEffect } from "../../shared/hooks";
import { ResetViewIcon } from "../../shared/ui/icons";
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
  const [drawn, setDrawn] = useState(false);

  useMountEffect(() => {
    const v = new KnotViewer(canvas.current!);
    const stop = start(v, () => setDrawn(true));
    onViewer?.(v);
    return () => {
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
    </>
  );
}

const noViewer = () => () => {};

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
