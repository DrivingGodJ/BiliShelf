import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const backgroundPath = path.join(
  repoRoot,
  "extension",
  "entrypoints",
  "background.ts",
);

export function runBackgroundScenario({
  exports: exportNames,
  input = {},
  instrumentMapVideo = false,
  setupSource = "",
  scenarioSource,
}) {
  const script = `
    import { readFile } from "node:fs/promises";
    import path from "node:path";
    import { pathToFileURL } from "node:url";
    import { stripTypeScriptTypes } from "node:module";

    const config = JSON.parse(process.env.BILISHELF_BACKGROUND_SCENARIO || "{}");
    const storageData = {};

    globalThis.defineBackground = (callback) => callback;
    globalThis.chrome = {
      alarms: {
        clear() {},
        create() {},
        onAlarm: { addListener() {} },
      },
      runtime: { onMessage: { addListener() {} } },
      storage: {
        local: {
          async get(keys) {
            const names = Array.isArray(keys) ? keys : [keys];
            return Object.fromEntries(names.map((name) => [name, storageData[name]]));
          },
          async set(next) {
            Object.assign(storageData, next || {});
          },
          async remove(keys) {
            const names = Array.isArray(keys) ? keys : [keys];
            for (const name of names) delete storageData[name];
          },
        },
      },
      cookies: {
        getAll(_details, callback) {
          const cookies = [{ name: "SESSDATA", value: "test-session" }];
          if (callback) callback(cookies);
          return Promise.resolve(cookies);
        },
      },
    };

    let source = await readFile(${JSON.stringify(backgroundPath)}, "utf8");
    source = source.replace(
      /from\\s+(["'])(\\.\\.\\/[^"']+)\\1/g,
      (_match, quote, specifier) => {
        const absolute = pathToFileURL(
          path.resolve(path.dirname(${JSON.stringify(backgroundPath)}), specifier),
        ).href;
        return "from " + quote + absolute + quote;
      },
    );

    for (const exportName of config.exports || []) {
      const patterns = [
        new RegExp("(?<!export )async function " + exportName + "\\\\("),
        new RegExp("(?<!export )function " + exportName + "\\\\("),
      ];
      let matched = false;
      for (const pattern of patterns) {
        if (!pattern.test(source)) continue;
        source = source.replace(pattern, (value) => "export " + value);
        matched = true;
        break;
      }
      if (!matched && !new RegExp("export (?:async )?function " + exportName + "\\\\(").test(source)) {
        throw new Error("Unable to export background function: " + exportName);
      }
    }

    if (config.instrumentMapVideo) {
      source = source.replace("function mapVideo(", "function __instrumentedOriginalMapVideo(");
      const marker = "export default defineBackground(() => {";
      const instrumentation = [
        "let __mapVideoCallCount = 0;",
        "function mapVideo(...args) { __mapVideoCallCount += 1; return __instrumentedOriginalMapVideo(...args); }",
        "export function getMapVideoCallCount() { return __mapVideoCallCount; }",
        "export function resetMapVideoCallCount() { __mapVideoCallCount = 0; }",
        "",
      ].join("\\n");
      source = source.replace(marker, instrumentation + marker);
    }

    const javascript = stripTypeScriptTypes(source, { mode: "transform" });
    const moduleUrl =
      "data:text/javascript;base64," + Buffer.from(javascript).toString("base64");
    const background = await import(moduleUrl);
    const input = config.input || {};

    if (config.setupSource) {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      await new AsyncFunction("input", config.setupSource)(input);
    }

    const names = [...(config.exports || [])];
    if (config.instrumentMapVideo) {
      names.push("getMapVideoCallCount", "resetMapVideoCallCount");
    }
    const values = names.map((name) => background[name]);
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const scenario = new AsyncFunction(...names, "input", config.scenarioSource);
    const result = await scenario(...values, input);
    console.log(JSON.stringify({ result, storageData }));
  `;

  const stdout = execFileSync(
    process.execPath,
    ["--experimental-strip-types", "--input-type=module", "-"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        BILISHELF_BACKGROUND_SCENARIO: JSON.stringify({
          exports: exportNames,
          input,
          instrumentMapVideo,
          setupSource,
          scenarioSource,
        }),
      },
      input: script,
      maxBuffer: 32 * 1024 * 1024,
    },
  );

  return JSON.parse(stdout.trim());
}
