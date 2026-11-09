import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

// Vitest corre los tests del motor y de los componentes sin el plugin de build de React Router.
export default defineConfig({ plugins: [!process.env.VITEST && reactRouter()] });
