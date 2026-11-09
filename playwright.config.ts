import { defineConfig, devices } from "@playwright/test";

// Prueba el build de producción tal como lo sirve Cloudflare Pages: páginas prerenderizadas, links profundos, 404.
// Chromium headless dibuja WebGL por software (unos pocos cuadros por segundo), de ahí la ventana
// chica y los timeouts largos; el movimiento reducido evita que los nudos arranquen solos, así que
// cada test empieza en pausa.
export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  use: { baseURL: "http://localhost:5174", reducedMotion: "reduce" },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 800, height: 600 } },
    },
  ],
  webServer: {
    command: "pnpm build && pnpm preview --port 5174",
    url: "http://localhost:5174",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
