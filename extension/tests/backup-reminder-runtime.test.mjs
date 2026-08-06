import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runBackgroundScenario } from "./helpers/background-runtime-harness.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

test("background backup reminder is due after seven days and once per local day", () => {
  const now = new Date(2026, 7, 5, 12, 0, 0).getTime();
  const result = runBackgroundScenario({
    exports: ["shouldShowExtensionBackupReminder"],
    input: { now },
    scenarioSource: `
      return {
        fresh: shouldShowExtensionBackupReminder({
          hasData: true,
          now: input.now,
          lastBackupAt: input.now - 6 * 24 * 60 * 60 * 1000,
          lastReminderDay: "",
        }),
        overdue: shouldShowExtensionBackupReminder({
          hasData: true,
          now: input.now,
          lastBackupAt: input.now - 7 * 24 * 60 * 60 * 1000,
          lastReminderDay: "",
        }),
        sameDay: shouldShowExtensionBackupReminder({
          hasData: true,
          now: input.now,
          lastBackupAt: 0,
          lastReminderDay: "2026-08-05",
        }),
      };
    `,
  }).result;

  assert.equal(result.fresh, false);
  assert.equal(result.overdue, true);
  assert.equal(result.sameDay, false);
});

test("extension schedules hourly reminder alarms and declares notification permission", async () => {
  const [background, config] = await Promise.all([
    readFile(
      path.join(repoRoot, "extension", "entrypoints", "background.ts"),
      "utf8",
    ),
    readFile(path.join(repoRoot, "extension", "wxt.config.ts"), "utf8"),
  ]);

  assert.match(config, /"notifications"/);
  assert.match(background, /periodInMinutes: BACKUP_REMINDER_CHECK_INTERVAL_MINUTES/);
  assert.match(background, /await chrome\.alarms\.get\(BACKUP_REMINDER_ALARM\)/);
  assert.match(background, /if \(alarm\.name === BACKUP_REMINDER_ALARM\)/);
  assert.match(background, /chrome\.notifications\?\.create/);
  assert.match(background, /path === "\/backup\/reminder\/backup-completed"/);
  assert.match(background, /path === "\/backup\/reminder\/shown"/);
  assert.match(
    background,
    /state\.videos\.some\(\(video\) => video\.deletedAt === null\)[\s\S]*state\.comments\.some\(\(comment\) => comment\.deletedAt == null\)[\s\S]*state\.articles\.some\(\(article\) => article\.deletedAt == null\)/,
  );
});
