// Guarda las imágenes de la soga de estrellas (tira de soga real, punta de la soga, cada nudo
// terminado) en public/stargazers/. Correr: node tools/stargazer-sprites.mjs. Volver a correrlo
// después de cambiar cómo se ve la soga.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const out = new URL("../public/stargazers/", import.meta.url);
mkdirSync(out, { recursive: true });
const server = await createServer({
  root: new URL(".", import.meta.url).pathname,
  server: { port: 5179 },
});
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => console.error(e));
await page.goto("http://localhost:5179/stargazer-sprites.html", { waitUntil: "commit" }); // los bakeos bloquean "load"
const sprites = await (
  await page.waitForFunction(() => window.sprites, null, { timeout: 600_000 })
).jsonValue();
for (const [name, url] of Object.entries(sprites)) {
  const path = new URL(`${name}.png`, out).pathname;
  writeFileSync(path, Buffer.from(url.split(",")[1], "base64"));
  console.log(path);
}
await browser.close();
await server.close();
