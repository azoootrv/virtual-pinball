import Matter from "matter-js";
import { buildTable, makeBall } from "../src/game/table.ts";

const { Engine, Body, Composite } = Matter;

function launch(power: number): number {
  const engine = Engine.create({ gravity: { x: 0, y: 1.15, scale: 0.0012 }, positionIterations: 16, velocityIterations: 12, enableSleeping: false });
  const table = buildTable(engine.world);
  const spawn = table.launchSpawn;
  const ball = makeBall(spawn.x, spawn.y - 24);
  Composite.add(engine.world, ball);
  const scaled = power ** 1.6;
  Body.setVelocity(ball, { x: 0, y: -5 - scaled * 48 });
  let minY = spawn.y;
  for (let i = 0; i < 240; i += 1) {
    for (let s = 0; s < 6; s += 1) Engine.update(engine, 1000 / 360);
    if (ball.position.y < minY) minY = ball.position.y;
    if (ball.position.y < 100) break;
  }
  return minY;
}

for (const p of [0, 0.5, 1]) {
  const y = launch(p);
  console.log(`power ${p}: peak y = ${y.toFixed(0)}`);
}

function tunnel(): boolean {
  const engine = Engine.create({ gravity: { x: 0, y: 1.15, scale: 0.0012 }, positionIterations: 16, velocityIterations: 12, enableSleeping: false });
  const table = buildTable(engine.world);
  const ball = makeBall(100, 400);
  Composite.add(engine.world, ball);
  Body.setVelocity(ball, { x: 0, y: 38 });
  let tunneled = false;
  for (let i = 0; i < 60; i += 1) {
    for (let s = 0; s < 6; s += 1) Engine.update(engine, 1000 / 360);
    if (ball.position.x > 92 && ball.position.x < 110 && ball.position.y > 830) tunneled = true;
  }
  return tunneled;
}

console.log("tunnel test:", tunnel() ? "FAIL - ball went through wall" : "ok");
