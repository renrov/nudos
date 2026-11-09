import { useEffect, useSyncExternalStore } from "react";

/**
 * Corre `effect` una vez después del montaje, con su limpieza al desmontar. El único effect
 * permitido: para arrancar y frenar cosas por fuera de React (un visor WebGL, un worker, un
 * listener del documento).
 * Volvé a montar con una `key` para empezar de nuevo, en lugar de agregar dependencias.
 */
// eslint-disable-next-line react-hooks/exhaustive-deps
export const useMountEffect = (effect: () => void | (() => void)) => useEffect(effect, []);

const noop = () => () => {};
/** False mientras se prerenderiza e hidrata, true después; para las partes que solo existen en el navegador. */
export const useIsClient = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
