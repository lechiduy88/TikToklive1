// Hiệu ứng phản hồi tức thì cho SEA Games: dòng thông báo có cờ, chữ bay theo cột đội, banner, pháo giấy, diễu hành cờ.
import { W } from '../layout.js';
import { shape, rrect } from '../paint.js';
import { outlinedText, truncate } from '../text.js';
import { teamOf, columnX, MEDAL_EMOJI } from './teams.js';
import { drawFlag } from './flags.js';
import { FEED_AREA } from './hud.js';

const FEED_MAX = 3;
const FEED_TTL = 7000;
const MAX_FLOATERS = 14;
const MAX_CONFETTI = 500;
const PLACE_MEDAL = ['gold', 'silver', 'bronze'];
const CONFETTI_COLORS = ['#ffd54a', '#e8384f', '#3d6bff', '#16b39a', '#ff8c1a', '#ffffff'];
const BANNER_Y = 760;
const CEREMONY_BANNER_Y = 440;

export function createSeaFx() {
  let feed = [];
  let floaters = [];
  let banners = [];
  let confetti = [];
  let parades = [];
  let shakeUntil = 0;

  const addFeed = (team, text, now) => { feed = [{ team, text, born: now }, ...feed].slice(0, FEED_MAX); };
  const addFloater = (team, text, now, { size = 36, color, y = 1290 } = {}) => {
    const x = columnX(team) + (Math.random() - 0.5) * 60;
    floaters = [...floaters, { text, x, y, color: color ?? teamOf(team).light, born: now, ttl: 1500, size }].slice(-MAX_FLOATERS);
  };
  const banner = (title, subtitle, team, now, ttl = 2600) => { banners = [...banners, { title, subtitle, team, born: now, ttl }].slice(-2); };
  const burst = (count, now) => {
    const pieces = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: 180 + Math.random() * 100, vx: (Math.random() - 0.5) * 300, vy: 200 + Math.random() * 400,
      spin: Math.random() * 6, color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)], born: now, ttl: 2600,
    }));
    confetti = [...confetti, ...pieces].slice(-MAX_CONFETTI);
  };

  const HANDLERS = {
    join: (e, now) => addFeed(e.team, `${truncate(e.name, 14)} vào đội ${teamOf(e.team).name}`, now),
    gift: (e, now) => {
      addFeed(e.team, `🎁 ${truncate(e.name, 12)} tặng ${e.count}× ${truncate(e.giftName, 10)}`, now);
      addFloater(e.team, `🎁 ${truncate(e.name, 8)}`, now, { size: e.tier === 'small' ? 30 : 42, color: '#ffd54a' });
      if (e.tier === 'small') return;
      banner(`🎁 ${truncate(e.name, 14).toUpperCase()}`, `tiếp sức cho ${teamOf(e.team).name}!`, e.team, now, 2800);
      if (e.tier === 'mega') {
        parades = [...parades, { team: e.team, name: e.name, born: now, ttl: 3200 }].slice(-2);
        shakeUntil = now + 700;
        burst(120, now);
      }
    },
    underdog: (e, now) => {
      const t = teamOf(e.team);
      banner(`🔥 ${t.name.toUpperCase()} LỘI NGƯỢC DÒNG!`, `sức tiếp ×${e.multiplier} · gõ ${t.short} để tiếp sức!`, e.team, now, 2600);
      addFeed(e.team, `🔥 ${t.name} được tiếp sức ×${e.multiplier}`, now);
    },
    banked: (e, now) => {
      if (e.amount >= 5) addFeed(e.team, `💰 ${truncate(e.name, 12)}: +${e.amount} để dành cho môn sau`, now);
    },
    cheer: (e, now) => addFeed(e.team, `${truncate(e.name, 14)} ${e.kind === 'share' ? 'chia sẻ live' : 'theo dõi'} → tiếp sức!`, now),
    finish: (e, now) => {
      const medal = MEDAL_EMOJI[PLACE_MEDAL[e.place - 1]] ?? '🏁';
      banner(`${medal} ${teamOf(e.team).name.toUpperCase()} VỀ ĐÍCH!`, `hạng ${e.place}`, e.team, now, 2400);
    },
    volley: (e, now) => {
      for (const r of e.results) addFloater(r.team, r.score === 0 ? 'trượt' : `+${r.score}`, now, { y: 1010, size: r.score >= 9 ? 48 : 34, color: r.score === 10 ? '#ffd54a' : undefined });
      const bull = e.results.find((r) => r.score === 10);
      if (bull) banner('🎯 HỒNG TÂM!', `${teamOf(bull.team).name} bắn 10 điểm`, bull.team, now, 1800);
    },
    eliminated: (e, now) => {
      banner(`❌ ${teamOf(e.team).name.toUpperCase()} BỊ LOẠI`, `lượt ${e.round} · còn lại tiếp tục nâng!`, e.team, now, 2200);
      shakeUntil = now + 300;
    },
    event_start: (_e, now) => banner('BẮT ĐẦU!', 'comment · thả tim · tặng quà để tiếp sức đội nhà', null, now, 1500),
    podium: (e, now) => {
      // Bục trao huy chương đã nói đủ; chỉ thêm pháo giấy và một dòng thông báo.
      burst(160, now);
      if (e.medals.gold) addFeed(e.medals.gold, `🥇 ${teamOf(e.medals.gold).name} giành Huy chương Vàng!`, now);
    },
    closing: (_e, now) => burst(300, now),
    level_up: (e, now) => addFeed(null, `⭐ ${truncate(e.name, 14)} lên cấp ${e.level}!`, now),
  };

  return {
    handleEvent(event, now) {
      HANDLERS[event.type]?.(event, now);
    },
    shake(now) {
      if (now > shakeUntil) return { x: 0, y: 0 };
      const k = (shakeUntil - now) / 700;
      return { x: (Math.random() - 0.5) * 26 * k, y: (Math.random() - 0.5) * 26 * k };
    },
    update(dt, now) {
      confetti = confetti
        .filter((p) => now - p.born < p.ttl)
        .map((p) => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, vx: p.vx * 0.99, spin: p.spin + dt * 8 }));
      floaters = floaters.filter((f) => now - f.born < f.ttl);
      banners = banners.filter((b) => now - b.born < b.ttl);
      parades = parades.filter((p) => now - p.born < p.ttl);
      feed = feed.filter((f) => now - f.born < FEED_TTL);
    },
    /** ceremony = true ở các màn nghi lễ: banner đưa lên cao, ẩn chữ bay theo cột để không che bục/cờ. */
    drawOverlay(ctx, now, { ceremony = false } = {}) {
      drawParades(ctx, parades, now);
      if (!ceremony) drawFloaters(ctx, floaters, now);
      drawBanners(ctx, banners, now, ceremony ? CEREMONY_BANNER_Y : BANNER_Y);
      drawConfetti(ctx, confetti, now);
    },
    drawFeed(ctx, now) {
      drawFeedList(ctx, feed, now);
    },
  };
}

function drawFloaters(ctx, floaters, now) {
  for (const f of floaters) {
    const t = (now - f.born) / f.ttl;
    ctx.globalAlpha = 1 - t * t;
    outlinedText(ctx, f.text, f.x, f.y - t * 140, { size: f.size, color: f.color, stroke: 6 });
  }
  ctx.globalAlpha = 1;
}

function drawBanners(ctx, banners, now, baseY) {
  banners.forEach((b, i) => {
    const age = now - b.born;
    const scale = age < 180 ? 0.6 + (age / 180) * 0.4 : 1;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (b.ttl - age) / 350);
    ctx.translate(W / 2, baseY + i * 210);
    ctx.scale(scale, scale);
    const color = b.team ? teamOf(b.team).color : '#ffd54a';
    shape(ctx, rrect(-480, -90, 960, 180, 32), 'rgba(12,8,24,0.82)', 0);
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.stroke();
    if (b.team) drawFlag(ctx, b.team, -450, -48, 120, 80, now, 0.1);
    const textX = b.team ? 60 : 0;
    outlinedText(ctx, b.title, textX, -24, { size: 60, color: '#ffd54a' });
    outlinedText(ctx, b.subtitle, textX, 48, { size: 32, stroke: 6, weight: 700 });
    ctx.restore();
  });
}

function drawParades(ctx, parades, now) {
  for (const p of parades) {
    const t = (now - p.born) / p.ttl;
    const x = -700 + t * (W + 1400);
    ctx.globalAlpha = Math.min(1, (1 - t) * 4);
    drawFlag(ctx, p.team, x - 330, 330, 660, 440, now, 0.16);
    outlinedText(ctx, `${truncate(p.name, 14)} · ${teamOf(p.team).name}`, x, 820, { size: 54, color: '#ffd54a' });
    ctx.globalAlpha = 1;
  }
}

function drawConfetti(ctx, confetti, now) {
  for (const p of confetti) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, (p.ttl - (now - p.born)) / 600);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.spin);
    ctx.fillStyle = p.color;
    ctx.fillRect(-7, -4, 14, 8);
    ctx.restore();
  }
}

function drawFeedList(ctx, feed, now) {
  feed.forEach((item, i) => {
    const age = now - item.born;
    ctx.globalAlpha = Math.min(1, (FEED_TTL - age) / 700) * Math.min(1, age / 150);
    const y = FEED_AREA.y + i * 48;
    shape(ctx, rrect(FEED_AREA.x, y, FEED_AREA.w, 42, 21), 'rgba(255,255,255,0.07)', 0);
    if (item.team) drawFlag(ctx, item.team, FEED_AREA.x + 12, y + 7, 42, 28, now, 0);
    const color = item.team ? teamOf(item.team).light : '#ffd54a';
    outlinedText(ctx, truncate(item.text, 46), FEED_AREA.x + 68, y + 22, { size: 26, color, align: 'left', stroke: 5 });
  });
  ctx.globalAlpha = 1;
}
