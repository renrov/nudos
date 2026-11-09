import { useState } from "react";
import { useSearchParams } from "react-router";
import { knots } from "../../engine/knots";
import type { KnotDef } from "../../engine/knots/types";
import { Player } from "../../engine/playback/player";
import type { KnotViewer } from "../../engine/render/viewer";
import { createKnotSession } from "../../engine/session";
import { KnotPicker } from "../features/picker";
import { PlayerBar, ShareButton } from "../features/player";
import { StarPrompt, StargazerLink } from "../features/stargazers";
import { Tuner, physicsFromParams } from "../features/tuner";
import { ResetViewButton, ViewerCanvas, type StartViewer } from "../features/viewer";
import { useMountEffect } from "../shared/hooks";
import {
  REPO_URL,
  SITE_NAME,
  STARGAZERS_DATA,
  STARGAZERS_PATH,
  knotImagePath,
  knotPath,
} from "../shared/site";
import { iconButtonClass } from "../shared/ui/IconButton";
import { EyeIcon, EyeOffIcon, GitHubIcon } from "../shared/ui/icons";
import styles from "./KnotScreen.module.css";

/** La página entera de un nudo: la vista 3D, su nombre y resumen, el reproductor, el selector y los links. */
export function KnotScreen({ knot }: { knot: KnotDef }) {
  const [params] = useSearchParams();
  const physics = physicsFromParams(params);
  // Un nudo o un material de soga nuevo arranca una sesión nueva (visor, bakeo, reproductor) al volver a montar.
  return <Session key={`${knot.id} ${JSON.stringify(physics)}`} knot={knot} physics={physics} />;
}

function Session({
  knot,
  physics,
}: {
  knot: KnotDef;
  physics: ReturnType<typeof physicsFromParams>;
}) {
  // Datos planos, así la página prerenderizada muestra el mismo primer paso y la misma duración que el navegador.
  const [player] = useState(() => Player.forKnot(knot));
  const [viewer, setViewer] = useState<KnotViewer | null>(null);
  const [clean, setClean] = useState(false);
  const start: StartViewer = (viewer, onDrawn) => {
    const session = createKnotSession(knot, player, physics);
    viewer.show(session, onDrawn);
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) player.play();
    return session.dispose;
  };

  // H oculta o muestra todos los controles, para ver la soga limpia.
  useMountEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "h" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || document.querySelector("dialog[open]")) return;
      setClean((c) => !c);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  return (
    <div className={styles.page} data-clean={clean}>
      <ViewerCanvas poster={knotImagePath(knot.id)} start={start} onViewer={setViewer} />
      <header className={styles.top}>
        <KnotPicker knots={knots} currentId={knot.id} />
        <StargazerLink className={styles.stars} to={STARGAZERS_PATH} src={STARGAZERS_DATA} />
        <a
          className={iconButtonClass}
          href={REPO_URL}
          target="_blank"
          rel="noopener"
          aria-label="Ver el código en GitHub"
        >
          <GitHubIcon />
        </a>
        <button
          type="button"
          className={`${iconButtonClass} ${styles.hide}`}
          aria-label={clean ? "Mostrar controles (H)" : "Ocultar controles (H)"}
          title={clean ? "Mostrar controles (H)" : "Ocultar controles (H)"}
          aria-pressed={clean}
          onClick={(e) => {
            setClean(!clean);
            // Después de un clic con el mouse, devolverle la barra espaciadora a reproducir/pausar.
            if (e.detail > 0) e.currentTarget.blur();
          }}
        >
          {clean ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </header>
      <section className={`${styles.intro} ${styles.chrome}`}>
        <p className={styles.eyebrow}>{SITE_NAME}</p>
        <h1>{knot.name}</h1>
        <p className={styles.summary}>{knot.summary}</p>
      </section>
      <div className={styles.chrome}>
        <StarPrompt repoUrl={REPO_URL} to={STARGAZERS_PATH} />
        <PlayerBar
          player={player}
          steps={knot.steps}
          extra={
            <>
              <ShareButton name={knot.name} path={knotPath(knot)} />
              <ResetViewButton viewer={viewer} />
            </>
          }
        />
        <Tuner />
      </div>
      <footer className={`${styles.credit} ${styles.chrome}`}>
        hecho por{" "}
        <a href="https://x.com/baz7c8" target="_blank" rel="noopener">
          @baz7c8
        </a>
      </footer>
    </div>
  );
}
