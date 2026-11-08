// Bình luận viên tự động: theo dõi thế trận từng môn và hô những khoảnh khắc kịch tính
// (vượt lên dẫn đầu, sắp về đích, loạt bắn cuối, chung kết cử tạ).
import { teamOf } from './teams.js';

const LEADER_COOLDOWN_MS = 3500; // không hô "vượt lên" liên tục khi hai đội giằng co từng giây
const MIN_LEAD = Object.freeze({ dragon_boat: 120, archery: 5, weightlifting: 3 });
const NEAR_FINISH = 0.8;

function standingOf(event) {
  const v = event?.view;
  if (!v) return null;
  if (event.id === 'dragon_boat') {
    return Object.fromEntries(Object.entries(v.pos).filter(([t]) => !v.finished.includes(t)));
  }
  if (event.id === 'archery') return v.totals;
  if (event.id === 'weightlifting') return Object.fromEntries(v.alive.map((t) => [t, v.meter[t]]));
  return null;
}

function leaderOf(standing, minLead) {
  let best = null;
  let bestScore = -Infinity;
  let second = -Infinity;
  for (const [team, score] of Object.entries(standing)) {
    if (score > bestScore) {
      second = bestScore;
      best = team;
      bestScore = score;
    } else if (score > second) {
      second = score;
    }
  }
  // Chỉ coi là "dẫn đầu" khi đã có điểm đáng kể và hơn đội nhì rõ ràng.
  return bestScore >= minLead && bestScore > second ? best : null;
}

/** @param {{callout: (text: string, team: string|null, now: number) => void}} fx */
export function createCommentary(fx) {
  let key = null;
  let leader = null;
  let leaderAt = -Infinity;
  let said = new Set();
  let finishedCount = 0;

  const once = (id, text, team, now) => {
    if (said.has(id)) return;
    said = new Set([...said, id]);
    fx.callout(text, team, now);
  };

  function milestones(state, now) {
    const { id, view } = state.event;
    if (id === 'dragon_boat') {
      const top = Math.max(...Object.values(view.pos));
      if (top >= view.track * NEAR_FINISH && view.finished.length === 0) once('near', '🏁 SẮP VỀ ĐÍCH!', null, now);
    }
    if (id === 'archery' && view.volley === view.volleys - 1) once('last-volley', '🎯 LOẠT CUỐI QUYẾT ĐỊNH!', null, now);
    if (id === 'weightlifting' && view.alive.length === 2) once('final', '🏋️ CHUNG KẾT: CHỈ CÒN 2 ĐỘI!', null, now);
  }

  return {
    update(state, now) {
      if (state.phase !== 'live' || !state.event?.view) return;
      const eventKey = `${state.session}:${state.eventIndex}`;
      if (eventKey !== key) {
        key = eventKey;
        leader = null;
        leaderAt = -Infinity;
        said = new Set();
        finishedCount = 0;
      }
      milestones(state, now);
      // Thuyền dẫn đầu về đích: thuyền kế tiếp tự nhiên lên đầu — không phải "vượt", nên chỉ ghi nhận im lặng.
      const finished = state.event.view.finished?.length ?? 0;
      if (finished !== finishedCount) {
        finishedCount = finished;
        const standingNow = standingOf(state.event);
        leader = standingNow ? leaderOf(standingNow, 0) : null;
        leaderAt = now;
        return;
      }
      const standing = standingOf(state.event);
      const current = standing ? leaderOf(standing, MIN_LEAD[state.event.id] ?? 1) : null;
      if (!current || current === leader || now - leaderAt < LEADER_COOLDOWN_MS) return;
      const overtaking = leader !== null;
      leader = current;
      leaderAt = now;
      const name = teamOf(current).name.toUpperCase();
      fx.callout(overtaking ? `⚡ ${name} VƯỢT LÊN DẪN ĐẦU!` : `🔥 ${name} ĐANG DẪN ĐẦU!`, current, now);
    },
  };
}
