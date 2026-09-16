import "./style.css";
import { PinballGame } from "./game/game.ts";
import { Input } from "./game/input.ts";
import { LANE_INNER, TABLE_H, TABLE_W } from "./game/constants.ts";

function must<T>(value: T | null, name: string): T {
  if (!value) throw new Error(`ARC LIGHT failed to mount: missing ${name}.`);
  return value;
}

const canvas = must(document.querySelector<HTMLCanvasElement>("#table"), "canvas");
const overlay = must(document.querySelector<HTMLDivElement>("#overlay"), "overlay");
const overlayTitle = must(document.querySelector<HTMLHeadingElement>("#overlay-title"), "title");
const overlayBody = must(document.querySelector<HTMLParagraphElement>("#overlay-body"), "body copy");
const overlayKicker = must(document.querySelector<HTMLParagraphElement>("#overlay-kicker"), "kicker");
const startBtn = must(document.querySelector<HTMLButtonElement>("#start-btn"), "start button");
const hint = must(document.querySelector<HTMLParagraphElement>("#hint"), "hint");
const muteBtn = must(document.querySelector<HTMLButtonElement>("#mute-btn"), "mute button");
const scoreEl = must(document.querySelector<HTMLElement>("#score"), "score");
const highEl = must(document.querySelector<HTMLElement>("#high"), "high score");
const ballsEl = must(document.querySelector<HTMLElement>("#balls"), "balls");
const multEl = must(document.querySelector<HTMLElement>("#mult"), "multiplier");
const powerFill = must(document.querySelector<HTMLElement>("#power-fill"), "power fill");
const powerPct = must(document.querySelector<HTMLElement>("#power-pct"), "power percent");
const powerTrack = must(document.querySelector<HTMLElement>("#power-track"), "power track");
const ctx = must(canvas.getContext("2d"), "2d context");

const game = new PinballGame();
const input = new Input();
input.attach(window);
canvas.tabIndex = 0;
input.bindCanvas(canvas, TABLE_W, TABLE_H, LANE_INNER);

const touchLeft = document.querySelector<HTMLButtonElement>("#touch-left");
const touchRight = document.querySelector<HTMLButtonElement>("#touch-right");
const touchPlunge = document.querySelector<HTMLButtonElement>("#touch-plunge");
if (touchLeft) input.bindHold(touchLeft, "left");
if (touchRight) input.bindHold(touchRight, "right");
if (touchPlunge) input.bindHold(touchPlunge, "plunge");
input.bindPowerBar(powerTrack);

function pad(value: number): string {
  return Math.max(0, Math.floor(value)).toString().padStart(7, "0");
}

function syncHud(): void {
  const hud = game.hud();
  if (game.hudDirty) {
    scoreEl.textContent = pad(hud.score);
    highEl.textContent = pad(hud.high);
    ballsEl.textContent = String(hud.balls);
    multEl.textContent = `${hud.mult}×`;
    game.hudDirty = false;
  }
  const pct = Math.round(hud.plunger * 100);
  powerFill.style.width = `${pct}%`;
  powerPct.textContent = `${pct}%`;
  powerTrack.setAttribute("aria-valuenow", String(pct));
}

function setOverlay(mode: "attract" | "hidden" | "game-over", score = 0): void {
  overlay.dataset.mode = mode;
  overlay.hidden = mode === "hidden";
  if (mode === "attract") {
    overlayKicker.textContent = "Insert coin";
    overlayTitle.textContent = "ARC LIGHT";
    overlayBody.textContent =
      "Charge the plunger, slap the flippers, and complete A-R-C for a hotter multiplier. Light the left bank to arm kickback.";
    startBtn.textContent = "Press Start";
    hint.textContent = "Drag the power bar or hold Plunge / Space, then release to launch.";
  }
  if (mode === "game-over") {
    overlayKicker.textContent = "Tilt-free finish";
    overlayTitle.textContent = "GAME OVER";
    overlayBody.textContent = `Final score ${pad(score)}. High score ${pad(game.highScore)}. Plunge again and chase the extra ball.`;
    startBtn.textContent = "Play Again";
    hint.textContent = "Enter or Press Start to run another 3-ball game.";
  }
}

function begin(): void {
  if (game.phase !== "attract" && game.phase !== "game-over") return;
  game.audio.unlock();
  game.startGame();
  setOverlay("hidden");
  hint.textContent = "Skill shot: hit the lit A-R-C lane right after launch.";
}

startBtn.addEventListener("click", begin);
muteBtn.addEventListener("click", () => {
  const muted = game.audio.toggleMute();
  muteBtn.textContent = muted ? "Sound off" : "Sound on";
  muteBtn.setAttribute("aria-pressed", String(muted));
});

window.addEventListener("pointerdown", () => game.audio.unlock(), { once: true });

function resize(): void {
  const stage = canvas.parentElement;
  if (!stage) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = TABLE_W * dpr;
  canvas.height = TABLE_H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

resize();
window.addEventListener("resize", resize);

let last = performance.now();
let overlayMode: "attract" | "hidden" | "game-over" = "attract";
setOverlay("attract");
syncHud();
game.hudDirty = true;
syncHud();

function frame(now: number): void {
  const dt = now - last;
  last = now;

  if ((game.phase === "attract" || game.phase === "game-over") && input.consumeStart()) {
    begin();
  } else {
    input.consumeStart();
  }

  game.step(dt, input);
  game.draw(ctx);
  syncHud();

  if (game.phase === "game-over" && overlayMode !== "game-over") {
    overlayMode = "game-over";
    setOverlay("game-over", game.score);
  } else if (game.phase !== "game-over" && game.phase !== "attract" && overlayMode !== "hidden") {
    overlayMode = "hidden";
    setOverlay("hidden");
  } else if (game.phase === "attract" && overlayMode !== "attract") {
    overlayMode = "attract";
    setOverlay("attract");
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
