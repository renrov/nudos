// Renderiza un nudo como película, cuadro por cuadro, con la soga real: una cámara guionada,
// subtítulos de los pasos y un título. Lo maneja film.mjs, que pide cada cuadro con
// window.renderFrame(i). El tiempo acá es el reloj propio de la película, no el reloj real, así
// cada cuadro se dibuja exactamente como se pidió.
import * as THREE from "three";
import alegreya from "../src/app/styles/fonts/alegreya-latin-wght-normal.woff2?url";
import archivo from "../src/app/styles/fonts/archivo-latin-wght-normal.woff2?url";
import { SITE_URL } from "../src/app/shared/site";
import { knots } from "../src/engine/knots";
import { Timeline } from "../src/engine/playback/timeline";
import { createRopeMaterial } from "../src/engine/render/ropeMaterial";
import { RopeMesh } from "../src/engine/render/ropeMesh";
import { createPropMesh, createStage } from "../src/engine/render/stage";

const q = new URLSearchParams(location.search);
const knot = knots.find((k) => k.id === q.get("knot"))!;
const W = Number(q.get("w") ?? 1920);
const H = Number(q.get("h") ?? 1080);
const FPS = Number(q.get("fps") ?? 30);
// Tres cortes: "full" es el tutorial completo con subtítulos de los pasos; "hands" es una pasada
// rápida y sin subtítulos que muestra las manos invisibles haciendo los tirones (la soga está
// simulada, nada tiene keyframes); "cinch" es solo el último tirón, de cerca, para un loop corto y satisfactorio.
const CUT = q.get("cut") ?? "full";
const SPEED = Number(q.get("speed") ?? { full: 1, hands: 1.8, cinch: 1 }[CUT]); // s de simulación por s de película
const LEAD = { full: 0.8, hands: 0.3, cinch: 0.3 }[CUT]!; // segundos de película en la pose inicial
const HOLD = Number(q.get("hold") ?? { full: 3.2, hands: 1.8, cinch: 1.8 }[CUT]); // sobre el nudo terminado

const canvas = document.getElementById("gl") as HTMLCanvasElement;
canvas.style.width = `${W}px`;
canvas.style.height = `${H}px`;
const stage = createStage(canvas);
stage.controls.enabled = false;

const timeline = new Timeline(knot, () => {});
const anisotropy = stage.renderer.capabilities.getMaxAnisotropy();
const materials = new Map<string, THREE.Material>();
const ropes = knot.ropes.map((def, k) => {
  const color = def.color ?? "#c39f6a";
  if (!materials.has(color)) materials.set(color, createRopeMaterial(color, anisotropy));
  const mesh = new RopeMesh(timeline.counts[k], def, materials.get(color)!);
  stage.scene.add(mesh);
  return mesh;
});
for (const prop of knot.props ?? []) stage.scene.add(createPropMesh(prop));

// El corte cinch arranca un momento antes del último tirón; los otros arrancan desde el principio.
const simStart = CUT === "cinch" ? Math.max(0, knot.steps[knot.steps.length - 2].t - 1) : 0;
const tieEnd = LEAD + (timeline.duration - simStart) / SPEED;
const total = tieEnd + HOLD;
const frames = Math.round(total * FPS);

// Keys de cámara: [tiempo de película, azimut°, elevación°, distancia m]. Deriva lenta mientras se
// ata, un acercamiento cuando se ajusta y después una órbita más baja y cercana sobre el nudo terminado.
const keys: [number, number, number, number][] =
  CUT === "cinch"
    ? [
        [0, -14, 37, 0.46],
        [tieEnd, 12, 31, 0.38],
        [total, 24, 28, 0.35],
      ]
    : [
        [0, -22, 36, 0.82],
        [tieEnd * 0.5, 2, 42, 0.68],
        [tieEnd, 12, 39, 0.6],
        [total, 34, 31, 0.55],
      ];
const ramp = (x: number) => Math.min(Math.max(x, 0), 1);
const home = new THREE.Vector3(0.02, 0.02, 0.04); // el corte cinch mueve esto hasta el nudo
const target = home.clone();

/** Dónde la soga terminada es más gruesa: el nudo mismo, sobre el que se acomoda la cámara al final. */
function knotCentre() {
  const p = timeline.sample(timeline.duration).positions;
  const n = p.length / 3;
  let best = 0;
  let bestCount = -1;
  for (let i = 0; i < n; i++) {
    let count = 0;
    for (let j = 0; j < n; j++) {
      const dx = p[3 * i] - p[3 * j];
      const dz = p[3 * i + 2] - p[3 * j + 2];
      if (dx * dx + dz * dz < 0.05 * 0.05) count++;
    }
    if (count > bestCount) [best, bestCount] = [i, count];
  }
  return new THREE.Vector3(p[3 * best], 0.02, p[3 * best + 2]);
}

/**
 * Valor del spline cardinal de la columna de keys `c` en el tiempo de película `t`, así la cámara
 * nunca se frena en una key.
 */
function along(t: number, c: 1 | 2 | 3) {
  let i = 0;
  while (i < keys.length - 2 && t >= keys[i + 1][0]) i++;
  const [t0, ...a] = keys[i];
  const [t1, ...b] = keys[i + 1];
  const slope = (j: number) => {
    const lo = keys[Math.max(j - 1, 0)];
    const hi = keys[Math.min(j + 1, keys.length - 1)];
    const dt = hi[0] - lo[0];
    // Las keys de los extremos entran y salen suave; las del medio llevan la cámara de largo.
    return j === 0 || j === keys.length - 1 ? 0 : (hi[c] - lo[c]) / dt;
  };
  const h = t1 - t0;
  const s = Math.min(Math.max((t - t0) / h, 0), 1);
  const [p0, p1] = [a[c - 1], b[c - 1]];
  const [m0, m1] = [slope(i) * h, slope(i + 1) * h];
  const s2 = s * s;
  const s3 = s2 * s;
  return (
    (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * m1
  );
}

let centre = home;
const smooth = (x: number) => x * x * (3 - 2 * x);

function placeCamera(t: number) {
  // Deriva desde el medio de la mesa hacia el nudo mientras se ajusta y durante el plano de cierre.
  target.lerpVectors(home, centre, smooth(ramp((t - tieEnd * 0.6) / (total - tieEnd * 0.6))));
  const az = (along(t, 1) * Math.PI) / 180;
  const el = (along(t, 2) * Math.PI) / 180;
  const d = along(t, 3);
  stage.camera.position.set(
    target.x + d * Math.sin(az) * Math.cos(el),
    target.y + d * Math.sin(el),
    target.z + d * Math.cos(az) * Math.cos(el),
  );
  stage.camera.lookAt(target);
}

const out = document.createElement("canvas");
out.width = W;
out.height = H;
const ctx = out.getContext("2d")!;
const INK = "#23201c";
const MUTED = "#6d665c";
const ACCENT = "#b9522c";
const FONT = '"Archivo", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
/** Alegreya, la fuente de los textos de lectura del sitio: acá, la instrucción de cada paso. */
const READING = '"Alegreya", Georgia, serif';
// Las fuentes del sitio, cargadas antes del primer cuadro: el canvas no espera a que lleguen.
document.fonts.add(await new FontFace("Archivo", `url(${archivo})`, { weight: "100 900" }).load());
document.fonts.add(
  await new FontFace("Alegreya", `url(${alegreya})`, { weight: "400 900" }).load(),
);

const offsets = knot.ropes.map((_, k) => timeline.counts.slice(0, k).reduce((a, b) => a + b, 0));
const dot = new THREE.Vector3();

/** Un punto suave y brillante en cada punto de la soga que una guía sostiene en `sim`. */
function drawHands(sim: number, positions: Float32Array, u: number) {
  for (const g of knot.guides) {
    const end = g.path[g.path.length - 1].t;
    if (sim < g.grab || sim > end) continue;
    const rope = g.rope ?? 0;
    const i = offsets[rope] + Math.round(g.at * (timeline.counts[rope] - 1));
    dot.set(positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]).project(stage.camera);
    const x = ((dot.x + 1) / 2) * W;
    const y = ((1 - dot.y) / 2) * H;
    // Aparece cuando la mano se cierra y desaparece cuando suelta.
    const alpha = ramp((sim - g.grab) / 0.2) * ramp((end - sim) / 0.3);
    const r = 28 * u;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
    glow.addColorStop(0, `rgba(185,82,44,${0.7 * alpha})`);
    glow.addColorStop(1, "rgba(185,82,44,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
    ctx.strokeStyle = `rgba(255,253,249,${0.95 * alpha})`;
    ctx.lineWidth = 3 * u;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function overlay(v: number, sim: number, positions: Float32Array) {
  // Una viñeta suave lleva la mirada al centro.
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.0);
  g.addColorStop(0, "rgba(70,50,30,0)");
  g.addColorStop(1, "rgba(70,50,30,0.22)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const u = H / 1080;
  const done = v >= tieEnd;
  ctx.textBaseline = "alphabetic";
  if (CUT === "hands") drawHands(sim, positions, u);
  const address = () => {
    ctx.globalAlpha = ramp((v - tieEnd - 0.4) / 0.6);
    ctx.fillStyle = INK;
    ctx.font = `600 ${38 * u}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(SITE_URL.replace(/^https:\/\//, ""), W / 2, H - 70 * u);
    ctx.textAlign = "left";
  };

  if (CUT === "hands") {
    ctx.globalAlpha = ramp((v - 0.1) / 0.4);
    ctx.fillStyle = ACCENT;
    ctx.font = `600 ${22 * u}px ${FONT}`;
    ctx.letterSpacing = `${2.2 * u}px`;
    ctx.fillText(`${knot.name.toUpperCase()} · SOGA SIMULADA`, 72 * u, 96 * u);
    ctx.letterSpacing = "0px";
    ctx.fillStyle = INK;
    ctx.font = `650 ${84 * u}px ${FONT}`;
    ctx.fillText("Sin keyframes.", 72 * u, 186 * u);
    ctx.fillStyle = MUTED;
    ctx.font = `500 ${34 * u}px ${FONT}`;
    ctx.fillText("Unas manos invisibles tiran. La física hace el resto.", 72 * u, 236 * u);
    ctx.globalAlpha = 1;
    if (done) address();
  } else if (CUT === "cinch") {
    ctx.globalAlpha = ramp((v - 0.1) / 0.4);
    ctx.fillStyle = INK;
    ctx.font = `650 ${44 * u}px ${FONT}`;
    ctx.fillText(knot.name, 72 * u, H - 72 * u);
    ctx.globalAlpha = 1;
    if (done) address();
  } else {
    // Título, arriba a la izquierda.
    ctx.globalAlpha = ramp((v - 0.2) / 0.7);
    ctx.fillStyle = ACCENT;
    ctx.font = `600 ${22 * u}px ${FONT}`;
    ctx.letterSpacing = `${2.2 * u}px`;
    ctx.fillText("NUDOS SIN VUELTAS", 72 * u, 96 * u);
    ctx.letterSpacing = "0px";
    ctx.fillStyle = INK;
    ctx.font = `650 ${72 * u}px ${FONT}`;
    ctx.fillText(knot.name, 72 * u, 176 * u);

    // El paso que se está atando, abajo al centro; la dirección lo reemplaza sobre el nudo terminado.
    ctx.textAlign = "center";
    const steps = knot.steps;
    let i = 0;
    while (i < steps.length - 1 && sim >= steps[i + 1].t) i++;
    if (!done) {
      const next = steps[i + 1]?.t ?? Infinity;
      ctx.globalAlpha = ramp((sim - steps[i].t + 0.3) / 0.4) * ramp((next - sim) / 0.3 + 0.1);
      ctx.fillStyle = MUTED;
      ctx.font = `600 ${24 * u}px ${FONT}`;
      ctx.fillText(`${i + 1} / ${steps.length}`, W / 2, H - 120 * u);
      ctx.fillStyle = INK;
      ctx.font = `560 ${44 * u}px ${READING}`;
      ctx.fillText(steps[i].title, W / 2, H - 70 * u);
    } else address();
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }
}

while (timeline.ready < timeline.duration) await new Promise((r) => setTimeout(r, 100));
centre = knotCentre();
if (CUT === "cinch") home.copy(centre); // de cerca desde el primer cuadro

Object.assign(window, {
  film: { frames, fps: FPS, seconds: total },
  renderFrame(i: number) {
    const v = i / FPS;
    const sim = Math.min(simStart + Math.max((v - LEAD) * SPEED, 0), timeline.duration);
    const { positions, normals } = timeline.sample(sim);
    let o = 0;
    ropes.forEach((rope, k) => {
      const end = o + timeline.counts[k] * 3;
      rope.update(positions.subarray(o, end), normals.subarray(o, end));
      o = end;
    });
    placeCamera(v);
    stage.renderer.render(stage.scene, stage.camera);
    ctx.globalAlpha = 1; // un fundido que quedó del último cuadro lo mezclaría con este
    ctx.drawImage(canvas, 0, 0, W, H);
    overlay(v, sim, positions);
    return out.toDataURL("image/jpeg", 0.96);
  },
});
