import { useMemo, useRef, useState } from "react";
import { useMountEffect } from "../../shared/hooks";
import { knotPath } from "../../shared/site";
import { PauseIcon, PlayIcon, SearchIcon } from "../../shared/ui/icons";
import { type Feed, decodeFeed } from "./feed";
import { knotFor, ropeLayout } from "./layout";
import { markPromptSeen } from "./prompt";
import { type Star, StarRope, countAt } from "./rope";
import styles from "./stargazers.module.css";

/** Cuánto dura la repetición: un pulso por estrella, así unas pocas estrellas no se arrastran, hasta seis segundos. */
const playMs = (stars: number) => Math.min(800 + stars * 150, 6000);
/**
 * La repetición ata solo las estrellas más nuevas, lo bastante lento para verlo; las más viejas ya
 * están en la soga.
 */
const REPLAY = 50;
const MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
const WEEK = 7 * 864e5;
const avatar = (s: Star, size: number) => `${s.user.avatar_url}&s=${size}`;
/** "As de guía · 4% de las estrellas" */
const knotLine = (s: Star) => {
  const kind = knotFor(s.user.id);
  return `${kind.name} · ${Math.round(kind.odds * 100)}% de las estrellas`;
};
const day = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { dateStyle: "medium" });
const month = (t: number) =>
  new Date(t).toLocaleDateString("es-AR", { month: "short", year: "numeric" });

/**
 * Cada estrella de GitHub como un nudo en una misma soga, con una línea de tiempo que repite cómo
 * se fueron juntando las estrellas.
 * `src` es el feed de stargazers (ver `Feed`), que actualiza la GitHub Action de stargazers.
 */
export function StargazerRope({ src, repoUrl }: { src: string; repoUrl: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const intro = useRef<HTMLElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const rope = useRef<StarRope>(null);
  const raf = useRef(0);
  const [stars, setStars] = useState<Star[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hover, setHover] = useState<{ star: Star; x: number; y: number } | null>(null);
  const [onSlot, setOnSlot] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ index: number } | "missing" | null>(null);

  const first = stars.length ? Date.parse(stars[0].starred_at) : 0;
  const last = stars.length ? Date.parse(stars[stars.length - 1].starred_at) : 0;
  const count = countAt(stars, time);

  const seek = (t: number, list = stars, along?: number) => {
    setTime(t);
    rope.current?.setCount(countAt(list, t), along);
  };
  const stop = () => {
    cancelAnimationFrame(raf.current);
    setPlaying(false);
  };
  const play = (list = stars) => {
    // Avanza por la soga a velocidad pareja que frena suave hasta parar, no de forma pareja por las
    // fechas: una ráfaga de estrellas ataría docenas de nudos en un cuadro y un mes tranquilo se trabaría.
    const times = list.map((s) => Date.parse(s.starred_at));
    const n = times.length;
    // Seguir desde una repetición en pausa; si no, arrancar REPLAY estrellas antes de la más nueva.
    const mid = time > times[0] && time < times[n - 1];
    const i0 = mid ? Math.max(countAt(list, time) - 1, 0) : Math.max(n - REPLAY, 0);
    const { knots } = ropeLayout(times, n);
    /** La fecha en la que la repetición va `s` diámetros sobre la soga, entre sus dos estrellas. */
    const timeAt = (s: number) => {
      let i = i0;
      while (i < n - 1 && knots[i + 1] <= s) i++;
      if (i === n - 1) return times[i];
      return times[i] + ((times[i + 1] - times[i]) * (s - knots[i])) / (knots[i + 1] - knots[i]);
    };
    const ms = playMs(n - i0);
    const t0 = performance.now();
    setPlaying(true);
    const tick = (now: number) => {
      // El timestamp de rAF puede quedar un poco antes de t0 en el primer cuadro.
      const u = Math.min(Math.max((now - t0) / ms, 0), 1);
      // Arranca rápido (1,6× la velocidad media) y frena suave hasta 0,4× en el nudo más nuevo,
      // donde el propio resorte de la soga la deja quieta.
      const s = knots[i0] + (knots[n - 1] - knots[i0]) * (u + 0.6 * u * (1 - u));
      seek(timeAt(s), list, u < 1 ? s : undefined);
      if (u < 1) raf.current = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    raf.current = requestAnimationFrame(tick);
  };

  useMountEffect(() => {
    markPromptSeen(); // Quien ya está en la página de la soga no necesita que lo empujen hacia ella.
    // La soga ocupa todo el ancho, debajo del panel de intro y arriba de la barra de la línea de tiempo.
    const band = () => ({
      top: intro.current!.getBoundingClientRect().bottom + 8,
      bottom: bar.current!.getBoundingClientRect().top - 8,
    });
    const r = new StarRope(canvas.current!, band);
    rope.current = r;
    fetch(src)
      .then((res) => res.json() as Promise<Feed>)
      .then((feed) => {
        const list = decodeFeed(feed);
        r.setStars(list);
        setStars(list);
        setLoaded(true);
        if (!list.length) return;
        if (matchMedia("(prefers-reduced-motion: reduce)").matches)
          seek(Date.parse(list[list.length - 1].starred_at), list);
        else play(list);
      })
      .catch(() => {});
    return () => {
      cancelAnimationFrame(raf.current);
      r.dispose();
    };
  });

  /** Busca a un stargazer por nombre de usuario (exacto, si no el primero que empiece así) y va a su nudo. */
  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const name = query.trim().replace(/^@/, "").toLowerCase();
    if (!name) return;
    const login = (s: Star) => s.user.login.toLowerCase();
    let index = stars.findIndex((s) => login(s) === name);
    if (index < 0) index = stars.findIndex((s) => login(s).startsWith(name));
    if (index < 0) return setFound("missing");
    stop();
    seek(last, stars); // todos los nudos atados, así el suyo está en la soga
    rope.current?.find(index);
    setFound({ index });
  };

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    return [e.clientX - box.left, e.clientY - box.top] as const;
  };

  // La curva de estrellas acumuladas detrás del scrubber, en una caja de 100×40; se arma una vez,
  // no en cada cuadro.
  const curve = useMemo(
    () =>
      stars
        .map((s, i) => {
          const x = ((Date.parse(s.starred_at) - first) / (last - first || 1)) * 100;
          return `${x.toFixed(2)},${(40 - ((i + 1) / stars.length) * 36).toFixed(2)}`;
        })
        .join(" "),
    [stars, first, last],
  );
  const playedPct = ((time - first) / (last - first || 1)) * 100;
  const latest = stars.slice(Math.max(count - 5, 0), count).reverse();
  // El próximo número redondo a alcanzar, y cuánto se avanzó desde el anterior.
  const goal = MILESTONES.find((m) => m > count) ?? count + 1;
  const prev = [...MILESTONES].reverse().find((m) => m <= count) ?? 0;
  const progress = ((count - prev) / (goal - prev)) * 100;
  // Estrellas de la semana hasta la más nueva (no según el reloj, así la página se renderiza igual en todos lados).
  const thisWeek = stars.filter((s) => last - Date.parse(s.starred_at) < WEEK).length;
  const hit = found && found !== "missing" ? stars[found.index] : null;

  return (
    <>
      <canvas
        ref={canvas}
        className={styles.canvas}
        role="img"
        aria-label={`Una soga con ${count} nudos, uno por cada estrella en GitHub, en orden de fecha`}
        onPointerMove={(e) => {
          const [x, y] = point(e);
          const star = rope.current?.pick(x, y);
          setHover(star ? { star, x: e.clientX, y: e.clientY } : null);
          setOnSlot(!star && !!rope.current?.overSlot(x, y));
        }}
        onPointerLeave={() => {
          rope.current?.pick(-1e9, -1e9);
          setHover(null);
          setOnSlot(false);
        }}
        onClick={() => {
          if (rope.current?.swiped) return;
          if (hover) window.open(hover.star.user.html_url, "_blank", "noopener");
          else if (onSlot) window.open(repoUrl, "_blank", "noopener");
        }}
        style={{ cursor: hover || onSlot ? "pointer" : "grab" }}
      />
      {hover && (
        <div className={styles.tip} style={{ left: hover.x, top: hover.y }}>
          <strong>@{hover.star.user.login}</strong>
          <span>{knotLine(hover.star)}</span>
          <span>dio su estrella el {day(hover.star.starred_at)}</span>
        </div>
      )}

      <section ref={intro} className={styles.hud}>
        <p className={styles.eyebrow}>Soga de estrellas</p>
        <h1 className={styles.total}>
          <strong>{loaded ? count.toLocaleString() : "…"}</strong>{" "}
          {count === 1 ? "nudo atado" : "nudos atados"}
        </h1>
        <div
          className={styles.goal}
          role="progressbar"
          aria-label={`Próxima meta: ${goal.toLocaleString()} nudos`}
          aria-valuemin={prev}
          aria-valuemax={goal}
          aria-valuenow={count}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <p className={styles.goalText}>
          <span>
            {goal - count === 1 ? "Falta" : "Faltan"} {(goal - count).toLocaleString()}
          </span>
          <span>🏁 {goal.toLocaleString()}</span>
        </p>

        {latest.length > 0 && (
          <div className={styles.faces} aria-label="Últimas estrellas">
            {latest.map((s) => (
              <img key={s.user.login} src={avatar(s, 48)} alt={`@${s.user.login}`} />
            ))}
            {thisWeek > 0 && thisWeek < count && (
              <span className={styles.chip}>+{thisWeek} esta semana</span>
            )}
          </div>
        )}

        <form className={styles.search} onSubmit={search} role="search">
          <SearchIcon />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setFound(null);
            }}
            placeholder="Buscá tu nudo"
            aria-label="Buscá tu nudo por usuario de GitHub"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
          />
        </form>
        {hit && found !== "missing" && found && (
          <div className={styles.badge} aria-live="polite">
            <img src={avatar(hit, 64)} alt="" />
            <strong>#{(found.index + 1).toLocaleString()}</strong>
            <span>
              @{hit.user.login}
              <br />
              {day(hit.starred_at)}
            </span>
            <a className={styles.learn} href={knotPath(knotFor(hit.user.id))}>
              {knotLine(hit)} <b>Aprendelo →</b>
            </a>
          </div>
        )}
        {found === "missing" && (
          <p className={styles.missing} aria-live="polite">
            Todavía no está en la soga. Atá el tuyo ★
          </p>
        )}
      </section>

      <div ref={bar} className={styles.timeline} aria-label="Línea de tiempo de estrellas">
        <button
          type="button"
          className={styles.play}
          disabled={!stars.length}
          aria-pressed={playing}
          aria-label={playing ? "Pausar" : "Volver a ver las estrellas"}
          onClick={() => (playing ? stop() : play())}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <div className={styles.track}>
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
            <clipPath id="played">
              <rect width={Math.max(playedPct, 0)} height="40" />
            </clipPath>
            <polygon className={styles.area} points={`0,40 ${curve} 100,40`} />
            <polygon
              className={styles.areaPlayed}
              points={`0,40 ${curve} 100,40`}
              clipPath="url(#played)"
            />
          </svg>
          <input
            type="range"
            className={styles.scrub}
            min={first}
            max={last}
            value={time}
            disabled={!stars.length}
            aria-label="Fecha"
            aria-valuetext={`${count} estrellas hasta ${month(time)}`}
            onChange={(e) => {
              stop();
              seek(Number(e.target.value));
            }}
          />
        </div>
        <p className={styles.count}>
          <strong>{count} ★</strong>
          <span>{stars.length ? month(time) : loaded ? "Dale la primera estrella" : "…"}</span>
        </p>
        <a className={styles.cta} href={repoUrl} target="_blank" rel="noopener">
          ★ Atá el nudo #{(stars.length + 1).toLocaleString()}
        </a>
      </div>
    </>
  );
}
