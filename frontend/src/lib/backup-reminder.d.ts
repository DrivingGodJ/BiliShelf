export declare const BACKUP_REMINDER_INTERVAL_MS: number;
export declare const BACKUP_REMINDER_CHECK_INTERVAL_MS: number;
export declare function formatLocalDay(timestamp: number): string;
export declare function shouldShowBackupReminder(options: {
  hasData: boolean;
  now: number;
  lastBackupAt: number;
  lastReminderDay: string;
}): boolean;
