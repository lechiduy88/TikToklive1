// Danh sách môn thi. Chỉ các môn mà tương tác người xem quyết định trực tiếp kết quả.
// Thêm môn mới: tạo module cùng giao diện (create / accepts / addEffort / standing / step / ranking / view),
// đăng ký ở đây và thêm vào SEA_SESSION.eventCycle.
import { dragonBoat } from './dragonBoat.js';
import { marathon } from './marathon.js';
import { weightlifting } from './weightlifting.js';

export const EVENT_MODULES = Object.freeze({
  [dragonBoat.id]: dragonBoat,
  [marathon.id]: marathon,
  [weightlifting.id]: weightlifting,
});
