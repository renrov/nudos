import { useState } from "react";
import { SITE_NAME, absoluteUrl } from "../../shared/site";
import { CheckIcon, ShareIcon } from "../../shared/ui/icons";
import styles from "./player.module.css";

/**
 * Comparte un link a la página de este nudo: la hoja de compartir del sistema en pantallas
 * táctiles, un link copiado en el resto.
 */
export function ShareButton({ name, path }: { name: string; path: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = absoluteUrl(path);
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({
          title: `${name} · ${SITE_NAME}`,
          text: `${name}, paso a paso`,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Se cerró la hoja de compartir o el portapapeles está bloqueado: no hay nada que hacer.
    }
  }

  return (
    <span className={styles.shareWrap}>
      <button
        type="button"
        className={styles.share}
        aria-label="Compartir este nudo"
        title="Compartir este nudo"
        onClick={share}
      >
        {copied ? <CheckIcon /> : <ShareIcon />}
      </button>
      {copied && (
        <span role="status" className={styles.toast}>
          Link copiado
        </span>
      )}
    </span>
  );
}
