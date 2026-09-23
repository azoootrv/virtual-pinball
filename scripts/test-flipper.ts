import Matter from "matter-js";
import { CAT, LANE_INNER, LANE_OUTER } from "../src/game/constants.ts";
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

  let bounced = false;

  for (let i = 0; i < 140; i += 1) {
    Engine.update(engine, 1000 / 60);
    const speed = Math.hypot(ball.velocity.x, ball.velocity.y);
    if (speed > 38) {
      const s = 38 / speed;
      Body.setVelocity(ball, { x: ball.velocity.x * s, y: ball.velocity.y * s });
    }
    const overLeftBat = ball.position.x >= 214 && ball.position.x <= 290;
    const overRightBat = ball.position.x >= 340 && ball.position.x <= 416;
    const slippedUnder =
      ball.position.y > 1005 && ball.position.y < 1028 && (overLeftBat || overRightBat);
    if (slippedUnder) {
      fail(`ball went under a flipper at (${ball.position.x.toFixed(1)}, ${ball.position.y.toFixed(1)})`);
    }
    if (ball.position.y < 990 && ball.position.y > 940 && (overLeftBat || overRightBat)) bounced = true;
  }

  if (!bounced) fail("drop never registered a flipper hit");
  console.log(
    `flipper drop (${label}) ok: bounced=${bounced} end=(${ball.position.x.toFixed(1)}, ${ball.position.y.toFixed(1)})`,
  );
}

function simulateFlipKick(): void {
  const engine = Engine.create({
    gravity: { x: 0, y: 1.15, scale: 0.0012 },
    positionIterations: 16,
    velocityIterations: 12,
  });
  const table = buildTable(engine.world);
  const start = { x: 280, y: 940 };
  const ball = makeBall(start.x, start.y);
  Composite.add(engine.world, ball);
  Body.setVelocity(ball, { x: 0, y: 0 });

  for (let i = 0; i < 15; i += 1) {
    Engine.update(engine, 1000 / 60);
  }

  const f = table.leftFlipper;
  let maxSpeed = 0;
  for (let i = 0; i < 25; i += 1) {
    const target = f.upAngle;
    const speed = 0.85;
    const dt = 1 / 60;
    const current = f.body.angle;
    const diff = target - current;
    const step = Math.abs(diff) <= speed * dt ? diff : Math.sign(diff) * speed * dt;
    const next = current + step;
    const cx = f.pivot.x - f.localPivotX * Math.cos(next);
    const cy = f.pivot.y - f.localPivotX * Math.sin(next);
    Body.setAngle(f.body, next);
    Body.setPosition(f.body, { x: cx, y: cy });
    Body.setAngularVelocity(f.body, step / dt);
    Engine.update(engine, 1000 / 60);
    const sp = Math.hypot(ball.velocity.x, ball.velocity.y);
    if (sp > maxSpeed) maxSpeed = sp;
  }

  if (maxSpeed < 12) {
    fail(`flipper kick too weak: max speed ${maxSpeed.toFixed(2)}`);
  }
  console.log(`flipper kick ok: max speed ${maxSpeed.toFixed(2)}`);
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
    if (speed > 38) {
      const s = 38 / speed;
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
simulateFlipKick();
simulateLaunchTurn();
console.log("all physics checks passed");
