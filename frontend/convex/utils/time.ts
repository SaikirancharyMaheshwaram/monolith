export const DAY = 86400 * 1000;

export function getDayNumber(start: number, now: number) {
  return Math.floor((now - start) / DAY);
}