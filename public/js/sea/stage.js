// Bố cục màn hình NGANG 16:9 (1920×1080) của SEA Games:
//  ┌──────────────── thanh trên (logo · môn · đồng hồ) ────────────────┐
//  │ vùng thi đấu (1460 px)                     │ cột phải: bảng tổng │
//  │  5 làn ngang (đua/ném) hoặc 5 cột (cử tạ…) │ sắp + thông báo     │
//  └──────────────────── thanh luật chơi dưới ─────────────────────────┘
export const SW = 1920;
export const SH = 1080;
export const TOP_H = 100;
export const FOOT_H = 56;
export const SIDE_X = 1460;

export const ARENA = Object.freeze({ left: 0, right: SIDE_X, top: TOP_H, bottom: SH - FOOT_H });
export const ARENA_W = ARENA.right - ARENA.left;
export const ARENA_H = ARENA.bottom - ARENA.top;
export const ARENA_CX = ARENA.left + ARENA_W / 2;
