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

export function closestOnSegment(
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

function upwardNormal(angle: number): { x: number; y: number } {
  let nx = -Math.sin(angle);
  let ny = Math.cos(angle);
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  return { x: nx, y: ny };
}

export function separateBallFromFlipper(
  ball: Matter.Body,
  flipper: FlipperDef,
  prev: { x: number; y: number },
): boolean {
  const cap = flipperCapsule(flipper);
  const hitRadius = cap.radius + BALL_R + 0.5;
  const samples = sampleCount(prev, ball);
  const drain = drainAxis(cap, flipper.side);
  const face = upwardNormal(flipper.body.angle);
  const swinging = Math.abs(flipper.body.angularVelocity) > 0.05;

  const prevClose = closestOnSegment(prev.x, prev.y, cap.ax, cap.ay, cap.bx, cap.by);
  const prevSigned = (prev.x - prevClose.x) * face.x + (prev.y - prevClose.y) * face.y;
  const prevBelow = prevClose.t >= 0 && prevClose.t <= 1 && prevSigned < -BALL_R * 0.4;

  let bestT = 2;
  let cx = cap.ax;
  let cy = cap.ay;
  let along = 0;

  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const px = prev.x + (ball.position.x - prev.x) * t;
    const py = prev.y + (ball.position.y - prev.y) * t;
    const closest = closestOnSegment(px, py, cap.ax, cap.ay, cap.bx, cap.by);
    if (closest.t < 0 || closest.t > 1) continue;
    const dist = Math.hypot(px - closest.x, py - closest.y);
    if (dist >= hitRadius + 6) continue;
    const signed = (px - closest.x) * face.x + (py - closest.y) * face.y;
    if (signed < -BALL_R * 0.4) continue;
    if (t <= bestT) {
      bestT = t;
      cx = closest.x;
      cy = closest.y;
      along = flipper.side === "left" ? closest.t : 1 - closest.t;
    }
  }

  if (bestT > 1) {
    if (prevBelow) return false;
    return false;
  }

  const inHole = !swinging && along > 0.97;
  if (inHole) return false;

  const nx = face.x;
  const ny = face.y;
  Body.setPosition(ball, {
    x: cx + nx * hitRadius + (swinging ? 0 : drain.x * 0.9),
    y: cy + ny * hitRadius + (swinging ? 0 : drain.y * 0.9),
  });

  const rx = cx - flipper.pivot.x;
  const ry = cy - flipper.pivot.y;
  const omega = flipper.body.angularVelocity;
  const swingUp = omega * (rx * ny - ry * nx) > 0;

  let vx = ball.velocity.x;
  let vy = ball.velocity.y;
  const vn = vx * nx + vy * ny;
  if (vn < 0) {
    const impact = Math.min(1, -vn / 18);
    const bounce = (swinging ? 0.55 : 0.42) + impact * 0.2;
    vx -= (1 + bounce) * vn * nx;
    vy -= (1 + bounce) * vn * ny;
  }

  if (!swinging) {
    vx = vx * 0.992 + drain.x * 0.25;
    vy = vy * 0.992 + drain.y * 0.25;
  } else if (swingUp) {
    const power = Math.min(1, Math.abs(omega) * 1.6);
    const launch = 20 + power * 30;
    const inward = flipper.side === "left" ? 1 : -1;
    vx = vx * 0.5 + nx * launch * 0.6 + inward * 4;
    vy = vy * 0.4 + ny * launch - 4;
    if (vy > -launch * 0.75) vy = -launch * 0.75;
  }

  Body.setVelocity(ball, { x: vx, y: vy });
  return true;
}
