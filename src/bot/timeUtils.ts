/**
 * timeUtils.ts — Time calculations for ROK Game Time (UTC) and Vietnam Time (UTC+7)
 */

/** Formats a timestamp into Vietnam date: "DD/MM/YYYY" */
export function formatVNDate(timestamp: number): string {
  const d = new Date(timestamp);
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const vnDate = new Date(utc + 7 * 3600000);
  const day = vnDate.getDate().toString().padStart(2, '0');
  const month = (vnDate.getMonth() + 1).toString().padStart(2, '0');
  const year = vnDate.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Formats a timestamp into Vietnam month: "MM/YYYY" */
export function formatVNMonth(timestamp: number): string {
  const d = new Date(timestamp);
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const vnDate = new Date(utc + 7 * 3600000);
  const month = (vnDate.getMonth() + 1).toString().padStart(2, '0');
  const year = vnDate.getFullYear();
  return `${month}/${year}`;
}

/** Formats a timestamp into Vietnam time (UTC+7): "DD/MM, HH:mm" */
export function formatVNTime(timestamp: number): string {
  const d = new Date(timestamp);
  // Add 7 hours to UTC
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const vnDate = new Date(utc + 7 * 3600000);

  const day = vnDate.getDate().toString().padStart(2, '0');
  const month = (vnDate.getMonth() + 1).toString().padStart(2, '0');
  const hours = vnDate.getHours().toString().padStart(2, '0');
  const minutes = vnDate.getMinutes().toString().padStart(2, '0');

  return `${day}/${month}, ${hours}:${minutes}`;
}

/** Formats a timestamp into ROK in-game time (UTC): "HH:mm" */
export function formatROKGameTime(timestamp: number): string {
  const d = new Date(timestamp);
  const hours = d.getUTCHours().toString().padStart(2, '0');
  const minutes = d.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Builds the Time string for report:
 * e.g. "25/10, 07:30 - 20:24 (ROK: 00:30 - 13:24)" or "25/10, 07:30 - 20:24"
 */
export function buildTimeRangeString(startTime: number, endTime: number): string {
  const startVN = formatVNTime(startTime);
  const endVNDate = new Date(endTime + new Date(endTime).getTimezoneOffset() * 60000 + 7 * 3600000);
  const endVNHours = endVNDate.getHours().toString().padStart(2, '0');
  const endVNMinutes = endVNDate.getMinutes().toString().padStart(2, '0');

  const startROK = formatROKGameTime(startTime);
  const endROK = formatROKGameTime(endTime);

  return `${startVN} - ${endVNHours}:${endVNMinutes} (ROK: ${startROK} - ${endROK})`;
}

/**
 * Calculates work duration in hours formatted with a comma (e.g. "12,9")
 */
export function calculateShiftHours(startTime: number, endTime: number): {
  hoursStr: string;
  totalMinutes: number;
  durationFormatted: string;
  hoursFloat: number;
} {
  const totalMs = Math.max(0, endTime - startTime);
  const totalMinutes = Math.round(totalMs / 60000);
  const hoursFloat = totalMinutes / 60;
  let rounded = Math.round(hoursFloat * 10) / 10;
  if (totalMinutes > 0 && rounded === 0) {
    rounded = 0.1;
  }
  const hoursStr = rounded.toString().replace('.', ',');

  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const durationFormatted = `${h} giờ ${m.toString().padStart(2, '0')} phút`;

  return {
    hoursStr,
    totalMinutes,
    durationFormatted,
    hoursFloat: rounded,
  };
}

/**
 * Formats speedup delta into "+0d 00h 00m" or "-1d 04h 30m"
 */
export function formatSpeedupDelta(deltaMinutes: number): string {
  const sign = deltaMinutes >= 0 ? '+' : '-';
  const absMin = Math.abs(deltaMinutes);
  const d = Math.floor(absMin / 1440);
  const h = Math.floor((absMin % 1440) / 60);
  const m = absMin % 60;
  return `${sign}${d}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`;
}
