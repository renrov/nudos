import { useState } from "react";
import { Link } from "react-router";
import { useMountEffect } from "../../shared/hooks";
import { StarIcon } from "../../shared/ui/icons";
import { type Feed, decodeFeed } from "./feed";
import styles from "./stargazers.module.css";

/**
 * La pastilla que lleva a la soga de estrellas, con lugar para las caras de los últimos tres
 * stargazers, así cargarlas no mueve nada.
 */
export function StargazerLink({
  to,
  src,
  className,
}: {
  to: string;
  src: string;
  className: string;
}) {
  const [faces, setFaces] = useState<string[]>([]);
  useMountEffect(() => {
    let alive = true;
    fetch(src)
      .then((r) => r.json() as Promise<Feed>)
      .then(
        (feed) =>
          alive &&
          setFaces(
            decodeFeed(feed)
              .slice(-3)
              .map((s) => `${s.user.avatar_url}&s=40`),
          ),
      )
      .catch(() => {}); // La pastilla funciona sin caras.
    return () => {
      alive = false;
    };
  });
  return (
    <Link className={className} to={to}>
      <StarIcon />
      <span className={styles.rope}>Soga de estrellas</span>
      <span className={styles.ropeShort}>Estrellas</span>
      <span className={styles.pillFaces} aria-hidden="true">
        {[0, 1, 2].map((i) =>
          faces[i] ? (
            <img key={faces[i]} src={faces[i]} alt="" width={20} height={20} />
          ) : (
            <i key={i} />
          ),
        )}
      </span>
    </Link>
  );
}
