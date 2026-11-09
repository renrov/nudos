// Renderiza nudos como películas MP4 para compartir: videos/<id>.mp4. Soga real, cámara guionada,
// subtítulos de los pasos.
// Correr: node tools/film.mjs bowline zeppelin   (o --all)
// --cut=full|hands|cinch|all (sirve una lista con comas; por defecto full).
// Opciones: --size=1920x1080  --fps=30  --speed=1 (velocidad de atado)  --hold=3.2 (segundos sobre el nudo terminado)  --headless (GL por software: lento).
// Necesita Google Chrome para dibujar rápido con la GPU, y macOS para codificar.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const args = process.argv.slice(2);
const flag = (name, fallback) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const [W, H] = flag("size", "1920x1080").split("x").map(Number);
const fps = Number(flag("fps", 30));
const speed = flag("speed", ""); // "" = el ritmo propio de cada corte
const hold = flag("hold", "");
// full: el tutorial con subtítulos; hands: rápido, muestra las manos invisibles; cinch: el último tirón, de cerca.
const cuts = flag("cut", "full").replace("all", "full,hands,cinch").split(",");
const headless = args.includes("--headless");
const root = new URL(".", import.meta.url).pathname;
const outDir = `${root}out/film/`; // cuadros y el codificador, se descartan
const videoDir = `${root}../videos/`; // los MP4 terminados (ignorados por git)
mkdirSync(outDir, { recursive: true });
mkdirSync(videoDir, { recursive: true });

const server = await createServer({ root, server: { port: 5180 } });
await server.listen();
const browser = await chromium
  .launch({ channel: headless ? undefined : "chrome", headless })
  .catch(() => chromium.launch({ headless }));
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.error(e));

let ids = args.filter((a) => !a.startsWith("--"));
if (args.includes("--all") || !ids.length) {
  const { knots } = await server.ssrLoadModule("/../src/engine/knots/index.ts");
  ids = knots.map((k) => k.id);
}

const encoder = `${outDir}encode-video`;
if (!existsSync(encoder))
  execFileSync("swiftc", ["-O", `${root}encode-video.swift`, "-o", encoder], { stdio: "inherit" });

for (const [id, cut] of ids.flatMap((id) => cuts.map((cut) => [id, cut]))) {
  const name = cut === "full" ? id : `${id}-${cut}`;
  const extra = (speed && `&speed=${speed}`) + (hold && `&hold=${hold}`);
  const url = `http://localhost:5180/film.html?knot=${id}&cut=${cut}&w=${W}&h=${H}&fps=${fps}${extra}`;
  await page.goto(url, { waitUntil: "commit" }); // el bakeo bloquea "load"
  const film = await (
    await page.waitForFunction(() => window.film, null, { timeout: 600_000 })
  ).jsonValue();
  const frames = `${outDir}${name}-frames/`;
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames, { recursive: true });
  for (let i = 0; i < film.frames; i++) {
    const data = await page.evaluate((n) => window.renderFrame(n), i);
    writeFileSync(
      `${frames}${String(i).padStart(5, "0")}.jpg`,
      Buffer.from(data.split(",")[1], "base64"),
    );
    if (i % 60 === 0) console.log(`${name}: cuadro ${i}/${film.frames}`);
  }
  const mp4 = `${videoDir}${name}.mp4`;
  execFileSync(encoder, [frames, String(fps), mp4], { stdio: "inherit" });
  if (!args.includes("--keep")) rmSync(frames, { recursive: true, force: true }); // --keep: para mirar los cuadros
  console.log(mp4, `(${film.seconds.toFixed(1)} s)`);
}
await browser.close();
await server.close();
