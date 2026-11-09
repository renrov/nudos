import { existsSync } from "node:fs";
import { copyFile, cp, rm } from "node:fs/promises";
import type { Config } from "@react-router/dev/config";
import { knots } from "./src/engine/knots";
import { STARGAZERS_PATH, knotPath } from "./src/app/shared/site";

export default {
  appDirectory: "src/app",
  // La misma subcarpeta que la `base` de vite.config.ts (ver ahí).
  basename: process.env.BASE_PATH ?? "/",
  // Un sitio estático: cada página de nudo se prerenderiza a HTML y después corre como app del lado del cliente.
  ssr: false,
  prerender: ["/", STARGAZERS_PATH, ...knots.map(knotPath)],
  async buildEnd({ reactRouterConfig: { buildDirectory, basename } }) {
    const client = `${buildDirectory}/client`;
    // Los hosts sirven 404.html para las rutas desconocidas; después el shell de la SPA muestra la
    // página de no encontrado. Con la home prerenderizada en la raíz, el shell va a
    // __spa-fallback.html; con una subcarpeta, a index.html.
    const spa = existsSync(`${client}/__spa-fallback.html`) ? "__spa-fallback.html" : "index.html";
    await copyFile(`${client}/${spa}`, `${client}/404.html`);
    // Con una subcarpeta, React Router escribe las páginas en client/<subcarpeta>/, pero el host ya
    // publica client/ en esa subcarpeta: van a la raíz de client/, junto a los assets.
    if (basename !== "/") {
      await cp(`${client}${basename}`, client, { recursive: true });
      await rm(`${client}${basename}`, { recursive: true });
    }
  },
} satisfies Config;
