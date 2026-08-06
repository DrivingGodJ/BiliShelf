export const BACKUP_REMINDER_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
export const BACKUP_REMINDER_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function formatLocalDay(timestamp) {
  const date = new Date(Number(timestamp) || Date.now());
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shouldShowBackupReminder(options) {
  if (!options?.hasData) return false;
  const now = Number(options.now) || Date.now();
  if (String(options.lastReminderDay || "") === formatLocalDay(now)) return false;
  const lastBackupAt = Number(options.lastBackupAt);
  if (
    Number.isFinite(lastBackupAt) &&
    lastBackupAt > 0 &&
    now - lastBackupAt < BACKUP_REMINDER_INTERVAL_MS
  ) {
    return false;
  }
  return true;
}
