import Matter from "matter-js";
import { buildTable, makeBall } from "../src/game/table.ts";

const { Engine, Body, Composite } = Matter;

function dropInlane(sx: number): { stuck: number; x: number; y: number } {
  const engine = Engine.create({ gravity: { x: 0, y: 1.15, scale: 0.0012 }, positionIterations: 16, velocityIterations: 12, enableSleeping: false });
  const table = buildTable(engine.world);
  const ball = makeBall(sx, 940);
  Composite.add(engine.world, ball);
  Body.setVelocity(ball, { x: 0, y: 0 });
  let stuck = 0;
  for (let i = 0; i < 200; i += 1) {
    for (let s = 0; s < 3; s += 1) Engine.update(engine, 1000 / 180);
    const sp = Math.hypot(ball.velocity.x, ball.velocity.y);
    if (sp > 14) { const k = 14 / sp; Body.setVelocity(ball, { x: ball.velocity.x * k, y: ball.velocity.y * k }); }
    if (sp < 0.4 && ball.position.y < 1000) stuck += 1;
  }
  return { stuck, x: ball.position.x, y: ball.position.y };
}

for (const sx of [230, 235, 240]) {
  const r = dropInlane(sx);
  console.log(`inlane drop at x=${sx}: stuck=${r.stuck} end=(${r.x.toFixed(0)},${r.y.toFixed(0)})`);
}
