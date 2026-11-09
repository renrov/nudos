import { useState } from "react";
import { Link } from "react-router";
import { useMountEffect } from "../../shared/hooks";
import { StarIcon } from "../../shared/ui/icons";
import { markPromptSeen, promptSeen } from "./prompt";
import styles from "./stargazers.module.css";

/** Cuánto tiempo mira un nudo alguien antes de que aparezca el aviso. */
const DELAY_MS = 10_000;

/**
 * Pide una estrella una sola vez, a los diez segundos, y nunca a alguien que ya lo vio o que visitó
 * la soga de estrellas. `repoUrl` es el repositorio, `to` la página de la soga.
 */
export function StarPrompt({ repoUrl, to }: { repoUrl: string; to: string }) {
  const [open, setOpen] = useState(false);
  useMountEffect(() => {
    if (promptSeen()) return;
    const id = setTimeout(() => {
      if (promptSeen()) return;
      markPromptSeen();
      setOpen(true);
    }, DELAY_MS);
    return () => clearTimeout(id);
  });
  if (!open) return null;
  const close = () => setOpen(false);

  return (
    <aside className={styles.prompt} aria-label="Sumate a la soga de estrellas">
      <p>
        <strong>¿Te gusta?</strong> Dale una estrella al repo y tu cara se suma a la soga.
      </p>
      <div>
        <a
          className={styles.promptStar}
          href={repoUrl}
          target="_blank"
          rel="noopener"
          onClick={close}
        >
          <StarIcon /> Dale estrella en GitHub
        </a>
        <Link to={to}>Ver la soga</Link>
        <button type="button" onClick={close}>
          Ahora no
        </button>
      </div>
    </aside>
  );
}
