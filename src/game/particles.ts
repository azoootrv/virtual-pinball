export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
};

export type ScorePopup = {
  x: number;
  y: number;
  text: string;
  life: number;
};

export function burst(
  particles: Particle[],
  x: number,
  y: number,
  color: string,
  count = 14,
  speed = 4,
): void {
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const mag = speed * (0.4 + Math.random());
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * mag,
      vy: Math.sin(angle) * mag,
      life: 0.7 + Math.random() * 0.4,
      size: 1.6 + Math.random() * 2.8,
      color,
    });
  }
}

export function tickFx(particles: Particle[], popups: ScorePopup[], dt: number): void {
  for (const particle of particles) {
    particle.x += particle.vx * dt * 60;
    particle.y += particle.vy * dt * 60;
    particle.vy += 6 * dt;
    particle.life -= dt;
  }
  for (const popup of popups) {
    popup.y -= 28 * dt;
    popup.life -= dt;
  }
  prune(particles);
  prune(popups);
}

function prune<T extends { life: number }>(items: T[]): void {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    if (items[i].life <= 0) items.splice(i, 1);
  }
}
