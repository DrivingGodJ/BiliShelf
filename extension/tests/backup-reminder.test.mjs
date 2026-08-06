import test from "node:test";
import assert from "node:assert/strict";

import {
  BACKUP_REMINDER_INTERVAL_MS,
  formatLocalDay,
  shouldShowBackupReminder,
} from "../../frontend/src/lib/backup-reminder.js";

test("backup reminder becomes due seven days after the last successful backup", () => {
  const now = new Date(2026, 7, 5, 14, 0, 0).getTime();
  assert.equal(
    shouldShowBackupReminder({
      hasData: true,
      now,
      lastBackupAt: now - BACKUP_REMINDER_INTERVAL_MS + 1,
      lastReminderDay: "",
    }),
    false,
  );
  assert.equal(
    shouldShowBackupReminder({
      hasData: true,
      now,
      lastBackupAt: now - BACKUP_REMINDER_INTERVAL_MS,
      lastReminderDay: "",
    }),
    true,
  );
});

test("backup reminder uses the local calendar day and displays at most once per day", () => {
  const now = new Date(2026, 7, 5, 23, 30, 0).getTime();
  const localDay = formatLocalDay(now);
  assert.equal(localDay, "2026-08-05");
  assert.equal(
    shouldShowBackupReminder({
      hasData: true,
      now,
      lastBackupAt: 0,
      lastReminderDay: localDay,
    }),
    false,
  );
  assert.equal(
    shouldShowBackupReminder({
      hasData: false,
      now,
      lastBackupAt: 0,
      lastReminderDay: "",
    }),
    false,
  );
});
