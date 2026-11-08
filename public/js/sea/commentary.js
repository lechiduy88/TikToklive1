// Bình luận viên tự động: theo dõi thế trận từng môn (theo kiểu luật chơi) và hô những khoảnh khắc
// kịch tính — vượt lên dẫn đầu, sắp về đích, nước rút, chung kết, lượt ném cuối.
import { teamOf } from './teams.js';

const LEADER_COOLDOWN_MS = 3500; // không hô "vượt lên" liên tục khi hai đội giằng co từng giây
const LAST_SECONDS_MS = 20_000;
const NEAR_FINISH = 0.8;

/** Điểm của các đội còn thi + mức tối thiểu để coi là "dẫn đầu", theo kiểu luật chơi. */
function standingOf(event) {
  const v = event?.view;
  if (!v) return null;
  switch (event.kind) {
    case 'race': return { scores: Object.fromEntries(Object.entries(v.pos).filter(([t]) => !v.finished.includes(t))), minLead: v.track * 0.12 };
    case 'endurance': return { scores: v.pos, minLead: v.expectedMeters * 0.04 };
    case 'elimination': return { scores: Object.fromEntries(v.alive.map((t) => [t, v.meter[t]])), minLead: 3 };
    case 'survival': return null; // giữ cầu: không có "dẫn đầu", chỉ có rơi cầu
    case 'throw': return { scores: v.best, minLead: v.maxDistance * 0.1 };
    default: return null;
  }
}

function leaderOf(scores, minLead) {
  let best = null;
  let bestScore = -Infinity;
  let second = -Infinity;
  for (const [team, score] of Object.entries(scores)) {
    if (score > bestScore) {
      second = bestScore;
      best = team;
      bestScore = score;
    } else if (score > second) {
      second = score;
    }
  }
  return bestScore >= minLead && bestScore > second ? best : null;
}

function milestone(event) {
  const v = event.view;
  switch (event.kind) {
    case 'race': return Math.max(...Object.values(v.pos)) >= v.track * NEAR_FINISH && v.finished.length === 0 ? ['near', '🏁 SẮP VỀ ĐÍCH!'] : null;
    case 'endurance': return v.endsInMs <= LAST_SECONDS_MS ? ['sprint', '🔥 20 GIÂY CUỐI · NƯỚC RÚT!'] : null;
    case 'elimination': return v.alive.length === 2 ? ['final', '🏋️ CHUNG KẾT: CHỈ CÒN 2 ĐỘI!'] : null;
    case 'survival': return v.alive.length === 2 ? ['final', '🏐 CHỈ CÒN 2 ĐỘI GIỮ CẦU!'] : null;
    case 'throw': return v.attempt === v.attempts ? ['last', '🎯 LƯỢT CUỐI QUYẾT ĐỊNH!'] : null;
    default: return null;
  }
}

/** @param {{callout: (text: string, team: string|null, now: number) => void}} fx */
export function createCommentary(fx) {
  let key = null;
  let leader = null;
  let leaderAt = -Infinity;
  let said = new Set();
  let finishedCount = 0;

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
      const m = milestone(state.event);
      if (m && !said.has(m[0])) {
        said = new Set([...said, m[0]]);
        fx.callout(m[1], null, now);
      }
      const standing = standingOf(state.event);
      if (!standing) return;
      // Đội dẫn đầu về đích: đội kế tiếp tự nhiên lên đầu — không phải "vượt", chỉ ghi nhận im lặng.
      const finished = state.event.view.finished?.length ?? 0;
      if (finished !== finishedCount) {
        finishedCount = finished;
        leader = leaderOf(standing.scores, 0);
        leaderAt = now;
        return;
      }
      const current = leaderOf(standing.scores, standing.minLead);
      if (!current || current === leader || now - leaderAt < LEADER_COOLDOWN_MS) return;
      const overtaking = leader !== null;
      leader = current;
      leaderAt = now;
      const name = teamOf(current).name.toUpperCase();
      fx.callout(overtaking ? `⚡ ${name} VƯỢT LÊN DẪN ĐẦU!` : `🔥 ${name} ĐANG DẪN ĐẦU!`, current, now);
    },
  };
}
