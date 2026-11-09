import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

// Vitest corre los tests del motor y de los componentes sin el plugin de build de React Router.
// BASE_PATH es la subcarpeta donde se publica el sitio (GitHub Pages usa /nudos/); por defecto la
// raíz, que es lo que usan `pnpm dev`, los tests y `pnpm preview`. Tiene que coincidir con el
// basename de react-router.config.ts.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [!process.env.VITEST && reactRouter()],
});
