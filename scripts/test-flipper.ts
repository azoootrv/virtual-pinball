import Matter from "matter-js";
import { CAT, LANE_INNER, LANE_OUTER } from "../src/game/constants.ts";
import { separateBallFromFlipper } from "../src/game/flipper.ts";
import { buildTable, makeBall } from "../src/game/table.ts";

const { Engine, Body, Composite, Events } = Matter;

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function simulateDropOntoFlipper(): void {
  const engine = Engine.create({
    gravity: { x: 0, y: 1.15, scale: 0.0012 },
    positionIterations: 16,
    velocityIterations: 12,
  });
  const table = buildTable(engine.world);
  const start = { x: 248, y: 820 };
  const ball = makeBall(start.x, start.y);
  Composite.add(engine.world, ball);
  Body.setVelocity(ball, { x: 0, y: 14 });

  let prev = { ...start };
  let bounced = false;

  for (let i = 0; i < 90; i += 1) {
    Engine.update(engine, 1000 / 60);
    const hitLeft = separateBallFromFlipper(ball, table.leftFlipper, prev);
    const hitRight = separateBallFromFlipper(ball, table.rightFlipper, prev);
    if (hitLeft || hitRight) bounced = true;
    prev = { x: ball.position.x, y: ball.position.y };

    if (ball.position.y > 990 && ball.position.x > 200 && ball.position.x < 300) {
      fail(`ball tunneled through left flipper at (${ball.position.x.toFixed(1)}, ${ball.position.y.toFixed(1)})`);
    }
  }

  if (!bounced) fail("drop never registered a flipper hit");
  console.log(
    `flipper drop ok: bounced=${bounced} end=(${ball.position.x.toFixed(1)}, ${ball.position.y.toFixed(1)}) vy=${ball.velocity.y.toFixed(2)}`,
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
simulateLaunchTurn();
console.log("all physics checks passed");
