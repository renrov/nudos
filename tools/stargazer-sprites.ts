// Renderiza las imágenes de la soga de estrellas con la soga real: una tira recta que se repite a
// lo largo de la soga, la punta de la soga y cada nudo de una sola soga terminado. Vista de arriba,
// fondo transparente, a PX píxeles por diámetro de soga. Lo maneja stargazer-sprites.mjs, que
// guarda window.sprites en public/stargazers/.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { figureEight } from "../src/engine/knots/figure-eight";
import { overhand } from "../src/engine/knots/overhand";
import type { KnotDef, RopeDef } from "../src/engine/knots/types";
import { createRopeMaterial } from "../src/engine/render/ropeMaterial";
import { RopeMesh } from "../src/engine/render/ropeMesh";
import { KEY_LIGHT } from "../src/engine/render/stage";
import { type BakeChunk, bake, firstFrame } from "../src/engine/sim/bake";
import { particleCount } from "../src/engine/sim/rope";

const PX = 32; // píxeles por diámetro de soga; la página lee el mismo número
const KNOTS = [overhand, figureEight]; // los nudos de src/app/features/stargazers/layout.ts
const D = (rope: RopeDef) => 2 * rope.radius * 1.08; // diámetro dibujado: el VISUAL_SCALE de ropeMesh

const renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.15;
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(
  new RoomEnvironment(),
  0.04,
).texture;
scene.environmentIntensity = 0.9;
const key = new THREE.DirectionalLight("#fff4e8", 2.6);
key.position.copy(KEY_LIGHT);
scene.add(key, new THREE.HemisphereLight("#fff4e6", "#a8875c", 0.35));
const material = createRopeMaterial("#c39f6a", renderer.capabilities.getMaxAnisotropy());

/**
 * Una imagen vista desde arriba de `w`×`h` diámetros de la soga de `knot` alrededor de `center`,
 * con `axis` (en el xz de la mesa) apuntando a la derecha.
 */
function shoot(
  knot: KnotDef,
  p: Float32Array,
  nrm: Float32Array,
  center: THREE.Vector3,
  axis: THREE.Vector3,
  w: number,
  h: number,
) {
  const rope = knot.ropes[0];
  const d = D(rope);
  const mesh = new RopeMesh(particleCount(rope), rope, material);
  mesh.update(p, nrm);
  scene.add(mesh);
  renderer.setSize(w * PX, h * PX);
  const camera = new THREE.OrthographicCamera(
    (-w * d) / 2,
    (w * d) / 2,
    (h * d) / 2,
    (-h * d) / 2,
    0.01,
    2,
  );
  camera.up.set(axis.z, 0, -axis.x); // así la derecha de la cámara es `axis`
  camera.position.copy(center).setY(1);
  camera.lookAt(center.x, 0, center.z);
  renderer.render(scene, camera);
  scene.remove(mesh);
  const out = document.createElement("canvas");
  out.width = w * PX;
  out.height = h * PX;
  out.getContext("2d")!.drawImage(renderer.domElement, 0, 0);
  return out;
}

const at = (p: Float32Array, i: number) => new THREE.Vector3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);

// La tira: una cantidad entera de vueltas de los cordones (el LAY de ropeMesh es 7 radios por
// vuelta), así se repite sin cortes.
const straight = firstFrame(overhand);
const R = overhand.ropes[0].radius;
const strip = shoot(
  overhand,
  straight.frames,
  straight.normals,
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(1, 0, 0),
  Math.round((6 * 7 * R) / D(overhand.ropes[0])),
  2,
);

/**
 * Desvanecer la soga de una imagen a lo largo de `left`/`right` diámetros en sus costados, para que
 * se funda con la tira.
 */
function fade(picture: HTMLCanvasElement, w: number, left: number, right: number) {
  const ctx = picture.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, picture.width, 0);
  g.addColorStop(0, left ? "rgba(0,0,0,0)" : "#000");
  g.addColorStop(left / w, "#000");
  g.addColorStop(1 - right / w, "#000");
  g.addColorStop(1, right ? "rgba(0,0,0,0)" : "#000");
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, picture.width, picture.height);
  return picture;
}

/**
 * Gira y desplaza la imagen de un nudo para que la soga que entra por la izquierda y la que sale
 * por la derecha queden las dos sobre su línea media: así la página la puede poner sobre su soga
 * sin escalón de ningún lado.
 * Mide la soga sólida (no su sombra suave) un poco hacia adentro de cada borde.
 */
function level(picture: HTMLCanvasElement) {
  const { width: W, height: H } = picture;
  const x0 = Math.round(PX * 0.6);
  const x1 = W - x0;
  const middle = (c: HTMLCanvasElement, x: number) => {
    const { data } = c.getContext("2d")!.getImageData(x, 0, 1, H);
    let sum = 0;
    let n = 0;
    for (let y = 0; y < H; y++)
      if (data[y * 4 + 3] > 200) {
        sum += y;
        n++;
      }
    return sum / n;
  };
  const draw = (from: HTMLCanvasElement, turn: number, dy: number) => {
    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    const ctx = out.getContext("2d")!;
    ctx.translate(W / 2, H / 2 + dy);
    ctx.rotate(turn);
    ctx.drawImage(from, -W / 2, -H / 2);
    ctx.resetTransform(); // fade() dibuja sobre este contexto después
    return out;
  };
  const level = draw(picture, -Math.atan2(middle(picture, x1) - middle(picture, x0), x1 - x0), 0);
  return draw(level, 0, H / 2 - (middle(level, x0) + middle(level, x1)) / 2);
}

/** La soga de `def` al final de su bakeo, y las partículas que tocan una parte lejana de ella. */
function finished(def: KnotDef) {
  const rope = def.ropes[0];
  const n = particleCount(rope);
  let last: BakeChunk | null = null;
  bake(def, (chunk) => (last = chunk));
  const end = last!.frames.length;
  const p = last!.frames.slice(end - n * 3);
  const nrm = last!.normals.slice(end - n * 3);
  const close: number[] = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      if (Math.abs(i - j) > 8 && at(p, i).distanceTo(at(p, j)) < 2.5 * rope.radius) {
        close.push(i);
        break;
      }
  const d = D(rope);
  const perD = (n - 1) / (rope.length / d); // partículas en un diámetro
  return { rope, n, p, nrm, close, d, perD };
}

/**
 * Un nudo atado en la soga, tendido sobre la línea que pasa por la soga a cada lado, recortado al
 * nudo y a STUB diámetros de soga de cada lado. La soga sigue más allá de los bordes de la imagen,
 * así se desvanece ahí en lugar de cortarse.
 */
const STUB = 2.5;
function inline(def: KnotDef) {
  const { p, nrm, close, d, perD, n } = finished(def);
  const ia = Math.max(close[0] - Math.round(8 * perD), 0);
  const ib = Math.min(close[close.length - 1] + Math.round(8 * perD), n - 1);
  const a = at(p, ia);
  const axis = at(p, ib).sub(a).setY(0).normalize();
  const middle = close
    .reduce((c, i) => c.add(at(p, i)), new THREE.Vector3())
    .divideScalar(close.length);
  // Sobre la línea que pasa por la soga a cada lado, así los cabos quedan alineados con la tira.
  const center = a.clone().addScaledVector(axis, middle.clone().sub(a).dot(axis));
  const body = bounds(p, close[0], close[close.length - 1], center, axis, d, 0);
  const w = body.w + 2 * Math.ceil(STUB);
  const h = body.h + 2;
  return fade(level(shoot(def, p, nrm, center, axis, w, h)), w, 1.5, 1.5);
}

/** El tamaño par más chico en diámetros que contiene las partículas `ia`..`ib` alrededor de `center`, más `pad`. */
function bounds(
  p: Float32Array,
  ia: number,
  ib: number,
  center: THREE.Vector3,
  axis: THREE.Vector3,
  d: number,
  pad: number,
) {
  const side = new THREE.Vector3(-axis.z, 0, axis.x);
  let along = 0;
  let across = 0;
  for (let i = ia; i <= ib; i++) {
    const v = at(p, i).sub(center).setY(0);
    along = Math.max(along, Math.abs(v.dot(axis)));
    across = Math.max(across, Math.abs(v.dot(side)));
  }
  return { w: 2 * Math.ceil(along / d + pad), h: 2 * Math.ceil(across / d + pad) };
}

// La punta de la soga, como la dibuja la página del nudo: casquillo engarzado y cordones cortados.
// La punta de la soga queda a TIP diámetros del borde izquierdo de la imagen; la página lee el mismo número.
const TIP = 5;
const n = particleCount(overhand.ropes[0]);
const endX = straight.frames[(n - 1) * 3];
const tip = shoot(
  overhand,
  straight.frames,
  straight.normals,
  new THREE.Vector3(endX + (6 / 2 - TIP) * D(overhand.ropes[0]), 0, 0),
  new THREE.Vector3(1, 0, 0),
  6,
  3,
);

const pictures = Object.fromEntries(KNOTS.map((k) => [k.id, inline(k)]));
(window as unknown as { sprites: Record<string, string> }).sprites = {
  rope: strip.toDataURL("image/png"),
  tip: fade(tip, 6, 1.5, 0).toDataURL("image/png"),
  ...Object.fromEntries(Object.entries(pictures).map(([id, c]) => [id, c.toDataURL("image/png")])),
};
document.body.append(strip, tip, ...Object.values(pictures));
