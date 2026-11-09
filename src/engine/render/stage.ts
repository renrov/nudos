import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { Prop } from "../knots/types";

const BACKGROUND = "#e8eaee";
const RESET_TIME = 400; // ms que tarda la cámara en volver suave a la vista predeterminada
/** Dónde está la luz principal; la soga también calcula con ella el oscurecimiento de contacto. */
export const KEY_LIGHT = new THREE.Vector3(-0.6, 1.6, 0.9);

/** Un prop fijo, dibujado con el mismo eje y radio con los que colisiona la simulación. */
export function createPropMesh({ kind, a, b, radius }: Prop): THREE.Mesh {
  const axis = new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
  const length = axis.length();
  const mesh = new THREE.Mesh(
    kind === "capsule"
      ? new THREE.CapsuleGeometry(radius, length, 8, 24)
      : new THREE.CylinderGeometry(radius, radius, length, 32),
    new THREE.MeshStandardMaterial({ color: "#a7abb2", roughness: 0.45, metalness: 0.6 }),
  );
  mesh.position.set(...a).addScaledVector(axis, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Renderer, cámara y una mesa con luz suave para que apoye la soga. */
export function createStage(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND);
  scene.fog = new THREE.Fog(BACKGROUND, 2.2, 4.5);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;

  const key = new THREE.DirectionalLight("#fff4e8", 2.6);
  key.position.copy(KEY_LIGHT);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 5;
  key.shadow.intensity = 0.65; // la luz de relleno y la del ambiente llegan a la sombra; las sombras a plena intensidad se ven demasiado pesadas
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.002;
  Object.assign(key.shadow.camera, {
    left: -0.8,
    right: 0.8,
    top: 0.8,
    bottom: -0.8,
    near: 0.5,
    far: 3.5,
  });
  scene.add(key);
  // Relleno débil desde abajo y alrededor, así las sombras se leen como un azul grisáceo suave,
  // nunca negras.
  scene.add(new THREE.HemisphereLight("#f6f8fb", "#8691a6", 0.35));

  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.MeshStandardMaterial({ color: "#dfe2e7", roughness: 0.95 }),
  );
  table.rotation.x = -Math.PI / 2;
  table.receiveShadow = true;
  scene.add(table);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
  camera.position.set(0.02, 1.15, 0.69); // unos 60° por encima de la mesa
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0.02, 0.02, 0.04);
  controls.enableDamping = true;
  controls.minDistance = 0.25;
  controls.maxDistance = 2.5;
  controls.maxPolarAngle = Math.PI * 0.47; // quedarse por encima de la mesa
  controls.update();
  controls.saveState(); // la vista predeterminada a la que vuelve resetView

  const viewListeners = new Set<() => void>();
  const notifyView = () => viewListeners.forEach((l) => l());
  controls.addEventListener("change", notifyView);
  // Los handlers del puntero mueven la cámara con su propio update(), así que el update() del loop
  // puede devolver false después de un paso de arrastre; el evento change atrapa esos casos.
  let viewMoved = false;
  controls.addEventListener("change", () => (viewMoved = true));
  const isDefaultView = () =>
    camera.position.distanceTo(controls.position0) < 1e-3 &&
    controls.target.distanceTo(controls.target0) < 1e-3;

  // Un reset va suave desde donde está la vista hasta la predeterminada a lo largo de RESET_TIME.
  let reset: { from: THREE.Vector3; target: THREE.Vector3; start: number } | null = null;
  const stepReset = (now: number) => {
    if (!reset) return false;
    const u = Math.min((now - reset.start) / RESET_TIME, 1);
    const e = u * u * (3 - 2 * u);
    camera.position.lerpVectors(reset.from, controls.position0, e);
    controls.target.lerpVectors(reset.target, controls.target0, e);
    if (u === 1) {
      reset = null;
      controls.reset(); // llega exacto y descarta cualquier inercia de arrastre que quede
    }
    notifyView();
    return true;
  };

  // Cambiar el tamaño limpia el canvas, así que el próximo cuadro tiene que dibujar.
  let resized = true;
  const resize = () => {
    resized = true;
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Mantener toda la soga a la vista en pantallas angostas.
    camera.fov = w / h < 1 ? 30 / Math.max(0.55, w / h) : 30;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  // Un contexto restaurado arranca en blanco; si no, un nudo en pausa quedaría así.
  const restored = () => (resized = true);
  canvas.addEventListener("webglcontextrestored", restored);

  return {
    renderer,
    scene,
    camera,
    controls,
    /**
     * Dibuja un cuadro si cambió la escena o si la vista se movió, está volviendo o cambió de tamaño;
     * devuelve si dibujó. Dejá afuera `sceneChanged` para dibujar todos los cuadros.
     */
    render(now: number, sceneChanged = true) {
      const easing = stepReset(now);
      const moved = controls.update(); // también lleva la inercia del damping después de un arrastre
      if (!sceneChanged && !easing && !moved && !viewMoved && !resized) return false;
      viewMoved = resized = false;
      renderer.render(scene, camera);
      return true;
    },
    /** Lleva la cámara suave de vuelta a la vista predeterminada; salta si el movimiento está reducido. */
    resetView(now: number, instant = false) {
      // Gastar ya cualquier inercia de arrastre: con el damping activado, sacaría a la cámara de la
      // vista predeterminada después de que llega el reset (un update sin damping la aplica y la limpia).
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = true;
      if (instant) {
        reset = null;
        controls.reset();
      } else reset = { from: camera.position.clone(), target: controls.target.clone(), start: now };
    },
    isDefaultView,
    /** Llama a `listener` cada vez que se mueve la cámara; devuelve una función para desuscribirse. */
    onViewChange(listener: () => void) {
      viewListeners.add(listener);
      return () => viewListeners.delete(listener);
    },
    dispose() {
      observer.disconnect();
      canvas.removeEventListener("webglcontextrestored", restored);
      controls.dispose();
      table.geometry.dispose();
      table.material.dispose();
      scene.environment?.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}

export type Stage = ReturnType<typeof createStage>;
