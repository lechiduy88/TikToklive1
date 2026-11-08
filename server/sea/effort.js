// Quy đổi tương tác của người xem thành "sức tiếp" (effort) cho đội tuyển.
import { SEA_EFFORT } from './config.js';

/**
 * Quà tăng theo căn bậc hai kim cương của mỗi món (quà to mạnh hơn hẳn nhưng lợi ích giảm dần), nhân số món.
 * Giới hạn theo từng môn (và phần dư để dành) nằm ở actions.js.
 */
export function giftEffort(diamonds, count) {
  return SEA_EFFORT.giftPerSqrtDiamond * Math.sqrt(Math.max(0, diamonds)) * Math.max(0, count);
}

/** Bậc hiệu ứng trình diễn theo giá trị MỘT món quà. */
export function giftTier(diamondsPerGift) {
  if (diamondsPerGift >= SEA_EFFORT.megaGiftDiamonds) return 'mega';
  if (diamondsPerGift >= SEA_EFFORT.bigGiftDiamonds) return 'big';
  return 'small';
}

/**
 * Tim dồn theo đội: cứ likesPerEffort tim = 1 sức tiếp, tối đa maxLikeEffortPerEvent mỗi lần nhận.
 * @returns {{effort: number, buffer: number}} buffer mới của đội
 */
export function likeEffort(buffer, count) {
  const total = buffer + Math.max(0, count);
  const effort = Math.min(SEA_EFFORT.maxLikeEffortPerEvent, Math.floor(total / SEA_EFFORT.likesPerEffort));
  const left = total - effort * SEA_EFFORT.likesPerEffort;
  return { effort, buffer: Math.min(left, SEA_EFFORT.likesPerEffort * SEA_EFFORT.maxLikeEffortPerEvent) };
}

/** Comment: 1 sức tiếp, tối đa 1 lần / commentCooldownMs / người (chống spam). */
export function commentEffort(lastCommentAt, now) {
  return now - lastCommentAt >= SEA_EFFORT.commentCooldownMs ? SEA_EFFORT.comment : 0;
}
