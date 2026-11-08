// Danh sách 10 môn thi — môn nào cũng do tương tác người xem quyết định trực tiếp kết quả.
// Thêm môn mới: khai báo trong SPORTS (server/sea/config.js) với một kiểu luật chơi có sẵn,
// đăng ký ở đây và thêm vào SEA_SESSION.eventCycle.
import { SPORTS } from '../config.js';
import { raceEvent } from './race.js';
import { enduranceEvent } from './endurance.js';
import { survivalEvent } from './survival.js';
import { throwEvent } from './throw.js';
import { weightlifting } from './weightlifting.js';

const FACTORIES = Object.freeze({
  race: raceEvent,
  endurance: enduranceEvent,
  survival: survivalEvent,
  throw: throwEvent,
});

export const EVENT_MODULES = Object.freeze(Object.fromEntries(Object.entries(SPORTS).map(([id, cfg]) => [
  id, cfg.kind === 'elimination' ? weightlifting : FACTORIES[cfg.kind](id),
])));
