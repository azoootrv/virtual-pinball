import Matter from "matter-js";
import { buildTable, makeBall } from "../src/game/table.ts";

const { Engine, Body, Composite } = Matter;

function drop(sx: number, sy: number): { stuck: number; x: number; y: number } {
  const engine = Engine.create({ gravity: { x: 0, y: 1.15, scale: 0.0012 }, positionIterations: 16, velocityIterations: 12, enableSleeping: false });
  const table = buildTable(engine.world);
  const ball = makeBall(sx, sy);
  Composite.add(engine.world, ball);
  Body.setVelocity(ball, { x: 0, y: 0 });
  let stuck = 0;
  for (let i = 0; i < 200; i += 1) {
    for (let s = 0; s < 3; s += 1) Engine.update(engine, 1000 / 180);
    const sp = Math.hypot(ball.velocity.x, ball.velocity.y);
    if (sp > 14) { const k = 14 / sp; Body.setVelocity(ball, { x: ball.velocity.x * k, y: ball.velocity.y * k }); }
    if (sp < 0.4 && ball.position.y < 1010) stuck += 1;
  }
  return { stuck, x: ball.position.x, y: ball.position.y };
}

for (const [sx, sy] of [[100, 970], [92, 950], [150, 940], [200, 950], [300, 960], [309, 1000]]) {
  const r = drop(sx, sy);
  console.log(`drop at (${sx},${sy}): stuck=${r.stuck} end=(${r.x.toFixed(0)},${r.y.toFixed(0)})`);
}
