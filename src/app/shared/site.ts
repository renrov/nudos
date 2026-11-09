/**
 * El origen público del sitio, para los links absolutos en las vistas previas; el único lugar donde
 * vive el dominio. Cambialo por el dominio propio cuando esté conectado en Cloudflare.
 */
export const SITE_URL = "https://knots-made-easy.pages.dev";
export const SITE_NAME = "Nudos sin vueltas";
export const SITE_DESCRIPTION =
  "Mirá cómo se atan los nudos, paso a paso, con una soga simulada con física de verdad.";

/** La página de un nudo, por su `slug`; la barra final coincide con el nudos/<slug>/index.html prerenderizado. */
export const knotPath = ({ slug }: { slug: string }) => `/nudos/${encodeURIComponent(slug)}/`;
/**
 * La imagen del estado terminado de un nudo: la vista previa para compartir y la tarjeta del
 * selector. La hace `pnpm thumbs`.
 */
export const knotImagePath = (id: string) => `/og/${encodeURIComponent(id)}.jpg`;
export const REPO_URL = "https://github.com/renrov/nudos";
export const STARGAZERS_PATH = "/estrellas/";
/**
 * Las estrellas de la soga de estrellas, que escribe tools/stargazers.mjs; el servidor de
 * desarrollo muestra estrellas de prueba.
 */
export const STARGAZERS_DATA = import.meta.env.DEV
  ? "/tools/stargazers.mock.json"
  : "/stargazers.json";
export const absoluteUrl = (path: string) => new URL(path, SITE_URL).href;
