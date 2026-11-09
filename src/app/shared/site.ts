/**
 * Dónde se publica el sitio, sin barra final, para los links absolutos en las vistas previas; el
 * único lugar donde vive la dirección. Si lo movés a otro dominio o subcarpeta, cambiá también
 * BASE_PATH en el workflow de GitHub Pages.
 */
export const SITE_URL = "https://renrov.github.io/nudos";
export const SITE_NAME = "Nudos sin vueltas";
export const SITE_DESCRIPTION =
  "Mirá cómo se atan los nudos, paso a paso, con una soga simulada con física de verdad.";

/** La página de un nudo, por su `slug`; la barra final coincide con el <slug>/index.html prerenderizado. */
export const knotPath = ({ slug }: { slug: string }) => `/${encodeURIComponent(slug)}/`;
/**
 * La imagen del estado terminado de un nudo: la vista previa para compartir y la tarjeta del
 * selector. La hace `pnpm thumbs`.
 */
export const knotImagePath = (id: string) => `/og/${encodeURIComponent(id)}.jpg`;
/**
 * Un archivo de public/ (`/og/x.jpg`) con la subcarpeta del sitio adelante, para usarlo en el
 * navegador. Los links entre páginas no lo necesitan: React Router ya suma el basename.
 */
export function assetUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}
export const REPO_URL = "https://github.com/renrov/nudos";
export const STARGAZERS_PATH = "/estrellas/";
/**
 * Las estrellas de la soga de estrellas, que escribe tools/stargazers.mjs; el servidor de
 * desarrollo muestra estrellas de prueba.
 */
export const STARGAZERS_DATA = import.meta.env.DEV
  ? "/tools/stargazers.mock.json"
  : assetUrl("/stargazers.json");
/** Una ruta del sitio (`/as-de-guia/`) o un archivo de public/ como dirección completa. */
export const absoluteUrl = (path: string) => `${SITE_URL}${path}`;
