import Matter from "matter-js";
import { BALL_R } from "./constants.ts";
import type { FlipperDef } from "./table.ts";

const { Body } = Matter;

export type Capsule = {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  radius: number;
};

export function flipperCapsule(flipper: FlipperDef): Capsule {
  const { body, length, width } = flipper;
  const cos = Math.cos(body.angle);
  const sin = Math.sin(body.angle);
  const radius = width / 2;
  const inner = length / 2 - radius;
  return {
    ax: body.position.x - inner * cos,
    ay: body.position.y - inner * sin,
    bx: body.position.x + inner * cos,
    by: body.position.y + inner * sin,
    radius,
  };
}

function closestOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { x: number; y: number; t: number } {
  const abx = bx - ax;
  const aby = by - ay;
  const denom = abx * abx + aby * aby;
  const t = denom <= 1e-8 ? 0 : ((px - ax) * abx + (py - ay) * aby) / denom;
  const clamped = Math.max(0, Math.min(1, t));
  return { x: ax + abx * clamped, y: ay + aby * clamped, t };
}

function sampleCount(prev: { x: number; y: number }, ball: Matter.Body): number {
  const travel = Math.hypot(ball.position.x - prev.x, ball.position.y - prev.y);
  return Math.min(16, Math.max(4, Math.ceil(travel / 4) + 1));
}

function drainAxis(cap: Capsule, side: "left" | "right"): { x: number; y: number } {
  const dx = side === "left" ? cap.bx - cap.ax : cap.ax - cap.bx;
  const dy = side === "left" ? cap.by - cap.ay : cap.ay - cap.by;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

export function separateBallFromFlipper(
  ball: Matter.Body,
  flipper: FlipperDef,
  prev: { x: number; y: number },
): boolean {
  const cap = flipperCapsule(flipper);
  const hitRadius = cap.radius + BALL_R + 0.6;
  const samples = sampleCount(prev, ball);
  const drain = drainAxis(cap, flipper.side);
  const swinging = Math.abs(flipper.body.angularVelocity) > 0.05;

  let bestT = 2;
  let nx = 0;
  let ny = -1;
  let cx = cap.ax;
  let cy = cap.ay;
  let along = 0;

  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const px = prev.x + (ball.position.x - prev.x) * t;
    const py = prev.y + (ball.position.y - prev.y) * t;
    const closest = closestOnSegment(px, py, cap.ax, cap.ay, cap.bx, cap.by);
    const tInner = flipper.side === "left" ? closest.t : 1 - closest.t;
    if (!swinging && (closest.t < 0 || closest.t > 1 || tInner > 0.9)) continue;

    let dx = px - closest.x;
    let dy = py - closest.y;
    let dist = Math.hypot(dx, dy);
    if (dist < 1e-5) {
      dx = -Math.sin(flipper.body.angle);
      dy = Math.cos(flipper.body.angle);
      dist = 0;
      if (dy > 0) {
        dx = -dx;
        dy = -dy;
      }
    } else {
      dx /= dist;
      dy /= dist;
    }
    if (dist < hitRadius && t <= bestT) {
      bestT = t;
      nx = dx;
      ny = dy;
      cx = closest.x;
      cy = closest.y;
      along = tInner;
    }
  }

  if (bestT > 1) {
    const closest = closestOnSegment(ball.position.x, ball.position.y, cap.ax, cap.ay, cap.bx, cap.by);
    const tInner = flipper.side === "left" ? closest.t : 1 - closest.t;
    const dist = Math.hypot(ball.position.x - closest.x, ball.position.y - closest.y);
    if (!swinging && tInner > 0.88 && dist < hitRadius + 8) {
      Body.setVelocity(ball, {
        x: ball.velocity.x + drain.x * 2.4,
        y: Math.max(ball.velocity.y, 1.6) + drain.y * 2.4,
      });
    }
    return false;
  }

  const fromPrev = (prev.x - cx) * nx + (prev.y - cy) * ny;
  if (fromPrev < 0) {
    nx = -nx;
    ny = -ny;
  }

  if (!swinging && along > 0.88) {
    Body.setPosition(ball, {
      x: ball.position.x + drain.x * 4,
      y: ball.position.y + drain.y * 4 + 2,
    });
    Body.setVelocity(ball, {
      x: ball.velocity.x + drain.x * 3,
      y: Math.max(ball.velocity.y, 2.2) + drain.y * 3,
    });
    return true;
  }

  Body.setPosition(ball, {
    x: cx + nx * hitRadius + (swinging ? 0 : drain.x * 3.4),
    y: cy + ny * hitRadius + (swinging ? 0 : drain.y * 3.4),
  });

  const rx = cx - flipper.pivot.x;
  const ry = cy - flipper.pivot.y;
  const omega = flipper.body.angularVelocity;
  const surfaceX = -omega * ry;
  const surfaceY = omega * rx;
  const surfaceN = surfaceX * nx + surfaceY * ny;

  let vx = ball.velocity.x;
  let vy = ball.velocity.y;
  const vn = vx * nx + vy * ny;
  if (vn < -0.35 && swinging) {
    const bounce = 0.42;
    vx -= (1 + bounce) * vn * nx;
    vy -= (1 + bounce) * vn * ny;
  } else if (vn < 0) {
    vx -= vn * nx;
    vy -= vn * ny;
  }

  if (!swinging) {
    vx = vx * 0.84 + drain.x * 0.85;
    vy = vy * 0.84 + drain.y * 0.85;
  }

  if (surfaceN > 0.08) {
    const kick = Math.min(18, 10 + Math.abs(omega) * 28);
    vx += nx * kick * 0.22 + (flipper.side === "left" ? 2.1 : -2.1);
    vy += ny * kick - Math.abs(omega) * 16;
  }

  Body.setVelocity(ball, { x: vx, y: vy });
  return true;
}
