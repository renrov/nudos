import { useRef } from "react";
import { Link } from "react-router";
import type { KnotDef } from "../../../engine/knots/types";
import { knotImagePath, knotPath } from "../../shared/site";
import { CloseIcon, MenuIcon } from "../../shared/ui/icons";
import styles from "./picker.module.css";

/** El botón "Todos los nudos" y su hoja: una grilla de tarjetas, cada una con link a la página de un nudo. */
export function KnotPicker({ knots, currentId }: { knots: KnotDef[]; currentId: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => dialog.current?.close();

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        <MenuIcon />
        Todos los nudos
      </button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="picker-title"
        // La hoja ocupa todo el diálogo, así que un clic en el diálogo mismo es un clic en el fondo.
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className={styles.sheet}>
          <div className={styles.head}>
            <h2 id="picker-title">Elegí un nudo</h2>
            <button type="button" className={styles.close} aria-label="Cerrar" onClick={close}>
              <CloseIcon />
            </button>
          </div>
          <ul className={styles.grid}>
            {knots.map((k) => (
              <li key={k.id}>
                <Link
                  to={knotPath(k)}
                  className={styles.card}
                  aria-current={k.id === currentId ? "page" : undefined}
                  onClick={close}
                >
                  <img src={knotImagePath(k.id)} alt="" width={1200} height={630} loading="lazy" />
                  <strong>{k.name}</strong>
                  <span>{k.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  );
}
