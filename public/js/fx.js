// Hiệu ứng phản hồi tức thì: dòng thông báo, chữ bay, hạt, banner lớn, rung màn hình.
import { W, FIELD, BASE_Y, COLORS, TEAM_LABEL, teamColor } from './layout.js';
import { outlinedText, roundRect, truncate } from './text.js';

const FEED_MAX = 5;
const FEED_TTL = 6000;
const FEED_Y = 1190;
const MAX_FLOATERS = 8;
const UNIT_LABEL = { soldier: 'lính', archer: 'cung thủ', knight: 'hiệp sĩ', giant: 'người khổng lồ' };
const enemyOf = (team) => (team === 'red' ? 'blue' : 'red');

export function createFx() {
  let feed = [];
  let floaters = [];
  let particles = [];
  let banners = [];
  let flyers = [];
  let shakeUntil = 0;

  const addFeed = (text, color, now) => {
    feed = [{ text, color, born: now }, ...feed].slice(0, FEED_MAX);
  };
  const addFloater = (text, team, color, now, size = 40) => {
    const x = W / 2 + (Math.random() - 0.5) * 520;
    const y = BASE_Y[team] + (team === 'red' ? -100 : 100) + (Math.random() - 0.5) * 60;
    floaters = [...floaters, { text, team, x, y, color, born: now, ttl: 1600, size }].slice(-MAX_FLOATERS);
  };
  const burst = (x, y, color, count, now, speed = 400) => {
    const created = Array.from({ length: count }, () => {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random());
      return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, color, born: now, ttl: 700 + Math.random() * 500 };
    });
    particles = [...particles, ...created].slice(-600);
  };
  const banner = (title, subtitle, color, now, ttl = 2600) => {
    banners = [...banners, { title, subtitle, color, born: now, ttl }].slice(-2);
  };

  const HANDLERS = {
    join: (e, now) => {
      addFeed(`${truncate(e.name, 16)} vào phe ${TEAM_LABEL[e.team]}`, teamColor(e.team), now);
      addFloater(`👋 ${truncate(e.name, 14)}`, e.team, teamColor(e.team), now, 34);
    },
    spawn: (e, now) => {
      // Lính thường chỉ loé sáng; chỉ quân mạnh mới hiện chữ để màn hình không bị rối.
      const big = e.unitType === 'giant' || e.unitType === 'knight';
      if (big) addFloater(`+${e.count} ${UNIT_LABEL[e.unitType]} · ${truncate(e.name, 12)}`, e.team, COLORS.gold, now, 44);
      burst(W / 2 + (Math.random() - 0.5) * 700, BASE_Y[e.team], teamColor(e.team), big ? 40 : 6, now, big ? 400 : 160);
    },
    gift: (e, now) => addFeed(`🎁 ${truncate(e.name, 14)} tặng ${e.count}× ${e.giftName}`, COLORS.gold, now),
    dragon: (e, now) => {
      banner(`🐉 RỒNG CỦA ${truncate(e.name, 14).toUpperCase()}`, `quét sạch phe ${TEAM_LABEL[enemyOf(e.team)]}!`, teamColor(e.team), now, 3200);
      flyers = [...flyers, { emoji: '🐉', team: e.team, born: now, ttl: 2200, label: e.name }];
      shakeUntil = now + 900;
    },
    meteor: (e, now) => {
      banner('☄️ SIÊU CHIÊU CỘNG ĐỒNG', `cả phe ${TEAM_LABEL[e.team]} đã mở khoá!`, teamColor(e.team), now);
      const targetY = BASE_Y[enemyOf(e.team)];
      for (let i = 0; i < 6; i += 1) burst(120 + i * 170, targetY + (Math.random() - 0.5) * 200, COLORS.gold, 25, now, 600);
      shakeUntil = now + 600;
    },
    heal: (e, now) => {
      if (e.amount <= 0) return;
      addFloater(`💚 +${Math.round(e.amount)} ${truncate(e.name, 12)}`, e.team, COLORS.heal, now, 38);
      addFeed(`${truncate(e.name, 16)} ${e.reason === 'share' ? 'chia sẻ' : 'theo dõi'} → hồi máu nhà`, COLORS.heal, now);
    },
    rally: (e, now) => {
      const key = e.team === 'red' ? '1' : '2';
      banner(`⚔️ PHẢN CÔNG!`, `${e.count} dân quân phe ${TEAM_LABEL[e.team]} xuất trận · gõ ${key} để giữ thành!`, teamColor(e.team), now, 3000);
      addFeed(`🛡️ Lâu đài ${TEAM_LABEL[e.team]} tung ${e.count} dân quân!`, teamColor(e.team), now);
      for (let i = 0; i < 5; i += 1) burst(160 + i * 190, BASE_Y[e.team], teamColor(e.team), 18, now, 500);
      shakeUntil = now + 400;
    },
    final_rush: (_e, now) => {
      banner('🔥 30 GIÂY CUỐI 🔥', 'TỔNG TẤN CÔNG — tường thành yếu đi, giữ nhà ngay!', '#ff6b3d', now, 3200);
      shakeUntil = now + 700;
    },
    golden_start: (_e, now) => banner('⚡ GIỜ VÀNG X2 ⚡', 'mọi tương tác sinh gấp đôi quân trong 30 giây!', COLORS.gold, now, 3000),
    level_up: (e, now) => addFeed(`⭐ ${truncate(e.name, 16)} lên cấp ${e.level}!`, COLORS.gold, now),
    phase: (e, now) => {
      if (e.phase === 'battle') banner('⚔️ CHIẾN!', 'gõ 1 hoặc 2 để vào phe', COLORS.text, now, 1800);
    },
  };

  return {
    handleEvent(event, now) {
      HANDLERS[event.type]?.(event, now);
    },
    shake(now) {
      if (now > shakeUntil) return { x: 0, y: 0 };
      const k = (shakeUntil - now) / 900;
      return { x: (Math.random() - 0.5) * 30 * k, y: (Math.random() - 0.5) * 30 * k };
    },
    update(dt, now) {
      particles = particles
        .filter((p) => now - p.born < p.ttl)
        .map((p) => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, vx: p.vx * 0.94, vy: p.vy * 0.94 }));
      floaters = floaters.filter((f) => now - f.born < f.ttl).slice(-40);
      banners = banners.filter((b) => now - b.born < b.ttl);
      flyers = flyers.filter((f) => now - f.born < f.ttl);
      feed = feed.filter((f) => now - f.born < FEED_TTL);
    },
    draw(ctx, now, feedY = FEED_Y) {
      drawParticles(ctx, particles, now);
      drawFlyers(ctx, flyers, now);
      drawFloaters(ctx, floaters, now);
      drawFeed(ctx, feed, now, feedY);
      drawBanners(ctx, banners, now);
    },
  };
}

function drawParticles(ctx, particles, now) {
  ctx.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    const life = 1 - (now - p.born) / p.ttl;
    ctx.globalAlpha = life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3 + life * 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function drawFloaters(ctx, floaters, now) {
  for (const f of floaters) {
    const t = (now - f.born) / f.ttl;
    const dir = f.team === 'red' ? -1 : 1; // bay vào giữa sân, không đè lên lâu đài
    ctx.globalAlpha = 1 - t * t;
    outlinedText(ctx, f.text, f.x, f.y + dir * t * 160, { size: f.size, color: f.color });
  }
  ctx.globalAlpha = 1;
}

function drawFlyers(ctx, flyers, now) {
  for (const f of flyers) {
    const t = (now - f.born) / f.ttl;
    const fromY = f.team === 'red' ? FIELD.bottom : FIELD.top;
    const toY = f.team === 'red' ? FIELD.top - 200 : FIELD.bottom + 200;
    const y = fromY + (toY - fromY) * t;
    const x = W / 2 + Math.sin(t * Math.PI * 3) * 220;
    outlinedText(ctx, f.emoji, x, y, { size: 260, stroke: 0 });
    outlinedText(ctx, truncate(f.label, 16), x, y + 150, { size: 44, color: COLORS.gold });
  }
}

function drawFeed(ctx, feed, now, feedY) {
  feed.forEach((item, i) => {
    const age = now - item.born;
    ctx.globalAlpha = Math.min(1, (FEED_TTL - age) / 800) * Math.min(1, age / 150);
    const y = feedY + i * 44;
    ctx.fillStyle = 'rgba(18, 13, 34, 0.72)';
    roundRect(ctx, 24, y - 19, 440, 38, 19);
    ctx.fill();
    ctx.fillStyle = item.color;
    roundRect(ctx, 24, y - 19, 8, 38, 4);
    ctx.fill();
    outlinedText(ctx, truncate(item.text, 28), 44, y + 1, { size: 24, color: item.color, align: 'left', stroke: 5 });
  });
  ctx.globalAlpha = 1;
}

function drawBanners(ctx, banners, now) {
  banners.forEach((b, i) => {
    const age = now - b.born;
    const scale = age < 200 ? 0.6 + (age / 200) * 0.4 : 1;
    const alpha = Math.min(1, (b.ttl - age) / 400);
    const y = 820 + i * 220;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(W / 2, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    roundRect(ctx, -500, -95, 1000, 190, 30);
    ctx.fill();
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 6;
    ctx.stroke();
    outlinedText(ctx, b.title, 0, -28, { size: 72, color: b.color });
    outlinedText(ctx, b.subtitle, 0, 50, { size: 36, color: COLORS.text, weight: 700 });
    ctx.restore();
  });
}
