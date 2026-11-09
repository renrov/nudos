// Fotografía el estado terminado de cada nudo: public/og/<id>.jpg, 1200×630, que se usa como vista
// previa para compartir (og:image) y como tarjeta del selector. Necesita el servidor de desarrollo:
// `pnpm dev`, después `pnpm thumbs` (o `pnpm thumbs http://localhost:5177`; `--knot=<id>`
// fotografía un solo nudo, `--headed` muestra el navegador). Volvé a correrlo después de agregar un
// nudo o de cambiar cómo termina uno.
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}`))?.split("=")[1] ?? false;
const base = args.find((a) => !a.startsWith("--")) ?? "http://localhost:5173";
const only = flag("knot"); // --knot=<id>: fotografiar solo ese nudo
const headed = args.includes("--headed"); // mirar cómo dibuja el navegador
const out = new URL("../public/og/", import.meta.url);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: !headed });
// El bakeo corre en una ventana chica, que Chromium headless dibuja rápido por software; la foto se
// saca en una grande (la escala de la escena sigue a la altura de la ventana), recortada a 600×315
// alrededor del nudo a 2× píxeles: el tamaño de Open Graph de 1200×630. El renderer limita su pixel ratio a 2.
const SMALL = { width: 400, height: 300 };
const BIG = { width: 1200, height: 900 };
// Nudos demasiado largos para ese recorte: recortar esta cantidad de veces más ancho y más alto con
// menos píxeles por punto, así la imagen sigue siendo de 1200×630.
const WIDE = { "daisy-chain": 1.6 };
const index = await browser.newPage({ viewport: SMALL });
await index.goto(base);
// Las tarjetas del selector enlazan a /<slug>/ y muestran /og/<id>.jpg: de ahí salen la
// página de cada nudo y el nombre de su imagen.
const cards = await index.$$eval("dialog li a", (links) =>
  links.map((a) => ({
    href: new URL(a.href).pathname,
    id: decodeURIComponent(
      a
        .querySelector("img")
        .getAttribute("src")
        .split("/")
        .pop()
        .replace(/\.jpg$/, ""),
    ),
  })),
);

await index.close();

for (const { id, href } of cards.filter((c) => !only || c.id === only)) {
  const k = WIDE[id] ?? 1;
  const [W, H] = [600 * k, 315 * k];
  const big = { width: BIG.width * k, height: BIG.height }; // más ancha, misma escala: sigue a la altura
  const page = await browser.newPage({ viewport: SMALL, deviceScaleFactor: 2 / k });
  await page.goto(`${base}${href}`);
  await page.waitForSelector("[data-baked=true]", { timeout: 120_000 });
  // Saltar al final; la reproducción se detiene ahí, así el nudo terminado se queda quieto.
  await page.focus("input[aria-label='Línea de tiempo']");
  await page.keyboard.press("End");
  // El canvas está adentro del layout de la página, así que hay que ocultar todo lo demás y volver
  // a mostrar el canvas.
  await page.addStyleTag({
    content: "body * { visibility: hidden !important; } canvas { visibility: visible !important; }",
  });
  await page.setViewportSize(big);
  await page.waitForTimeout(2000);
  // Centrar el recorte en el nudo: la columna y la fila con más soga.
  const shot = (await page.screenshot({ timeout: 120_000 })).toString("base64");
  const [cx, cy, right] = await page.evaluate(
    async ([png, across]) => {
      const img = await createImageBitmap(
        await (await fetch(`data:image/png;base64,${png}`)).blob(),
      );
      const ctx = new OffscreenCanvas(img.width, img.height).getContext("2d");
      ctx.drawImage(img, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);
      const bg = [data[0], data[1], data[2]];
      const cols = new Float64Array(width);
      const rows = new Float64Array(height);
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const d =
            Math.abs(data[i] - bg[0]) +
            Math.abs(data[i + 1] - bg[1]) +
            Math.abs(data[i + 2] - bg[2]);
          if (d > 60) {
            cols[x]++;
            rows[y]++;
          }
        }
      // Suavizar a lo largo de más o menos el ancho de un nudo, así un solo tramo grueso no gana.
      const peak = (a, r) => {
        let best = 0,
          at = 0;
        for (let i = 0; i < a.length; i++) {
          let s = 0;
          for (let j = Math.max(0, i - r); j < Math.min(a.length, i + r); j++) s += a[j];
          if (s > best) {
            best = s;
            at = i;
          }
        }
        return at;
      };
      const last = cols.findLastIndex((n) => n > 0);
      return [
        peak(cols, across) / devicePixelRatio,
        peak(rows, 160) / devicePixelRatio,
        last / devicePixelRatio,
      ];
    },
    [shot, k === 1 ? 160 : (0.4 * W * 2) / k],
  ); // un nudo ancho: el tramo del ancho del recorte con más soga
  let x = Math.min(Math.max(cx - W / 2, 0), big.width - W);
  // Una soga que termina dentro de la imagen (un bucle, una cola) no se puede cortar: correr a la
  // derecha para que entre, pero dejando el nudo adentro.
  // Un nudo ancho queda centrado en cambio: su cola larga puede salirse del borde.
  if (right < big.width - 1 && k === 1)
    x = Math.min(Math.max(x, right + 20 - W), cx - 100, big.width - W);
  const y = Math.min(Math.max(cy - H / 2, 0), big.height - H);
  const path = new URL(`${id}.jpg`, out).pathname;
  await page.screenshot({
    path,
    type: "jpeg",
    quality: 80,
    clip: { x, y, width: W, height: H },
    timeout: 120_000,
  });
  console.log(path);
  await page.close();
}
await browser.close();
