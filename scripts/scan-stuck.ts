import Matter from "matter-js";
import { buildTable, makeBall } from "../src/game/table.ts";

const { Engine, Body, Composite } = Matter;

function test(x, y, vx = 0, vy = 0) {
  const engine = Engine.create({ gravity: { x: 0, y: 1.15, scale: 0.0012 }, positionIterations: 16, velocityIterations: 12 });
  const table = buildTable(engine.world);
  const ball = makeBall(x, y);
  Composite.add(engine.world, ball);
  Body.setVelocity(ball, { x: vx, y: vy });
  let stuck = 0;
  let minSp = 999;
  for (let i = 0; i < 240; i += 1) {
    for (let s = 0; s < 3; s += 1) {
      Engine.update(engine, 1000 / 180);
      const sp = Math.hypot(ball.velocity.x, ball.velocity.y);
      if (sp > 14) {
        const k = 14 / sp;
        Body.setVelocity(ball, { x: ball.velocity.x * k, y: ball.velocity.y * k });
      }
    }
    const sp2 = Math.hypot(ball.velocity.x, ball.velocity.y);
    if (sp2 < minSp) minSp = sp2;
    if (sp2 < 0.4 && ball.position.y < 1000) stuck += 1;
  }
  return { stuck, endX: ball.position.x, endY: ball.position.y, minSp };
}

const worst = [];
for (let x = 100; x <= 540; x += 40) {
  for (let y = 760; y <= 980; y += 30) {
    const r = test(x, y, 0, 0);
    if (r.stuck > 60) worst.push({ x, y, stuck: r.stuck, endX: r.endX, endY: r.endY, minSp: r.minSp });
  }
}
worst.sort((a, b) => b.stuck - a.stuck);
for (const w of worst.slice(0, 12)) {
  console.log(`STUCK at (${w.x},${w.y}) frames=${w.stuck} end=(${w.endX.toFixed(0)},${w.endY.toFixed(0)}) minSp=${w.minSp.toFixed(2)}`);
}
console.log("worst count", worst.length);
