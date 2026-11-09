import { describe, expect, test } from "vitest";
import { Player } from "./player";

const steps = [
  { t: 0, title: "a" },
  { t: 1, title: "b" },
  { t: 2, title: "c" },
];
const make = (autoplay = true) => {
  const p = new Player(steps, 3);
  if (autoplay) p.play();
  p.setReady(3);
  return p;
};

describe("Player", () => {
  test("reproduce a su velocidad y sigue el paso", () => {
    const p = make();
    p.setSpeed(2);
    p.tick(0.6);
    expect(p.getSnapshot()).toMatchObject({ time: 1.2, step: 1 });
  });

  test("ignora un paso de tiempo negativo", () => {
    const p = make();
    p.tick(-0.9);
    expect(p.getSnapshot().time).toBe(0);
  });

  test("espera en el borde de lo que está bakeado", () => {
    const p = make();
    p.setReady(0.5);
    p.tick(2);
    expect(p.getSnapshot()).toMatchObject({ time: 0.5, playing: true });
  });

  test("se detiene al final, y reproducir vuelve a empezar", () => {
    const p = make();
    p.tick(5);
    expect(p.getSnapshot()).toMatchObject({ time: 3, playing: false });
    p.togglePlay();
    expect(p.getSnapshot()).toMatchObject({ time: 0, playing: true });
  });

  test("repite después de mostrar un rato el nudo terminado", () => {
    const p = make();
    p.toggleLoop();
    p.tick(3.5);
    expect(p.getSnapshot()).toMatchObject({ time: 3.5, playing: true });
    p.tick(1);
    expect(p.getSnapshot()).toMatchObject({ time: 0, playing: true });
  });

  test("avanza y retrocede de a pasos y se limita en los extremos", () => {
    const p = make(false);
    p.stepBy(1);
    p.stepBy(1);
    p.stepBy(1);
    expect(p.getSnapshot()).toMatchObject({ time: 2, step: 2 });
    p.stepBy(-5);
    expect(p.getSnapshot()).toMatchObject({ time: 0, step: 0 });
  });

  test("avisa solo cuando cambia algo, con un snapshot nuevo", () => {
    const p = make(false);
    let calls = 0;
    p.subscribe(() => calls++);
    const before = p.getSnapshot();
    p.tick(1); // en pausa: sin cambios
    p.seek(0); // mismo tiempo
    expect(calls).toBe(0);
    p.seek(1);
    expect(calls).toBe(1);
    expect(p.getSnapshot()).not.toBe(before);
  });
});
