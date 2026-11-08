// Hiệu ứng phản hồi tức thì (màn hình ngang): dòng thông báo ở cột phải, chữ bay ra từ hàng của đội
// trong bảng tổng sắp, banner, dải băng bình luận, pháo giấy, diễu hành cờ khi có quà cực lớn.
import { shape, rrect } from '../paint.js';
import { outlinedText, truncate } from '../text.js';
import { teamOf, MEDAL_EMOJI } from './teams.js';
import { drawFlag } from './flags.js';
import { FEED_AREA } from './hud.js';
import { SW, SIDE_X, ARENA, ARENA_W, ARENA_CX } from './stage.js';

const FEED_MAX = 6;
const FEED_LINE = 48;
const FEED_TTL = 8000;
const MAX_FLOATERS = 14;
const MAX_CONFETTI = 500;
const PLACE_MEDAL = ['gold', 'silver', 'bronze'];
const CONFETTI_COLORS = ['#ffd54a', '#e8384f', '#3d6bff', '#16b39a', '#ff8c1a', '#ffffff'];
const BANNER_Y = ARENA.top + 470;
const CEREMONY_BANNER_Y = ARENA.top + 200;
const CALLOUT_TTL = 2200;
const CALLOUT_Y = ARENA.top + 220;
const CALLOUT_SLIDE_MS = 260;
const SHAKE_MS = 700;

export function createSeaFx() {
  let feed = [];
  let floaters = [];
  let banners = [];
  let callouts = [];
  let confetti = [];
  let parades = [];
  let shakeUntil = 0;

  const addFeed = (team, text, now) => { feed = [{ team, text, born: now }, ...feed].slice(0, FEED_MAX); };
  // Chữ bay trượt ra từ hàng của đội trong bảng tổng sắp, sang trái vào sân.
  const addFloater = (team, text, now, { size = 30, color } = {}) => {
    floaters = [...floaters, { team, text, color: color ?? teamOf(team).light, born: now, ttl: 1600, size, jitter: (Math.random() - 0.5) * 20 }].slice(-MAX_FLOATERS);
  };
  // Mỗi lúc chỉ một banner lớn, để không che kín sân thi đấu.
  const banner = (title, subtitle, team, now, ttl = 2600) => { banners = [{ title, subtitle, team, born: now, ttl }]; };
  const burst = (count, now) => {
    const pieces = Array.from({ length: count }, () => ({
      x: Math.random() * SW, y: 80 + Math.random() * 100, vx: (Math.random() - 0.5) * 300, vy: 180 + Math.random() * 380,
      spin: Math.random() * 6, color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)], born: now, ttl: 2600,
    }));
    confetti = [...confetti, ...pieces].slice(-MAX_CONFETTI);
  };

  const HANDLERS = {
    join: (e, now) => addFeed(e.team, `${truncate(e.name, 14)} vào đội ${teamOf(e.team).name}`, now),
    gift: (e, now) => {
      addFeed(e.team, `🎁 ${truncate(e.name, 12)} tặng ${e.count}× ${truncate(e.giftName, 10)}`, now);
      addFloater(e.team, `🎁 ${truncate(e.name, 8)}`, now, { size: e.tier === 'small' ? 28 : 38, color: '#ffd54a' });
      // Banner lớn + diễu hành cờ chỉ dành cho quà cực lớn; quà vừa đã có thông báo + chữ bay.
      if (e.tier === 'mega') {
        banner(`🎁 ${truncate(e.name, 14).toUpperCase()}`, `tiếp sức cho ${teamOf(e.team).name}!`, e.team, now, 2800);
        parades = [...parades, { team: e.team, name: e.name, born: now, ttl: 3200 }].slice(-2);
        shakeUntil = now + SHAKE_MS;
        burst(120, now);
      }
    },
    underdog: (e, now) => {
      const t = teamOf(e.team);
      callouts = [{ text: `🔥 ${t.name.toUpperCase()} LỘI NGƯỢC DÒNG! ×${e.multiplier}`, team: e.team, born: now, ttl: CALLOUT_TTL }];
      addFeed(e.team, `🔥 ${t.name} được tiếp sức ×${e.multiplier} · gõ ${t.short}!`, now);
    },
    banked: (e, now) => {
      if (e.amount >= 5) addFeed(e.team, `💰 ${truncate(e.name, 12)}: +${e.amount} để dành môn sau`, now);
    },
    cheer: (e, now) => addFeed(e.team, `${truncate(e.name, 14)} ${e.kind === 'share' ? 'chia sẻ live' : 'theo dõi'} → tiếp sức!`, now),
    finish: (e, now) => {
      const medal = MEDAL_EMOJI[PLACE_MEDAL[e.place - 1]] ?? '🏁';
      banner(`${medal} ${teamOf(e.team).name.toUpperCase()} VỀ ĐÍCH!`, `hạng ${e.place}`, e.team, now, 2400);
    },
    eliminated: (e, now) => {
      banner(`❌ ${teamOf(e.team).name.toUpperCase()} BỊ LOẠI`, `lượt ${e.round} · các đội còn lại tiếp tục!`, e.team, now, 2200);
      shakeUntil = now + 300;
    },
    dropped: (e, now) => {
      banner(`🏐 ${teamOf(e.team).name.toUpperCase()} RƠI CẦU!`, 'bị loại · các đội còn lại giữ cầu tiếp!', e.team, now, 2200);
      shakeUntil = now + 300;
    },
    throw: (e, now) => {
      const best = [...e.results].sort((a, b) => b.distance - a.distance)[0];
      if (best?.distance > 0) addFeed(best.team, `🎯 Lượt ${e.attempt}: ${teamOf(best.team).name} xa nhất ${best.distance.toFixed(2)} m`, now);
    },
    event_start: (_e, now) => banner('BẮT ĐẦU!', 'comment · thả tim · tặng quà để tiếp sức đội nhà', null, now, 1500),
    podium: (e, now) => {
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
    /** Dải băng bình luận chéo sân (vượt lên dẫn đầu, sắp về đích...). */
    callout(text, team, now) {
      callouts = [{ text, team, born: now, ttl: CALLOUT_TTL }];
    },
    shake(now) {
      if (now > shakeUntil) return { x: 0, y: 0 };
      const k = (shakeUntil - now) / SHAKE_MS;
      return { x: (Math.random() - 0.5) * 22 * k, y: (Math.random() - 0.5) * 22 * k };
    },
    update(dt, now) {
      confetti = confetti
        .filter((p) => now - p.born < p.ttl)
        .map((p) => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, vx: p.vx * 0.99, spin: p.spin + dt * 8 }));
      floaters = floaters.filter((f) => now - f.born < f.ttl);
      banners = banners.filter((b) => now - b.born < b.ttl);
      parades = parades.filter((p) => now - p.born < p.ttl);
      callouts = callouts.filter((c) => now - c.born < c.ttl);
      feed = feed.filter((f) => now - f.born < FEED_TTL);
    },
    /**
     * ceremony = true ở các màn nghi lễ: banner đưa lên cao, ẩn dải bình luận.
     * rowY(team): toạ độ hàng của đội trong bảng tổng sắp (chữ bay xuất phát từ đó).
     */
    drawOverlay(ctx, now, { ceremony = false, rowY = () => ARENA.top + 300 } = {}) {
      drawParades(ctx, parades, now);
      drawFloaters(ctx, floaters, now, rowY);
      drawBanners(ctx, banners, now, ceremony ? CEREMONY_BANNER_Y : BANNER_Y);
      if (!ceremony) drawCallouts(ctx, callouts, now);
      drawConfetti(ctx, confetti, now);
    },
    drawFeed(ctx, now) {
      drawFeedList(ctx, feed, now);
    },
  };
}

function drawFloaters(ctx, floaters, now, rowY) {
  for (const f of floaters) {
    const t = (now - f.born) / f.ttl;
    ctx.globalAlpha = 1 - t * t;
    outlinedText(ctx, f.text, SIDE_X - 30 - t * 200, rowY(f.team) + f.jitter, { size: f.size, color: f.color, stroke: 6, align: 'right' });
  }
  ctx.globalAlpha = 1;
}

function drawBanners(ctx, banners, now, baseY) {
  for (const b of banners) {
    const age = now - b.born;
    const scale = age < 180 ? 0.6 + (age / 180) * 0.4 : 1;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (b.ttl - age) / 350);
    ctx.translate(ARENA_CX, baseY);
    ctx.scale(scale, scale);
    const color = b.team ? teamOf(b.team).color : '#ffd54a';
    shape(ctx, rrect(-560, -88, 1120, 176, 32), 'rgba(12,8,24,0.84)', 0);
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.stroke();
    if (b.team) drawFlag(ctx, b.team, -530, -48, 120, 80, now, 0.1);
    const textX = b.team ? 60 : 0;
    outlinedText(ctx, b.title, textX, -22, { size: 58, color: '#ffd54a' });
    outlinedText(ctx, b.subtitle, textX, 46, { size: 30, stroke: 6, weight: 700 });
    ctx.restore();
  }
}

/** Dải băng nghiêng trượt vào từ trái, dừng giữa sân rồi trượt ra phải — kiểu truyền hình thể thao. */
function drawCallouts(ctx, callouts, now) {
  for (const c of callouts) {
    const age = now - c.born;
    const ease = (t) => 1 - (1 - t) ** 3;
    const slideIn = ease(Math.min(1, age / CALLOUT_SLIDE_MS));
    const slideOut = ease(Math.max(0, (age - (c.ttl - CALLOUT_SLIDE_MS)) / CALLOUT_SLIDE_MS));
    const x = ARENA.left - ARENA_W + slideIn * ARENA_W + slideOut * ARENA_W;
    const t = c.team ? teamOf(c.team) : { color: '#ff6b3d', dark: '#7a2a00' };
    ctx.save();
    ctx.translate(x, CALLOUT_Y);
    ctx.transform(1, 0, -0.18, 1, 0, 0);
    const g = ctx.createLinearGradient(0, -48, 0, 48);
    g.addColorStop(0, t.color);
    g.addColorStop(1, t.dark);
    shape(ctx, rrect(60, -46, ARENA_W - 120, 92, 10), g, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(68, -40, ARENA_W - 136, 20);
    ctx.restore();
    ctx.save();
    ctx.translate(x, CALLOUT_Y);
    if (c.team) drawFlag(ctx, c.team, 100, -30, 90, 60, now, 0.12);
    outlinedText(ctx, c.text, ARENA_W / 2 + (c.team ? 40 : 0), 2, { size: 46, color: '#fff', stroke: 8 });
    ctx.restore();
  }
}

function drawParades(ctx, parades, now) {
  for (const p of parades) {
    const t = (now - p.born) / p.ttl;
    const x = ARENA.left - 600 + t * (ARENA_W + 1200);
    ctx.globalAlpha = Math.min(1, (1 - t) * 4);
    drawFlag(ctx, p.team, x - 270, ARENA.top + 180, 540, 360, now, 0.16);
    outlinedText(ctx, `${truncate(p.name, 14)} · ${teamOf(p.team).name}`, x, ARENA.top + 600, { size: 52, color: '#ffd54a' });
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
    const y = FEED_AREA.y + i * FEED_LINE;
    shape(ctx, rrect(FEED_AREA.x, y, FEED_AREA.w, 40, 20), 'rgba(255,255,255,0.07)', 0);
    if (item.team) drawFlag(ctx, item.team, FEED_AREA.x + 10, y + 7, 39, 26, now, 0);
    const color = item.team ? teamOf(item.team).light : '#ffd54a';
    outlinedText(ctx, truncate(item.text, 34), FEED_AREA.x + 60, y + 21, { size: 21, color, align: 'left', stroke: 5 });
  });
  ctx.globalAlpha = 1;
}
