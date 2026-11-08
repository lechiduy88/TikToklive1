// Tự cân bằng: đội bị bỏ xa được nhân sức tiếp để trận luôn có cạnh tranh. Không bao giờ trừ đội mạnh.
import { SEA_BALANCE, TEAM_IDS } from './config.js';
import { EVENT_MODULES } from './events/index.js';

const ones = () => Object.fromEntries(TEAM_IDS.map((t) => [t, 1]));

/**
 * Buff trong môn theo khoảng cách tới đội dẫn đầu.
 * @param {Record<string, number>} standing điểm của các đội CÒN thi (đội đã xong/bị loại không có mặt)
 * @param {number} minLead đội dẫn đầu phải vượt mức này mới bắt đầu buff (tránh buff vì một comment đầu tiên)
 */
export function eventBuffs(standing, minLead) {
  const scores = Object.values(standing);
  const leader = scores.length ? Math.max(...scores) : 0;
  if (leader < minLead) return ones();
  const buffs = ones();
  for (const [team, score] of Object.entries(standing)) {
    const ratio = score / leader;
    if (ratio >= SEA_BALANCE.closeRatio) continue;
    const behind = (SEA_BALANCE.closeRatio - ratio) / SEA_BALANCE.closeRatio;
    buffs[team] = 1 + Math.min(SEA_BALANCE.maxEventBonus, behind * SEA_BALANCE.maxEventBonus);
  }
  return buffs;
}

/** Điểm huy chương kiểu Olympic: Vàng 3, Bạc 2, Đồng 1. */
export function medalPoints(row) {
  return row ? row.gold * 3 + row.silver * 2 + row.bronze : 0;
}

/** "Tinh thần dân tộc": nước càng kém xa đầu bảng tổng sắp càng được tiếp sức. */
export function medalBuffs(table) {
  const points = Object.fromEntries(TEAM_IDS.map((t) => [t, medalPoints(table[t])]));
  const leader = Math.max(...Object.values(points));
  return Object.fromEntries(TEAM_IDS.map((t) => [
    t, 1 + Math.min(SEA_BALANCE.maxMedalBonus, (leader - points[t]) * SEA_BALANCE.medalPointBonus),
  ]));
}

/**
 * "Đội ít người": đội có ít cổ động viên hơn đội đông nhất được nhân √(đông nhất / số người đội mình).
 * Căn bậc hai: đội nhỏ vẫn cần cố gắng thật, không được bù hoàn toàn. Đội chưa có ai: không buff.
 */
export function sizeBuffs(counts) {
  const biggest = Math.max(...TEAM_IDS.map((t) => counts[t] ?? 0));
  return Object.fromEntries(TEAM_IDS.map((t) => {
    const n = counts[t] ?? 0;
    if (n === 0 || biggest === 0) return [t, 1];
    return [t, Math.min(1 + SEA_BALANCE.maxSizeBonus, Math.sqrt(biggest / n))];
  }));
}

/** Số cổ động viên ĐÃ tiếp sức trong kỳ của mỗi đội (người chỉ đăng ký rồi đứng xem không tính). */
export function activeCounts(athletes) {
  const counts = Object.fromEntries(TEAM_IDS.map((t) => [t, 0]));
  for (const a of Object.values(athletes)) if (a.effort > 0 && Object.hasOwn(counts, a.team)) counts[a.team] += 1;
  return counts;
}

/** Nhân các lớp buff, giới hạn ở maxTotal. */
export function combineBuffs(...layers) {
  return Object.fromEntries(TEAM_IDS.map((t) => [
    t, Math.min(SEA_BALANCE.maxTotal, layers.reduce((product, layer) => product * layer[t], 1)),
  ]));
}

/** Chỉ lớp buff trong môn (để hô "lội ngược dòng" khi đội thực sự bị bỏ xa ngay trong môn). */
export function eventBuffsFor(state) {
  if (state.phase !== 'live' || !state.event?.state) return ones();
  const mod = EVENT_MODULES[state.event.id];
  return eventBuffs(mod.standing(state.event.state), mod.buffMinLead);
}

/** Buff hiện tại của mỗi đội trong trạng thái đại hội. */
export function buffsFor(state) {
  const base = [medalBuffs(state.medals), sizeBuffs(activeCounts(state.athletes))];
  if (state.phase !== 'live' || !state.event?.state) return combineBuffs(...base);
  const mod = EVENT_MODULES[state.event.id];
  return combineBuffs(eventBuffs(mod.standing(state.event.state), mod.buffMinLead), ...base);
}
