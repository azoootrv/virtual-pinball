import Matter from "matter-js";
import { buildTable, makeBall } from "../src/game/table.ts";

const { Engine, Body, Composite } = Matter;

const engine = Engine.create({ gravity: { x: 0, y: 1.15, scale: 0.0012 }, positionIterations: 16, velocityIterations: 12 });
const table = buildTable(engine.world);
const ball = makeBall(160, 970);
Composite.add(engine.world, ball);
Body.setVelocity(ball, { x: 0, y: 0 });
let maxy = 0;
for (let i = 0; i < 300; i += 1) {
  for (let s = 0; s < 3; s += 1) Engine.update(engine, 1000 / 180);
  if (ball.position.y > maxy) maxy = ball.position.y;
  if (i % 30 === 0) console.log(i, "y", ball.position.y.toFixed(1), "x", ball.position.x.toFixed(1));
}
console.log("max y", maxy.toFixed(1), "drained", ball.position.y > 1012);
