/** 以「上海时区」返回今天的日期字符串 YYYY-MM-DD */
export function todayStr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00+08:00`);
  return !Number.isNaN(d.getTime());
}

export function isPastDate(s: string): boolean {
  return s < todayStr();
}

/** 用于校验某日期是否为「未来可约」日期（允许今天） */
export function isBookableDate(s: string): boolean {
  return isValidDate(s) && !isPastDate(s);
}

export function formatCnDate(s: string): string {
  const [, m, d] = s.split("-");
  return `${parseInt(m, 10)}月${parseInt(d, 10)}日`;
}

export type DateOption = {
  value: string; // YYYY-MM-DD
  label: string; // M/D
  weekday: string;
  isToday: boolean;
};

/** 基于「上海时区」的今天，生成接下来 n 天的日期选项 */
export function nextDates(n: number): DateOption[] {
  const today = todayStr();
  const [y, m, d] = today.split("-").map(Number);
  const base = new Date(y, m - 1, d);

  const list: DateOption[] = [];
  for (let i = 0; i < n; i++) {
    const dt = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    const value = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
      dt.getDate()
    ).padStart(2, "0")}`;
    list.push({
      value,
      label: `${dt.getMonth() + 1}/${dt.getDate()}`,
      weekday: weekdayCn(value),
      isToday: i === 0,
    });
  }
  return list;
}

export function weekdayCn(s: string): string {
  // 按日历日期（年/月/日）直接构造本地 Date，避免时区偏移导致星期错位
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const names = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return names[date.getDay()];
}
