import Matter from "matter-js";
import { TableAudio } from "./audio.ts";
import {
  BALLS_PER_GAME,
  CAT,
  COLORS,
  EXTRA_BALL_AT,
  HIGH_SCORE_KEY,
  LANE_INNER,
  LANE_OUTER,
  PLAY_CENTER,
  TABLE_H,
  TABLE_W,
} from "./constants.ts";
import type { Input } from "./input.ts";
import { closestOnSegment, flipperCapsule, separateBallFromFlipper } from "./flipper.ts";
import { burst, tickFx, type Particle, type ScorePopup } from "./particles.ts";
import { drawTable } from "./render.ts";
import { buildTable, makeBall, type FlipperDef, type TableParts } from "./table.ts";

const { Engine, Body, Composite, Events, Vector } = Matter;

export type Phase = "attract" | "plunging" | "live" | "ball-lost" | "game-over";

const STEP = 1000 / 60;
const MAX_BALL_SPEED = 38;
const FLIPPER_ZONE_Y = 760;
const FLIPPER_ZONE_SPEED = 22;

function readHighScore(): number {
  const raw = localStorage.getItem(HIGH_SCORE_KEY);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) ? value : 0;
}

export class PinballGame {
  readonly engine: Matter.Engine;
  readonly table: TableParts;
  readonly audio = new TableAudio();
  readonly particles: Particle[] = [];
  readonly popups: ScorePopup[] = [];

  phase: Phase = "attract";
  score = 0;
  highScore = readHighScore();
  ballsLeft = BALLS_PER_GAME;
  multiplier = 1;
  plunger = 0;
  private powerParked = false;
  gateClosed = false;
  kickbackLit = false;
  extraAwarded = false;
  skillLane = 1;
  skillArmed = false;
  message = "ARC LIGHT";
  messageLife = 2;
  hudDirty = true;

  private ball: Matter.Body | null = null;
  private prevBallX = 0;
  private prevBallY = 0;
  private accumulator = 0;
  private combo = 0;
  private comboTimer = 0;
  private prevLeft = false;
  private prevRight = false;
  private prevPlunge = false;
  private leftJustPressed = false;
  private rightJustPressed = false;
  private waitTimer = 0;

  constructor() {
    this.engine = Engine.create({
      gravity: { x: 0, y: 1.15, scale: 0.0012 },
      positionIterations: 16,
      velocityIterations: 12,
    });
    this.table = buildTable(this.engine.world);
    this.bindCollisions();
    this.serveBall();
  }

  startGame(): void {
    this.score = 0;
    this.ballsLeft = BALLS_PER_GAME;
    this.multiplier = 1;
    this.extraAwarded = false;
    this.kickbackLit = false;
    this.resetLanes();
    this.resetTargets();
    this.phase = "plunging";
    this.serveBall();
    this.flash("BALL 1");
    this.hudDirty = true;
  }

  nextBallOrEnd(): void {
    this.ballsLeft -= 1;
    this.hudDirty = true;
    if (this.ballsLeft <= 0) {
      this.phase = "game-over";
      this.flash("GAME OVER");
      this.audio.drain();
      return;
    }
    this.phase = "plunging";
    this.serveBall();
    this.flash(`BALL ${BALLS_PER_GAME - this.ballsLeft + 1}`);
  }

  step(dtMs: number, input: Input): void {
    const dt = Math.min(dtMs, 48) / 1000;
    this.handleInput(input, dt);
    this.accumulator += Math.min(dtMs, 48);
    while (this.accumulator >= STEP) {
      this.syncFlippers(STEP / 1000, input);
      Engine.update(this.engine, STEP);
      this.afterPhysics();
      this.accumulator -= STEP;
    }
    this.decayFlashes(dt);
    tickFx(this.particles, this.popups, dt);
    this.messageLife = Math.max(0, this.messageLife - dt);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    if (this.waitTimer > 0) {
      this.waitTimer -= dt;
      if (this.waitTimer <= 0 && this.phase === "ball-lost") this.nextBallOrEnd();
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawTable(ctx, {
      table: this.table,
      ball: this.ball ? { x: this.ball.position.x, y: this.ball.position.y } : null,
      particles: this.particles,
      popups: this.popups,
      plunger: this.plunger,
      gateClosed: this.gateClosed,
      kickbackLit: this.kickbackLit,
      skillLane: this.skillArmed ? this.skillLane : -1,
      message: this.message,
      messageLife: this.messageLife,
    });
  }

  hud() {
    return {
      score: this.score,
      high: this.highScore,
      balls: Math.max(0, this.ballsLeft),
      mult: this.multiplier,
      plunger: this.plunger,
      phase: this.phase,
    };
  }

  private handleInput(input: Input, dt: number): void {
    if (input.left && !this.prevLeft) this.audio.flip();
    if (input.right && !this.prevRight) this.audio.flip();
    this.leftJustPressed = this.leftJustPressed || (input.left && !this.prevLeft);
    this.rightJustPressed = this.rightJustPressed || (input.right && !this.prevRight);

    if (this.phase === "plunging" && this.ball) {
      if (input.powerOverride !== null) {
        this.plunger = input.powerOverride;
        this.powerParked = true;
      } else if (input.plunge) {
        this.powerParked = false;
        this.plunger = Math.min(1, this.plunger + dt * 0.48);
      } else if (this.prevPlunge) {
        this.launch();
      } else if (!this.powerParked) {
        this.plunger = Math.max(0, this.plunger - dt * 1.6);
      }
    }

    this.prevLeft = input.left;
    this.prevRight = input.right;
    this.prevPlunge = input.plunge;
  }

  private launch(): void {
    if (!this.ball || this.phase !== "plunging") return;
    const power = Math.max(0, Math.min(1, this.plunger));
    const scaled = power ** 1.6;
    Body.setVelocity(this.ball, { x: 0, y: -4.5 - scaled * 38 });
    Body.setPosition(this.ball, {
      x: this.table.launchSpawn.x,
      y: this.table.launchSpawn.y - 24,
    });
    this.rememberBall();
    this.plunger = 0;
    this.powerParked = false;
    this.skillArmed = true;
    this.skillLane = Math.floor(Math.random() * 3);
    this.audio.plunge();
    this.flash("SKILL SHOT");
    this.phase = "live";
  }

  private serveBall(): void {
    this.removeBall();
    this.openGate();
    this.plunger = 0;
    this.powerParked = false;
    this.skillArmed = false;
    this.combo = 0;
    const spawn = this.table.launchSpawn;
    this.ball = makeBall(spawn.x, spawn.y);
    Composite.add(this.engine.world, this.ball);
    this.rememberBall();
  }

  private parkDemoBall(): void {
    this.serveBall();
  }

  private removeBall(): void {
    if (!this.ball) return;
    Composite.remove(this.engine.world, this.ball);
    this.ball = null;
  }

  private syncFlippers(dt: number, input: Input): void {
    moveFlipper(this.table.leftFlipper, input.left, dt);
    moveFlipper(this.table.rightFlipper, input.right, dt);
  }

  private rememberBall(): void {
    if (!this.ball) return;
    this.prevBallX = this.ball.position.x;
    this.prevBallY = this.ball.position.y;
  }

  private applyFlipperKick(ball: Matter.Body): void {
    const kick = (side: "left" | "right"): void => {
      const flipper = side === "left" ? this.table.leftFlipper : this.table.rightFlipper;
      const justPressed = side === "left" ? this.leftJustPressed : this.rightJustPressed;
      if (!justPressed) return;
      const cap = flipperCapsule(flipper);
      const closest = closestOnSegment(ball.position.x, ball.position.y, cap.ax, cap.ay, cap.bx, cap.by);
      const dist = Math.hypot(ball.position.x - closest.x, ball.position.y - closest.y);
      if (dist > cap.radius + 52) return;
      const angle = flipper.body.angle;
      let nx = -Math.sin(angle);
      let ny = Math.cos(angle);
      if (ny > 0) {
        nx = -nx;
        ny = -ny;
      }
      const launch = 38;
      const inward = side === "left" ? 4.5 : -4.5;
      Body.setPosition(ball, {
        x: ball.position.x,
        y: closest.y + ny * (cap.radius + 12),
      });
      Body.setVelocity(ball, {
        x: ball.velocity.x * 0.25 + nx * launch + inward,
        y: ball.velocity.y * 0.25 + ny * launch,
      });
    };
    kick("left");
    kick("right");
    this.leftJustPressed = false;
    this.rightJustPressed = false;
  }

  private afterPhysics(): void {
    const ball = this.ball;
    if (!ball) return;

    const onPlayfield = ball.position.x < LANE_INNER - 4;
    const maxSpeed =
      onPlayfield && ball.position.y > FLIPPER_ZONE_Y ? FLIPPER_ZONE_SPEED : MAX_BALL_SPEED;
    const speed = Vector.magnitude(ball.velocity);
    if (speed > maxSpeed) {
      Body.setVelocity(ball, Vector.mult(Vector.normalise(ball.velocity), maxSpeed));
    }

    if (onPlayfield) {
      const prev = { x: this.prevBallX, y: this.prevBallY };
      separateBallFromFlipper(ball, this.table.leftFlipper, prev);
      separateBallFromFlipper(ball, this.table.rightFlipper, prev);
      this.applyFlipperKick(ball);
    }
    this.rememberBall();

    if (this.phase === "live" && ball.position.x < LANE_INNER - 8) {
      this.closeGate();
    }

    const inLane = ball.position.x > LANE_INNER - 2 && ball.position.x < LANE_OUTER + 8;
    if (this.phase === "live" && inLane && ball.position.y < 350 && ball.velocity.y < -1) {
      Body.setVelocity(ball, {
        x: Math.min(ball.velocity.x, -12),
        y: Math.max(ball.velocity.y * 0.88, -8),
      });
    }

    if (this.phase === "live" && ball.position.x > LANE_INNER + 8 && ball.position.y > 620 && ball.velocity.y > 2) {
      this.phase = "plunging";
      this.openGate();
      Body.setVelocity(ball, { x: 0, y: Math.min(ball.velocity.y, 8) });
      this.flash("RE-PLUNGE");
    }

    if (ball.position.y > TABLE_H - 12 || ball.position.x < -40 || ball.position.x > TABLE_W + 40) {
      this.onDrain();
    }
  }

  private bindCollisions(): void {
    Events.on(this.engine, "collisionStart", (event) => {
      for (const pair of event.pairs) {
        const labels = [pair.bodyA.label, pair.bodyB.label];
        const other = pair.bodyA.label === "ball" ? pair.bodyB : pair.bodyA;
        if (!labels.includes("ball")) continue;

        if (other.label.startsWith("bumper:")) {
          const id = Number(other.label.split(":")[1]);
          this.onBumper(id);
        } else if (other.label.startsWith("sling:")) {
          const side = other.label.endsWith("left") ? "left" : "right";
          this.onSling(side);
        } else if (other.label.startsWith("lane:")) {
          const id = Number(other.label.split(":")[1]);
          this.onLane(id);
        } else if (other.label.startsWith("target:")) {
          const id = Number(other.label.split(":")[1]);
          this.onTarget(id);
        } else if (other.label === "launch-turn") {
          this.onLaunchTurn();
        } else if (other.label === "saucer") {
          this.onSaucer();
        } else if (other.label === "kick-target") {
          this.onKickTarget();
        } else if (other.label === "kickback-zone") {
          this.onKickZone();
        } else if (other.label === "drain") {
          this.onDrain();
        }
      }
    });
  }

  private onBumper(id: number): void {
    const bumper = this.table.bumpers[id];
    if (!bumper || !this.ball || this.phase === "attract") return;
    bumper.flash = 1;
    const dir = Vector.normalise(Vector.sub(this.ball.position, bumper.body.position));
    Body.setVelocity(this.ball, Vector.add(this.ball.velocity, Vector.mult(dir, 7.2)));
    this.combo += 1;
    this.comboTimer = 1.15;
    const bonus = this.combo >= 3 ? this.combo * 50 : 0;
    this.addScore(100 + bonus, bumper.body.position.x, bumper.body.position.y - 24);
    burst(this.particles, bumper.body.position.x, bumper.body.position.y, bumper.color, 16, 5);
    this.audio.bumper();
    this.skillArmed = false;
  }

  private onSling(side: "left" | "right"): void {
    const sling = this.table.slings.find((item) => item.id === side);
    if (!sling || !this.ball || this.phase === "attract") return;
    sling.flash = 1;
    const dir = Vector.normalise(Vector.sub(this.ball.position, sling.origin));
    Body.setVelocity(this.ball, Vector.add(this.ball.velocity, Vector.mult(dir, 8.5)));
    this.addScore(10, this.ball.position.x, this.ball.position.y);
    this.audio.sling();
    this.skillArmed = false;
  }

  private onLane(id: number): void {
    const lane = this.table.lanes[id];
    if (!lane || this.phase === "attract") return;
    if (this.skillArmed && this.skillLane === id) {
      this.addScore(5000, lane.body.position.x, lane.body.position.y + 30);
      this.flash("SKILL SHOT");
      this.audio.bonus();
    } else {
      this.addScore(250, lane.body.position.x, lane.body.position.y + 28);
      this.audio.rollover();
    }
    this.skillArmed = false;
    if (!lane.lit) {
      lane.lit = true;
      if (this.table.lanes.every((item) => item.lit)) {
        this.multiplier = Math.min(4, this.multiplier + 1);
        this.addScore(2500, PLAY_CENTER, 220);
        this.flash(`${this.multiplier}× PLAY`);
        this.audio.bonus();
        this.resetLanes();
        this.hudDirty = true;
      }
    }
  }

  private onTarget(id: number): void {
    const target = this.table.targets.find((item) => item.id === id);
    if (!target || target.hit || this.phase === "attract") return;
    target.hit = true;
    target.flash = 1;
    this.addScore(500, target.body.position.x + 16, target.body.position.y);
    this.audio.target();
    this.skillArmed = false;
    const bank = this.table.targets.filter((item) => item.id < 3);
    if (bank.every((item) => item.hit)) {
      this.addScore(3000, 120, 520);
      this.kickbackLit = true;
      this.flash("KICKBACK LIT");
      this.audio.bonus();
      for (const item of bank) item.hit = false;
    }
  }

  private onLaunchTurn(): void {
    if (!this.ball || this.phase !== "live") return;
    if (this.ball.velocity.y >= 0) return;
    Body.setVelocity(this.ball, {
      x: -16,
      y: Math.max(Math.min(this.ball.velocity.y, -6), -10),
    });
  }

  private onSaucer(): void {
    if (!this.ball || this.phase === "attract") return;
    this.table.saucer.flash = 1;
    const pos = this.table.saucer.body.position;
    const dir = Vector.normalise(Vector.sub(this.ball.position, pos));
    Body.setVelocity(this.ball, Vector.add(this.ball.velocity, Vector.mult(dir, 9)));
    this.addScore(1500, pos.x, pos.y - 24);
    burst(this.particles, pos.x, pos.y, COLORS.magenta, 18, 6);
    this.audio.bonus();
    this.skillArmed = false;
  }

  private onKickTarget(): void {
    const target = this.table.targets.find((item) => item.id === 3);
    if (!target || this.phase === "attract") return;
    target.flash = 1;
    target.hit = true;
    this.kickbackLit = true;
    this.addScore(750, 520, 520);
    this.flash("KICKBACK LIT");
    this.audio.target();
    this.skillArmed = false;
  }

  private onKickZone(): void {
    if (!this.kickbackLit || !this.ball || this.phase !== "live") return;
    this.kickbackLit = false;
    Body.setVelocity(this.ball, { x: 4, y: -22 });
    Body.setPosition(this.ball, { x: 130, y: 860 });
    this.rememberBall();
    this.addScore(1000, 130, 860);
    this.flash("KICKBACK");
    this.audio.kickback();
    burst(this.particles, 130, 900, COLORS.lime, 20, 6);
  }

  private onDrain(): void {
    if (this.phase === "attract") {
      this.parkDemoBall();
      return;
    }
    if (this.phase !== "live" && this.phase !== "plunging") return;
    burst(this.particles, this.ball?.position.x ?? PLAY_CENTER, 960, COLORS.drain, 18, 4);
    this.audio.drain();
    this.removeBall();
    this.openGate();
    this.multiplier = 1;
    this.resetLanes();
    this.phase = "ball-lost";
    this.waitTimer = 1.15;
    this.flash("DRAIN");
    this.hudDirty = true;
  }

  private addScore(base: number, x: number, y: number): void {
    if (this.phase === "attract" || this.phase === "game-over") return;
    const gained = base * this.multiplier;
    this.score += gained;
    this.popups.push({ x, y, text: String(gained), life: 0.8 });
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore));
    }
    if (!this.extraAwarded && this.score >= EXTRA_BALL_AT) {
      this.extraAwarded = true;
      this.ballsLeft += 1;
      this.flash("EXTRA BALL");
      this.audio.extraBall();
    }
    this.hudDirty = true;
  }

  private flash(text: string): void {
    this.message = text;
    this.messageLife = 1.6;
  }

  private resetLanes(): void {
    for (const lane of this.table.lanes) lane.lit = false;
  }

  private resetTargets(): void {
    for (const target of this.table.targets) {
      target.hit = false;
      target.flash = 0;
    }
  }

  private decayFlashes(dt: number): void {
    for (const bumper of this.table.bumpers) bumper.flash = Math.max(0, bumper.flash - dt * 3);
    for (const target of this.table.targets) target.flash = Math.max(0, target.flash - dt * 3);
    for (const sling of this.table.slings) sling.flash = Math.max(0, sling.flash - dt * 3.5);
    this.table.saucer.flash = Math.max(0, this.table.saucer.flash - dt * 3);
  }

  private closeGate(): void {
    if (this.gateClosed) return;
    this.gateClosed = true;
    this.table.gate.collisionFilter.mask = CAT.ball;
  }

  private openGate(): void {
    this.gateClosed = false;
    this.table.gate.collisionFilter.mask = 0;
  }
}

function moveFlipper(flipper: FlipperDef, pressed: boolean, dt: number): void {
  const target = pressed ? flipper.upAngle : flipper.restAngle;
  const speed = pressed ? 90 : 34;
  const body = flipper.body as Matter.Body & {
    positionPrev: { x: number; y: number };
    anglePrev: number;
  };
  const current = body.angle;
  const diff = target - current;
  const maxStep = speed * dt;
  const step = Math.abs(diff) <= maxStep ? diff : Math.sign(diff) * maxStep;
  const next = current + step;
  const cx = flipper.pivot.x - flipper.localPivotX * Math.cos(next);
  const cy = flipper.pivot.y - flipper.localPivotX * Math.sin(next);
  const prevX = body.position.x;
  const prevY = body.position.y;
  Body.setPosition(body, { x: cx, y: cy });
  Body.setAngle(body, next);
  body.positionPrev.x = prevX;
  body.positionPrev.y = prevY;
  body.anglePrev = current;
  Body.setVelocity(body, { x: cx - prevX, y: cy - prevY });
  Body.setAngularVelocity(body, step);
}
