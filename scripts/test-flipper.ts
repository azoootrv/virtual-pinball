import Matter from "matter-js";
import { CAT, LANE_INNER, LANE_OUTER } from "../src/game/constants.ts";
import { separateBallFromFlipper } from "../src/game/flipper.ts";
import { buildTable, makeBall } from "../src/game/table.ts";

const { Engine, Body, Composite, Events } = Matter;

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function simulateDropOntoFlipper(start = { x: 248, y: 820 }, label = "left shaft"): void {
  const engine = Engine.create({
    gravity: { x: 0, y: 1.15, scale: 0.0012 },
    positionIterations: 16,
    velocityIterations: 12,
  });
  const table = buildTable(engine.world);
  const ball = makeBall(start.x, start.y);
  Composite.add(engine.world, ball);
  Body.setVelocity(ball, { x: 0, y: 14 });

  let prev = { ...start };
  let bounced = false;
  let stuckFrames = 0;
  let drained = false;

  for (let i = 0; i < 140; i += 1) {
    Engine.update(engine, 1000 / 60);
    const hitLeft = separateBallFromFlipper(ball, table.leftFlipper, prev);
    const hitRight = separateBallFromFlipper(ball, table.rightFlipper, prev);
    if (hitLeft || hitRight) bounced = true;
    prev = { x: ball.position.x, y: ball.position.y };
    const speed = Math.hypot(ball.velocity.x, ball.velocity.y);

    if (i < 10 && ball.position.y > 1005 && ball.position.x > 200 && ball.position.x < 260) {
      fail(`ball tunneled through left flipper at (${ball.position.x.toFixed(1)}, ${ball.position.y.toFixed(1)})`);
    }

    const inDrain = ball.position.x > 268 && ball.position.x < 362 && ball.position.y > 990;
    if (inDrain || ball.position.y > 1020) drained = true;
    if (bounced && speed < 0.4 && ball.position.y < 1000) stuckFrames += 1;
    else stuckFrames = 0;
    if (stuckFrames > 28) {
      fail(`ball stuck on flipper at (${ball.position.x.toFixed(1)}, ${ball.position.y.toFixed(1)})`);
    }
  }

  if (!bounced) fail("drop never registered a flipper hit");
  if (!drained) {
    fail(
      `ball did not roll into the drain, end=(${ball.position.x.toFixed(1)}, ${ball.position.y.toFixed(1)})`,
    );
  }
  console.log(
    `flipper drop (${label}) ok: bounced=${bounced} drained=${drained} end=(${ball.position.x.toFixed(1)}, ${ball.position.y.toFixed(1)})`,
  );
}

function simulateLaunchTurn(): void {
  const engine = Engine.create({
    gravity: { x: 0, y: 1.15, scale: 0.0012 },
    positionIterations: 16,
    velocityIterations: 12,
  });
  const table = buildTable(engine.world);
  const spawn = table.launchSpawn;
  const ball = makeBall(spawn.x, spawn.y - 24);
  Composite.add(engine.world, ball);
  Body.setVelocity(ball, { x: 0, y: -26 });

  Events.on(engine, "collisionStart", (event) => {
    for (const pair of event.pairs) {
      const labels = [pair.bodyA.label, pair.bodyB.label];
      if (!labels.includes("ball") || !labels.includes("launch-turn")) continue;
      if (ball.velocity.y >= 0) continue;
      Body.setVelocity(ball, {
        x: -16,
        y: Math.max(Math.min(ball.velocity.y, -6), -10),
      });
    }
  });

  let playfieldFrames = 0;
  for (let i = 0; i < 180; i += 1) {
    Engine.update(engine, 1000 / 60);
    const speed = Math.hypot(ball.velocity.x, ball.velocity.y);
    if (speed > 30) {
      const s = 30 / speed;
      Body.setVelocity(ball, { x: ball.velocity.x * s, y: ball.velocity.y * s });
    }
    if (ball.position.x < LANE_INNER - 8) {
      table.gate.collisionFilter.mask = CAT.ball;
      playfieldFrames += 1;
    }
    const inLane = ball.position.x > LANE_INNER - 2 && ball.position.x < LANE_OUTER + 8;
    if (inLane && ball.position.y < 350 && ball.velocity.y < -1) {
      Body.setVelocity(ball, {
        x: Math.min(ball.velocity.x, -12),
        y: Math.max(ball.velocity.y * 0.88, -8),
      });
    }
  }

  if (playfieldFrames < 40) {
    fail(
      `launch fell back into the lane after ${playfieldFrames} playfield frames, end=(${ball.position.x.toFixed(1)}, ${ball.position.y.toFixed(1)})`,
    );
  }
  console.log(
    `launch turn ok: playfieldFrames=${playfieldFrames} end=(${ball.position.x.toFixed(1)}, ${ball.position.y.toFixed(1)})`,
  );
}

simulateDropOntoFlipper();
simulateDropOntoFlipper({ x: 392, y: 860 }, "right shaft");
simulateLaunchTurn();
console.log("all physics checks passed");
