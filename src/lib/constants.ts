/** 可预约的时间席（按是否含午餐/晚餐分组显示） */
export const TIME_SLOTS = [
  "11:30",
  "12:00",
  "12:30",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
] as const;

export type TimeSlot = (typeof TIME_SLOTS)[number];

export const isTimeSlot = (t: string): t is TimeSlot =>
  (TIME_SLOTS as readonly string[]).includes(t);

/** 根据时间返回「午宴 / 晚宴」标签 */
export function mealLabel(time: string): string {
  const hour = parseInt(time.split(":")[0], 10);
  return hour < 14 ? "午宴" : "晚宴";
}

export const DISH_CATEGORIES = [
  "前菜",
  "热菜",
  "汤品",
  "主食",
  "甜品",
  "饮品",
] as const;

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "待确认",
  CONFIRMED: "已确认",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
};

export const ORDER_STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-gold/15 text-gold",
  CONFIRMED: "bg-scallion/15 text-scallion-dark",
  COMPLETED: "bg-scallion/15 text-scallion-dark",
  CANCELLED: "bg-cinnabar/10 text-cinnabar",
};

export const APP_NAME = "家宴点菜";
