import { BALL_R, COLORS, TABLE_H, TABLE_W } from "./constants.ts";
import type { Particle, ScorePopup } from "./particles.ts";
import type { BumperDef, FlipperDef, LaneDef, TableParts, TargetDef } from "./table.ts";

export type DrawState = {
  table: TableParts;
  ball: { x: number; y: number } | null;
  particles: Particle[];
  popups: ScorePopup[];
  plunger: number;
  gateClosed: boolean;
  kickbackLit: boolean;
  skillLane: number;
  message: string;
  messageLife: number;
};

function glow(ctx: CanvasRenderingContext2D, color: string, blur: number): void {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function noGlow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
}

function strokeChain(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  color: string,
  width: number,
): void {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  glow(ctx, color, 16);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
  noGlow(ctx);
  ctx.strokeStyle = "#eef9ff";
  ctx.lineWidth = Math.max(2, width * 0.28);
  ctx.stroke();
}

function drawBolt(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-6, -18);
  ctx.lineTo(4, -18);
  ctx.lineTo(-1, -2);
  ctx.lineTo(8, -2);
  ctx.lineTo(-8, 22);
  ctx.lineTo(-2, 4);
  ctx.lineTo(-12, 4);
  ctx.closePath();
  glow(ctx, color, 12);
  ctx.fillStyle = color;
  ctx.fill();
  noGlow(ctx);
  ctx.restore();
}

function drawFlipper(ctx: CanvasRenderingContext2D, flipper: FlipperDef): void {
  const { body, length, width } = flipper;
  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);
  const hw = length / 2;
  const hh = width / 2;
  glow(ctx, COLORS.cyan, 12);
  ctx.fillStyle = "#9fd9ff";
  roundRect(ctx, -hw, -hh, length, width, 8);
  ctx.fill();
  noGlow(ctx);
  const grad = ctx.createLinearGradient(-hw, 0, hw, 0);
  grad.addColorStop(0, "#f7fbff");
  grad.addColorStop(0.4, "#9bb8d4");
  grad.addColorStop(1, "#5d7c99");
  ctx.fillStyle = grad;
  roundRect(ctx, -hw + 1, -hh + 1, length - 2, width - 2, 7);
  ctx.fill();
  ctx.fillStyle = "#1a2740";
  ctx.beginPath();
  const pivotLocal = flipper.localPivotX;
  ctx.arc(pivotLocal, 0, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawBumper(ctx: CanvasRenderingContext2D, bumper: BumperDef): void {
  const { x, y } = bumper.body.position;
  const flash = bumper.flash;
  const r = 28;
  glow(ctx, bumper.color, 18 + flash * 22);
  ctx.beginPath();
  ctx.arc(x, y, r + 3, 0, Math.PI * 2);
  ctx.strokeStyle = bumper.color;
  ctx.lineWidth = 4 + flash * 3;
  ctx.stroke();
  noGlow(ctx);
  const fill = ctx.createRadialGradient(x - 6, y - 8, 4, x, y, r);
  fill.addColorStop(0, flash > 0.2 ? "#fff" : "#f4f7ff");
  fill.addColorStop(0.35, bumper.color);
  fill.addColorStop(1, "#15102c");
  ctx.beginPath();
  ctx.arc(x, y, r - 2, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fillStyle = flash > 0.15 ? "#fff" : "#0c1024";
  ctx.fill();
}

function drawTarget(ctx: CanvasRenderingContext2D, target: TargetDef): void {
  const { x, y } = target.body.position;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(target.body.angle);
  const lit = target.hit || target.flash > 0;
  glow(ctx, lit ? COLORS.lime : COLORS.magenta, lit ? 14 : 6);
  ctx.fillStyle = lit ? COLORS.lime : COLORS.magenta;
  roundRect(ctx, -7, -16, 14, 32, 3);
  ctx.fill();
  noGlow(ctx);
  ctx.fillStyle = lit ? "#082016" : "#2a0724";
  roundRect(ctx, -4, -12, 8, 24, 2);
  ctx.fill();
  ctx.restore();
}

function drawLanes(ctx: CanvasRenderingContext2D, lanes: LaneDef[], skillLane: number): void {
  for (const lane of lanes) {
    const { x, y } = lane.body.position;
    const skill = skillLane === lane.id;
    const color = lane.lit ? COLORS.lime : skill ? COLORS.amber : COLORS.cyan;
    glow(ctx, color, lane.lit || skill ? 16 : 6);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 22, y - 18, 44, 36);
    noGlow(ctx);
    ctx.fillStyle = color;
    ctx.font = "700 16px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(lane.letter, x, y);
  }
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  glow(ctx, "rgba(180, 230, 255, 0.9)", 12);
  ctx.beginPath();
  ctx.arc(x, y, BALL_R + 1, 0, Math.PI * 2);
  ctx.fillStyle = "#9ad8ff";
  ctx.fill();
  noGlow(ctx);
  const chrome = ctx.createRadialGradient(x - 3, y - 4, 2, x, y, BALL_R);
  chrome.addColorStop(0, "#ffffff");
  chrome.addColorStop(0.35, "#c9d7e8");
  chrome.addColorStop(0.75, "#6d7c90");
  chrome.addColorStop(1, "#2a3344");
  ctx.beginPath();
  ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
  ctx.fillStyle = chrome;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - 3.2, y - 4.2, 3.4, 2.2, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fill();
}

function drawPlunger(ctx: CanvasRenderingContext2D, pull: number, spawnX: number): void {
  const top = 700 + pull * 90;
  ctx.fillStyle = "#4c5c72";
  ctx.fillRect(spawnX - 7, top, 14, 900 - top);
  glow(ctx, COLORS.magenta, 10);
  ctx.fillStyle = COLORS.magenta;
  ctx.fillRect(spawnX - 10, top - 10, 20, 16);
  noGlow(ctx);
  ctx.strokeStyle = "rgba(255,61,225,0.55)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i += 1) {
    const y = top + 18 + i * 10;
    ctx.beginPath();
    ctx.moveTo(spawnX - 8, y);
    ctx.lineTo(spawnX + 8, y + 6);
    ctx.stroke();
  }
}

export function drawTable(ctx: CanvasRenderingContext2D, state: DrawState): void {
  ctx.clearRect(0, 0, TABLE_W, TABLE_H);

  const felt = ctx.createLinearGradient(0, 0, TABLE_W, TABLE_H);
  felt.addColorStop(0, "#0b0d2a");
  felt.addColorStop(0.5, COLORS.felt);
  felt.addColorStop(1, "#140c2e");
  ctx.fillStyle = felt;
  ctx.fillRect(0, 0, TABLE_W, TABLE_H);

  const vignette = ctx.createRadialGradient(231, 420, 80, 231, 420, 520);
  vignette.addColorStop(0, "rgba(44,246,255,0.08)");
  vignette.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, TABLE_W, TABLE_H);

  ctx.globalAlpha = 0.35;
  drawBolt(ctx, 80, 330, 1.6, COLORS.magenta);
  drawBolt(ctx, 380, 330, 1.4, COLORS.cyan);
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.font = "800 34px Orbitron, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(44,246,255,0.18)";
  ctx.fillText("ARC LIGHT", 231, 510);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(186, 278, 48, 0, Math.PI * 2);
  ctx.arc(276, 278, 48, 0, Math.PI * 2);
  ctx.arc(231, 368, 48, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 10;
  ctx.stroke();

  for (const chain of state.table.wallChains) {
    strokeChain(ctx, chain.pts, chain.color, 10);
  }

  if (state.gateClosed) {
    glow(ctx, COLORS.magenta, 12);
    ctx.strokeStyle = COLORS.magenta;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(438, 54);
    ctx.lineTo(438, 150);
    ctx.stroke();
    noGlow(ctx);
  }

  drawLanes(ctx, state.table.lanes, state.skillLane);

  for (const bumper of state.table.bumpers) drawBumper(ctx, bumper);
  for (const target of state.table.targets) drawTarget(ctx, target);

  for (const sling of state.table.slings) {
    const color = sling.flash > 0 ? "#fff" : COLORS.amber;
    glow(ctx, COLORS.amber, 10 + sling.flash * 16);
    ctx.strokeStyle = color;
    ctx.lineWidth = 7;
    ctx.beginPath();
    if (sling.id === "left") {
      ctx.moveTo(100, 650);
      ctx.lineTo(148, 758);
    } else {
      ctx.moveTo(362, 650);
      ctx.lineTo(314, 758);
    }
    ctx.stroke();
    noGlow(ctx);
  }

  for (const post of state.table.posts) {
    const { x, y } = post.position;
    glow(ctx, COLORS.cyan, 8);
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#8fdfff";
    ctx.fill();
    noGlow(ctx);
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "#142038";
    ctx.fill();
  }

  ctx.fillStyle = state.kickbackLit ? COLORS.lime : "rgba(93,255,159,0.25)";
  glow(ctx, COLORS.lime, state.kickbackLit ? 16 : 0);
  ctx.font = "700 11px Orbitron, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("KICKBACK", 86, 790);
  noGlow(ctx);

  drawPlunger(ctx, state.plunger, state.table.launchSpawn.x);

  drawFlipper(ctx, state.table.leftFlipper);
  drawFlipper(ctx, state.table.rightFlipper);

  if (state.ball) drawBall(ctx, state.ball.x, state.ball.y);

  for (const particle of state.particles) {
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";
  ctx.font = "700 13px Orbitron, sans-serif";
  for (const popup of state.popups) {
    ctx.globalAlpha = Math.min(1, popup.life * 1.4);
    ctx.fillStyle = COLORS.amber;
    ctx.fillText(popup.text, popup.x, popup.y);
  }
  ctx.globalAlpha = 1;

  if (state.messageLife > 0 && state.message) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, state.messageLife);
    ctx.font = "800 22px Orbitron, sans-serif";
    ctx.textAlign = "center";
    glow(ctx, COLORS.cyan, 18);
    ctx.fillStyle = "#f4fbff";
    ctx.fillText(state.message, 231, 590);
    noGlow(ctx);
    ctx.restore();
  }

  const fade = ctx.createLinearGradient(0, 820, 0, TABLE_H);
  fade.addColorStop(0, "rgba(7,6,26,0)");
  fade.addColorStop(1, "rgba(255,93,122,0.18)");
  ctx.fillStyle = fade;
  ctx.fillRect(90, 830, 280, 70);
}
