import { useState } from "react";
import { useSearchParams } from "react-router";
import { DEFAULT_PHYSICS } from "../../../engine/sim/rope";
import { useIsClient } from "../../shared/hooks";
import { SLIDERS, physicsFromParams, writePhysics } from "./physicsParams";
import styles from "./tuner.module.css";

/**
 * El laboratorio de materiales, que aparece con `?tune` en la URL: un slider por cada constante de
 * la soga. Al soltar un slider se escriben los valores en la URL, lo que vuelve a bakear el nudo y
 * los guarda para compartir.
 */
export function Tuner() {
  const [params, setParams] = useSearchParams();
  // Las páginas prerenderizadas no tienen query string, así que el panel solo existe en el navegador.
  if (!useIsClient() || !params.has("tune")) return null;
  return <TunerPanel initial={physicsFromParams(params)} onApply={apply} />;

  function apply(physics: typeof DEFAULT_PHYSICS) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        writePhysics(next, physics);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }
}

function TunerPanel({
  initial,
  onApply,
}: {
  initial: typeof DEFAULT_PHYSICS;
  onApply: (p: typeof DEFAULT_PHYSICS) => void;
}) {
  const [physics, setPhysics] = useState(initial);
  return (
    <section className={styles.tuner} aria-label="Material de la soga">
      <h2>Material de la soga</h2>
      {SLIDERS.map(({ key, label, min, max, step }) => (
        <label key={key} data-changed={physics[key] !== DEFAULT_PHYSICS[key]}>
          <span>{label}</span>
          <output>{physics[key]}</output>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={physics[key]}
            onChange={(e) => setPhysics({ ...physics, [key]: Number(e.target.value) })}
            onPointerUp={() => onApply(physics)}
            onKeyUp={() => onApply(physics)}
          />
        </label>
      ))}
      <button
        type="button"
        onClick={() => {
          setPhysics(DEFAULT_PHYSICS);
          onApply(DEFAULT_PHYSICS);
        }}
      >
        Restablecer valores
      </button>
    </section>
  );
}
