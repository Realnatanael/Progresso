export function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function shiftDate(iso, days) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function lastDays(today, count) {
  const days = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    days.push(shiftDate(today, -offset));
  }
  return days;
}

export function computeStreak(dates, today) {
  const done = new Set(dates);
  let cursor = done.has(today) ? today : shiftDate(today, -1);
  if (!done.has(cursor)) return 0;
  let streak = 0;
  while (done.has(cursor)) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}
