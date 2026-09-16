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
): { x: number; y: number } {
  const abx = bx - ax;
  const aby = by - ay;
  const denom = abx * abx + aby * aby;
  const t = denom <= 1e-8 ? 0 : Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / denom));
  return { x: ax + abx * t, y: ay + aby * t };
}

function sampleCount(prev: { x: number; y: number }, ball: Matter.Body): number {
  const travel = Math.hypot(ball.position.x - prev.x, ball.position.y - prev.y);
  return Math.min(16, Math.max(4, Math.ceil(travel / 4) + 1));
}

export function separateBallFromFlipper(
  ball: Matter.Body,
  flipper: FlipperDef,
  prev: { x: number; y: number },
): boolean {
  const cap = flipperCapsule(flipper);
  const hitRadius = cap.radius + BALL_R + 0.6;
  const samples = sampleCount(prev, ball);

  let bestT = 2;
  let nx = 0;
  let ny = -1;
  let cx = cap.ax;
  let cy = cap.ay;

  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const px = prev.x + (ball.position.x - prev.x) * t;
    const py = prev.y + (ball.position.y - prev.y) * t;
    const closest = closestOnSegment(px, py, cap.ax, cap.ay, cap.bx, cap.by);
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
    }
  }

  if (bestT > 1) return false;

  const fromPrev = (prev.x - cx) * nx + (prev.y - cy) * ny;
  if (fromPrev < 0) {
    nx = -nx;
    ny = -ny;
  }

  Body.setPosition(ball, { x: cx + nx * hitRadius, y: cy + ny * hitRadius });

  const rx = cx - flipper.pivot.x;
  const ry = cy - flipper.pivot.y;
  const omega = flipper.body.angularVelocity;
  const surfaceX = -omega * ry;
  const surfaceY = omega * rx;
  const surfaceN = surfaceX * nx + surfaceY * ny;

  let vx = ball.velocity.x;
  let vy = ball.velocity.y;
  const vn = vx * nx + vy * ny;
  if (vn < -0.35) {
    const bounce = 1.22;
    vx -= (1 + bounce) * vn * nx;
    vy -= (1 + bounce) * vn * ny;
  } else if (vn < 0) {
    vx -= vn * nx;
    vy -= vn * ny;
  }

  if (surfaceN > 0.08) {
    const kick = Math.min(18, 10 + Math.abs(omega) * 28);
    vx += nx * kick * 0.22 + (flipper.side === "left" ? 2.1 : -2.1);
    vy += ny * kick - Math.abs(omega) * 16;
  }

  Body.setVelocity(ball, { x: vx, y: vy });
  return true;
}
