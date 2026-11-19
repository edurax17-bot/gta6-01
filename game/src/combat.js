// Combat: bullets, muzzle flashes, explosions and the particle bursts
// that make crashes and shootouts feel alive. No gore — hits are sparks
// and a knocked-down pedestrian who gets back up and runs.
import { distance } from './random.js';

export function makeBullet(x, y, angle, speed, owner, damage = 34) {
  return { x, y, angle, speed, owner, damage, life: 0.9, dead: false };
}

export function fireBullet(list, x, y, angle, owner) {
  list.push(makeBullet(x + Math.cos(angle) * 24, y + Math.sin(angle) * 24, angle, 640, owner));
  return list[list.length - 1];
}

export function updateBullets(bullets, dt, city, targets) {
  // targets: [{x, y, radius, hit(damage, from)}] — cars, peds, rivals, player.
  for (const b of bullets) {
    b.life -= dt;
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > 3700 || b.y > 2700) { b.dead = true; continue; }
    for (const t of targets) {
      if (t.dead || t.owner === b.owner) continue;
      if (distance(b.x, b.y, t.x, t.y) < t.radius + 6) {
        t.hit(b.damage, b.owner);
        b.dead = true;
        break;
      }
    }
    if (!b.dead) {
      for (const building of city.buildings) {
        if (b.x > building.x && b.x < building.x + building.w && b.y > building.y && b.y < building.y + building.h) {
          b.dead = true;
          break;
        }
      }
    }
  }
  return bullets.filter((b) => !b.dead);
}

// Particles: exhaust puffs, crash sparks, muzzle flashes, explosions.
export function makeParticles() {
  return [];
}

export function spawnBurst(particles, x, y, color, count, speed = 160) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random() * 0.7);
    particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: 0.4 + Math.random() * 0.5, maxLife: 0.9,
      size: 2 + Math.random() * 4, color,
    });
  }
}

export function spawnSmoke(particles, x, y) {
  particles.push({
    x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 10,
    vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 30,
    life: 0.9, maxLife: 0.9, size: 6 + Math.random() * 6, color: '#555555',
  });
}

export function updateParticles(particles, dt) {
  for (const p of particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= (1 - 2 * dt);
    p.vy *= (1 - 2 * dt);
  }
  return particles.filter((p) => p.life > 0);
}
