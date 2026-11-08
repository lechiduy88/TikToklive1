// Danh sách môn thi. Thêm môn mới: tạo module cùng giao diện
// (create / accepts / addEffort / step / ranking / view) và đăng ký ở đây.
import { dragonBoat } from './dragonBoat.js';
import { archery } from './archery.js';
import { weightlifting } from './weightlifting.js';

export const EVENT_MODULES = Object.freeze({
  [dragonBoat.id]: dragonBoat,
  [archery.id]: archery,
  [weightlifting.id]: weightlifting,
});
