import Matter from "matter-js";
import { buildTable, makeBall } from "../src/game/table.ts";

const { Engine, Body, Composite } = Matter;

function drop(sx: number, sy: number, vx = number, vy = number): { stuck: number; x: number; y: number; drained: boolean } {
  const engine = Engine.create({ gravity: { x: 0, y: 1.15, scale: 0.0012 }, positionIterations: 16, velocityIterations: 12, enableSleeping: false });
  const table = buildTable(engine.world);
  const ball = makeBall(sx, sy);
  Composite.add(engine.world, ball);
  Body.setVelocity(ball, { x: vx, y: vy });
  let stuck = 0;
  let drained = false;
  for (let i = 0; i < 300; i += 1) {
    for (let s = 0; s < 3; s += 1) Engine.update(engine, 1000 / 180);
    if (ball.position.y > 996) { drained = true; break; }
    const sp = Math.hypot(ball.velocity.x, ball.velocity.y);
    if (sp > 14) { const k = 14 / sp; Body.setVelocity(ball, { x: ball.velocity.x * k, y: ball.velocity.y * k }); }
    if (sp < 0.4 && ball.position.y > 968 && ball.position.y < 996) stuck += 1;
  }
  return { stuck, x: ball.position.x, y: ball.position.y, drained };
}

const spots: any[] = [];
for (let x = 80; x <= 540; x += 15) {
  for (let y = 900; y <= 1015; y += 10) {
    for (const [vx, vy] of [[0, 0], [8, 0], [-8, 0], [6, 4], [-6, 4], [4, 6], [-4, 6], [10, 2], [-10, 2]]) {
      const r = drop(x, y, vx, vy);
      if (r.stuck > 60 && !r.drained) spots.push({ x, y, vx, vy, stuck: r.stuck, end: { x: r.x, y: r.y } });
    }
  }
}
spots.sort((a, b) => b.stuck - a.stuck);
for (const s of spots.slice(0, 25)) {
  console.log(`STUCK at (${s.x},${s.y}) v=(${s.vx},${s.vy}): frames=${s.stuck} end=(${s.end.x.toFixed(0)},${s.end.y.toFixed(0)})`);
}
console.log("stuck-not-drained spots:", spots.length);
