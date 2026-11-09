import { copyFile } from "node:fs/promises";
import type { Config } from "@react-router/dev/config";
import { knots } from "./src/engine/knots";
import { STARGAZERS_PATH, knotPath } from "./src/app/shared/site";

export default {
  appDirectory: "src/app",
  // Un sitio estático: cada página de nudo se prerenderiza a HTML y después corre como app del lado del cliente.
  ssr: false,
  prerender: ["/", STARGAZERS_PATH, ...knots.map(knotPath)],
  async buildEnd({ reactRouterConfig: { buildDirectory } }) {
    // Los hosts sirven 404.html para las rutas desconocidas; después el shell de la SPA muestra la
    // página de no encontrado.
    await copyFile(
      `${buildDirectory}/client/__spa-fallback.html`,
      `${buildDirectory}/client/404.html`,
    );
  },
} satisfies Config;
