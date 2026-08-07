import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveExtensionRuntime,
  sendExtensionRuntimeMessage,
} from "../src/lib/extension-runtime.js";

test("Firefox uses the browser Promise API without a Chromium callback", async () => {
  const calls = [];
  const root = {
    browser: {
      runtime: {
        id: "firefox-id",
        sendMessage(...args) {
          calls.push(args);
          return Promise.resolve({ ok: true, status: 200, data: "firefox" });
        },
      },
    },
    chrome: {
      runtime: {
        id: "chrome-alias",
        sendMessage() {
          throw new Error("Chrome alias should not be selected in Firefox");
        },
      },
    },
  };

  const transport = resolveExtensionRuntime(root);
  const response = await sendExtensionRuntimeMessage(transport, { type: "status" });

  assert.equal(transport.mode, "promise");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].length, 1);
  assert.deepEqual(response, { ok: true, status: 200, data: "firefox" });
});

test("Chrome and Edge use the callback API and surface runtime errors", async () => {
  const root = {
    chrome: {
      runtime: {
        id: "chromium-id",
        sendMessage(_message, callback) {
          callback({ ok: true, status: 200, data: "chromium" });
        },
      },
    },
  };

  const transport = resolveExtensionRuntime(root);
  assert.equal(transport.mode, "callback");
  assert.deepEqual(
    await sendExtensionRuntimeMessage(transport, { type: "status" }),
    { ok: true, status: 200, data: "chromium" },
  );

  root.chrome.runtime.sendMessage = (_message, callback) => {
    root.chrome.runtime.lastError = { message: "background unavailable" };
    callback(undefined);
    delete root.chrome.runtime.lastError;
  };
  await assert.rejects(
    sendExtensionRuntimeMessage(resolveExtensionRuntime(root), { type: "status" }),
    /background unavailable/,
  );
});

test("missing extension runtimes fail immediately", async () => {
  assert.equal(resolveExtensionRuntime({}), null);
  await assert.rejects(
    sendExtensionRuntimeMessage(null, { type: "status" }),
    /Extension runtime is unavailable/,
  );
});
