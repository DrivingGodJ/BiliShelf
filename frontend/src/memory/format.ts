export function formatFavoriteDate(timestamp: number, withTime = false): string {
  if (!timestamp) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(withTime
      ? ({ hour: "2-digit", minute: "2-digit", hour12: false } as const)
      : {}),
  }).format(new Date(timestamp));
}

export function formatShortDate(timestamp: number): string {
  if (!timestamp) return "未知日期";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

export function formatRelativeYears(timestamp: number, now = Date.now()): string {
  const years = Math.max(0, (now - timestamp) / (365.2425 * 24 * 60 * 60 * 1000));
  if (years < 1) {
    const months = Math.max(1, Math.floor(years * 12));
    return `${months} 个月前`;
  }
  const rounded = Math.floor(years);
  return `${rounded} 年前`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = Math.floor(seconds % 60);
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
    : `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(Math.max(0, value || 0));
}
