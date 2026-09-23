import cabinetArtUrl from "../assets/cabinet.png";
import { BALL_R, COLORS, PLAY_CENTER, TABLE_H, TABLE_W } from "./constants.ts";
import type { Particle, ScorePopup } from "./particles.ts";
import type { BumperDef, FlipperDef, LaneDef, SaucerDef, TableParts, TargetDef } from "./table.ts";

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

const cabinetArt = new Image();
cabinetArt.src = cabinetArtUrl;

function glow(ctx: CanvasRenderingContext2D, color: string, blur: number): void {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function noGlow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
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

function drawCabinet(ctx: CanvasRenderingContext2D): void {
  if (cabinetArt.complete && cabinetArt.naturalWidth > 0) {
    ctx.drawImage(cabinetArt, 0, 0, TABLE_W, TABLE_H);
    return;
  }
  ctx.fillStyle = "#070814";
  ctx.fillRect(0, 0, TABLE_W, TABLE_H);
}

function drawVortexFlash(ctx: CanvasRenderingContext2D, bumper: BumperDef): void {
  if (bumper.flash <= 0) return;
  const { x, y } = bumper.body.position;
  const pulse = bumper.flash;
  glow(ctx, bumper.color, 28 + pulse * 24);
  ctx.beginPath();
  ctx.arc(x, y, 44 + pulse * 10, 0, Math.PI * 2);
  ctx.strokeStyle = bumper.color;
  ctx.globalAlpha = 0.35 + pulse * 0.55;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.globalAlpha = pulse * 0.45;
  ctx.fill();
  ctx.globalAlpha = 1;
  noGlow(ctx);
}

function drawSaucerFlash(ctx: CanvasRenderingContext2D, saucer: SaucerDef): void {
  if (saucer.flash <= 0) return;
  const { x, y } = saucer.body.position;
  glow(ctx, COLORS.magenta, 22);
  ctx.beginPath();
  ctx.arc(x, y, 34 + saucer.flash * 12, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.magenta;
  ctx.globalAlpha = saucer.flash;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.globalAlpha = 1;
  noGlow(ctx);
}

function drawLaneLights(ctx: CanvasRenderingContext2D, lanes: LaneDef[], skillLane: number): void {
  for (const lane of lanes) {
    const { x, y } = lane.body.position;
    const skill = skillLane === lane.id;
    if (!lane.lit && !skill) continue;
    const color = lane.lit ? COLORS.lime : COLORS.amber;
    glow(ctx, color, 20);
    ctx.globalAlpha = 0.4;
    roundRect(ctx, x - 26, y - 20, 52, 40, 6);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.globalAlpha = 1;
    noGlow(ctx);
  }
}

function drawTargetGlow(ctx: CanvasRenderingContext2D, target: TargetDef): void {
  if (!target.hit && target.flash <= 0) return;
  const { x, y } = target.body.position;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(target.body.angle);
  glow(ctx, COLORS.magenta, 14);
  ctx.fillStyle = target.flash > 0 ? "#fff" : COLORS.magenta;
  roundRect(ctx, -7, -15, 14, 30, 3);
  ctx.fill();
  noGlow(ctx);
  ctx.restore();
}

function coverPaintedFlippers(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  const cover = ctx.createRadialGradient(311, 980, 60, 311, 980, 230);
  cover.addColorStop(0, "#040a1c");
  cover.addColorStop(0.55, "rgba(5,10,28,0.92)");
  cover.addColorStop(1, "rgba(5,10,28,0)");
  ctx.fillStyle = cover;
  ctx.fillRect(60, 900, 500, 130);
  ctx.fillStyle = "#9fc0ff";
  const stars: [number, number, number][] = [
    [120, 950, 0.8], [170, 968, 0.6], [220, 956, 1.0], [270, 978, 0.7],
    [320, 960, 0.9], [370, 984, 0.6], [420, 966, 1.0], [470, 980, 0.8],
    [200, 998, 0.6], [300, 1000, 0.9], [400, 996, 0.7],
  ];
  for (const [x, y, s] of stars) {
    const d = Math.hypot(x - 311, y - 980) / 230;
    ctx.globalAlpha = (0.3 + s * 0.2) * Math.max(0, 1 - d);
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawFlipper(ctx: CanvasRenderingContext2D, flipper: FlipperDef): void {
  const { body, length, width } = flipper;
  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);
  const hw = length / 2;
  const hh = width / 2;
  glow(ctx, "#ff2ec8", 14);
  const shell = ctx.createLinearGradient(-hw, -hh, hw, hh);
  shell.addColorStop(0, "#ff8fc0");
  shell.addColorStop(0.5, "#d44a86");
  shell.addColorStop(1, "#7a1f4a");
  ctx.fillStyle = shell;
  roundRect(ctx, -hw, -hh, length, width, hh);
  ctx.fill();
  noGlow(ctx);
  const core = ctx.createLinearGradient(-hw, -hh, hw, hh);
  core.addColorStop(0, "#fff4f9");
  core.addColorStop(0.5, "#e2c8d2");
  core.addColorStop(1, "#a86a7c");
  ctx.fillStyle = core;
  roundRect(ctx, -hw + 2, -hh + 3, length - 4, width - 6, hh - 3);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,180,210,0.5)";
  ctx.lineWidth = 1;
  for (let i = -hw + 10; i < hw - 4; i += 7) {
    ctx.beginPath();
    ctx.moveTo(i, -hh + 3);
    ctx.lineTo(i + 3, hh - 3);
    ctx.stroke();
  }
  ctx.fillStyle = "#2a0c16";
  ctx.beginPath();
  ctx.arc(flipper.localPivotX, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  glow(ctx, "rgba(180, 255, 255, 0.95)", 14);
  ctx.beginPath();
  ctx.arc(x, y, BALL_R + 1.5, 0, Math.PI * 2);
  ctx.fillStyle = "#9af6ff";
  ctx.fill();
  noGlow(ctx);
  const chrome = ctx.createRadialGradient(x - 3, y - 4, 2, x, y, BALL_R);
  chrome.addColorStop(0, "#ffffff");
  chrome.addColorStop(0.35, "#d7f7ff");
  chrome.addColorStop(0.75, "#6d889c");
  chrome.addColorStop(1, "#243040");
  ctx.beginPath();
  ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
  ctx.fillStyle = chrome;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - 3.2, y - 4.2, 3.4, 2.2, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fill();
}

function drawPlunger(ctx: CanvasRenderingContext2D, pull: number, spawnX: number): void {
  const top = 780 + pull * 100;
  glow(ctx, COLORS.magenta, 12);
  ctx.fillStyle = COLORS.magenta;
  ctx.fillRect(spawnX - 7, top, 14, 960 - top);
  ctx.fillRect(spawnX - 11, top - 8, 22, 14);
  noGlow(ctx);

  const meterX = spawnX + 18;
  const meterY = 760;
  const meterH = 180;
  ctx.fillStyle = "#140814cc";
  roundRect(ctx, meterX, meterY, 10, meterH, 4);
  ctx.fill();
  ctx.strokeStyle = "#ff2ec888";
  ctx.lineWidth = 1;
  ctx.stroke();
  const fillH = meterH * pull;
  glow(ctx, COLORS.magenta, 10);
  ctx.fillStyle = pull > 0.8 ? COLORS.amber : COLORS.magenta;
  ctx.fillRect(meterX + 1, meterY + meterH - fillH, 8, fillH);
  noGlow(ctx);
}

export function drawTable(ctx: CanvasRenderingContext2D, state: DrawState): void {
  ctx.clearRect(0, 0, TABLE_W, TABLE_H);
  drawCabinet(ctx);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const bumper of state.table.bumpers) drawVortexFlash(ctx, bumper);
  drawSaucerFlash(ctx, state.table.saucer);
  ctx.restore();

  drawLaneLights(ctx, state.table.lanes, state.skillLane);
  for (const target of state.table.targets) drawTargetGlow(ctx, target);

  for (const sling of state.table.slings) {
    if (sling.flash <= 0) continue;
    glow(ctx, COLORS.cyan, 16);
    ctx.strokeStyle = "#fff";
    ctx.globalAlpha = sling.flash;
    ctx.lineWidth = 8;
    ctx.beginPath();
    if (sling.id === "left") {
      ctx.moveTo(150, 750);
      ctx.lineTo(210, 860);
    } else {
      ctx.moveTo(468, 750);
      ctx.lineTo(408, 860);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    noGlow(ctx);
  }

  if (state.kickbackLit) {
    glow(ctx, COLORS.lime, 16);
    ctx.fillStyle = COLORS.lime;
    ctx.font = "700 11px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("KICKBACK", 126, 918);
    noGlow(ctx);
  }

  drawPlunger(ctx, state.plunger, state.table.launchSpawn.x);
  coverPaintedFlippers(ctx);

  if (state.ball) drawBall(ctx, state.ball.x, state.ball.y);

  drawFlipper(ctx, state.table.leftFlipper);
  drawFlipper(ctx, state.table.rightFlipper);

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
    ctx.fillText(state.message, PLAY_CENTER, 660);
    noGlow(ctx);
    ctx.restore();
  }
}
