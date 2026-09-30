import Matter from "matter-js";
import { LANE_INNER, LANE_OUTER, LEFT, PLAY_CENTER, TABLE_H } from "../src/game/constants.ts";
import { buildTable, makeBall, type FlipperDef, type TableParts } from "../src/game/table.ts";

const { Engine, Body, Composite, Events } = Matter;

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

// ---- Rule 3: flippers are symmetric ----
function testFlipperSymmetry(): void {
  const engine = Engine.create({ gravity: { x: 0, y: 1.15, scale: 0.0012 } });
  const table = buildTable(engine.world);
  const left = table.leftFlipper;
  const right = table.rightFlipper;

  if (left.length !== right.length) fail(`flipper length differs: ${left.length} vs ${right.length}`);
  if (left.width !== right.width) fail(`flipper width differs: ${left.width} vs ${right.width}`);
  if (Math.abs(left.restAngle) !== Math.abs(right.restAngle)) {
    fail(`rest angles not symmetric: ${left.restAngle} vs ${right.restAngle}`);
  }
  if (Math.abs(left.upAngle) !== Math.abs(right.upAngle)) {
    fail(`up angles not symmetric: ${left.upAngle} vs ${right.upAngle}`);
  }
  const leftDist = Math.abs(left.pivot.x - PLAY_CENTER);
  const rightDist = Math.abs(right.pivot.x - PLAY_CENTER);
  if (Math.abs(leftDist - rightDist) > 0.5) {
    fail(`pivots not symmetric about center: left ${leftDist}, right ${rightDist}`);
  }
  console.log("rule 3 (symmetric flippers): ok");
}

// ---- Rule 2: flipper momentum reaches the top ----
function pressFlipper(flipper: FlipperDef, engine: Matter.Engine, ball: Matter.Body): void {
  const target = flipper.upAngle;
  const speed = 12;
  const dt = 1 / 60;
  const body = flipper.body;
  Events.on(engine, "collisionStart", (e) => {
    for (const p of e.pairs) {
      const a = p.bodyA.label;
      const b = p.bodyB.label;
      const isBall = a === "ball" || b === "ball";
      if (isBall) console.log(`COLLISION: ${a} <-> ${b} at y=${ball.position.y.toFixed(0)}`);
      const isFlipper = a.startsWith("flipper:") || b.startsWith("flipper:");
      if (isBall && isFlipper) {
        const v = ball.velocity;
        if (v.y < 0) {
          const sp = Math.hypot(v.x, v.y);
          const maxLaunch = 44;
          const clamp = maxLaunch / sp;
          console.log(`CLAMP at collision: before vy=${v.y.toFixed(2)} sp=${sp.toFixed(1)} -> after vy=${(v.y * clamp).toFixed(2)}`);
          Body.setVelocity(ball, { x: v.x * clamp, y: v.y * clamp });
        }
      }
    }
  });
  for (let i = 0; i < 30; i += 1) {
    const current = body.angle;
    const diff = target - current;
    const step = Math.abs(diff) <= speed * dt ? diff : Math.sign(diff) * speed * dt;
    const next = current + step;
    const cx = flipper.pivot.x - flipper.localPivotX * Math.cos(next);
    const cy = flipper.pivot.y - flipper.localPivotX * Math.sin(next);
    Body.setAngle(body, next);
    Body.setPosition(body, { x: cx, y: cy });
    Body.setAngularVelocity(body, step / dt);
    clampLaunch(flipper, ball);
    Engine.update(engine, 1000 / 60);
  }
}

function clampLaunch(flipper: FlipperDef, ball: Matter.Body): void {
  const body = flipper.body;
  const dx = ball.position.x - body.position.x;
  const dy = ball.position.y - body.position.y;
  const cos = Math.cos(body.angle);
  const sin = Math.sin(body.angle);
  const localX = dx * cos + dy * sin;
  const localY = -dx * sin + dy * cos;
  const hw = flipper.length / 2;
  const hh = flipper.width / 2;
  if (Math.abs(localX) > hw + 14 || Math.abs(localY) > hh + 14) return;
  const v = ball.velocity;
  if (v.y < 0) {
    const sp = Math.hypot(v.x, v.y);
    const maxLaunch = 44;
    const clamp = maxLaunch / sp;
    console.log(`CLAMP launch: before vy=${v.y.toFixed(2)} -> after vy=${(v.y * clamp).toFixed(2)}`);
    Body.setVelocity(ball, { x: v.x * clamp, y: v.y * clamp });
  }
}

function testFlipperMomentum(): void {
  const engine = Engine.create({
    gravity: { x: 0, y: 1.15, scale: 0.0012 },
    positionIterations: 16,
    velocityIterations: 12,
    enableSleeping: false,
  });
  const table = buildTable(engine.world);

  for (const flipperSide of ["left", "right"]) {
    const flipper = flipperSide === "left" ? table.leftFlipper : table.rightFlipper;
    const pivot = flipper.pivot;
    const offset = flipperSide === "left" ? 40 : -40;
    const ball = makeBall(pivot.x + offset, pivot.y - 20);
    Composite.add(engine.world, ball);
    Body.setVelocity(ball, { x: 0, y: 0 });

    // let the ball settle onto the flipper
    for (let i = 0; i < 15; i += 1) Engine.update(engine, 1000 / 60);

    pressFlipper(flipper, engine, ball);

    let minY = ball.position.y;
    let peakY = ball.position.y;
    for (let i = 0; i < 120; i += 1) {
      for (let s = 0; s < 24; s += 1) {
        Engine.update(engine, 1000 / 1440);
        const v = ball.velocity;
        if (v.y < -44) Body.setVelocity(ball, { x: v.x, y: -44 });
      }
      if (i % 5 === 0) console.log(`frame ${i}: y=${ball.position.y.toFixed(1)} vy=${ball.velocity.y.toFixed(2)} peakY=${peakY.toFixed(0)}`);
      if (ball.position.y < 140 && ball.position.y > 120 && ball.velocity.y < -20 && i < 20) {
        console.log(`near top: y=${ball.position.y.toFixed(1)} vy=${ball.velocity.y.toFixed(2)}`);
      }
      if (ball.position.y < minY) minY = ball.position.y;
      if (ball.position.y < peakY) peakY = ball.position.y;
      if (ball.position.y < 100) break;
    }
    if (peakY < 0) {
      fail(`${flipperSide} flipper launched ball off the top: y=${peakY.toFixed(0)} (must stay on the table)`);
    }
    if (peakY >= 350) {
      fail(`${flipperSide} flipper launch too weak: ball peaked at y=${peakY.toFixed(0)} (must reach the top)`);
    }
    console.log(`rule 2 (${flipperSide} flipper momentum): ok — ball peaked at y=${peakY.toFixed(0)} minY=${minY.toFixed(0)}`);
    if (peakY < 0) {
      fail(`${flipperSide} flipper launched ball off the top: y=${peakY.toFixed(0)} (must stay on the table)`);
    }
    if (peakY >= 350) {
      fail(`${flipperSide} flipper launch too weak: ball peaked at y=${peakY.toFixed(0)} (must reach the top)`);
    }
    console.log(`rule 2 (${flipperSide} flipper momentum): ok — ball peaked at y=${peakY.toFixed(0)} minY=${minY.toFixed(0)}`);
    Composite.remove(engine.world, ball);
  }
}

// ---- Rule 1: ball exits only at the bottom, below the flipper ----
function testBallExitOnlyBottom(): void {
  const engine = Engine.create({
    gravity: { x: 0, y: 1.15, scale: 0.0012 },
    positionIterations: 16,
    velocityIterations: 12,
    enableSleeping: false,
  });
  const table = buildTable(engine.world);

  let escapedSide = 0;
  let escapedTop = 0;
  const drainY = 968;

  for (let x = 80; x <= 540; x += 30) {
    for (let y = 200; y <= 950; y += 50) {
      const ball = makeBall(x, y);
      Composite.add(engine.world, ball);
      Body.setVelocity(ball, { x: 0, y: 8 });

      let drained = false;
      for (let i = 0; i < 200; i += 1) {
        for (let s = 0; s < 6; s += 1) Engine.update(engine, 1000 / 360);
        const sp = Math.hypot(ball.velocity.x, ball.velocity.y);
        if (sp > 38) { const k = 38 / sp; Body.setVelocity(ball, { x: ball.velocity.x * k, y: ball.velocity.y * k }); }
        if (ball.position.y > drainY) { drained = true; break; }
      }
      if (!drained) {
        if (ball.position.x < LEFT || ball.position.x > LANE_OUTER) escapedSide += 1;
        else if (ball.position.y < 0) escapedTop += 1;
      }
      Composite.remove(engine.world, ball);
    }
  }
  if (escapedSide > 0) fail(`${escapedSide} balls ended up outside the sides`);
  if (escapedTop > 0) fail(`${escapedTop} balls ended up outside the top`);
  console.log("rule 1 (ball exits only at bottom): ok");
}

// ---- Run all tests ----
testFlipperSymmetry();
testFlipperMomentum();
testBallExitOnlyBottom();
console.log("all table rule tests passed");
