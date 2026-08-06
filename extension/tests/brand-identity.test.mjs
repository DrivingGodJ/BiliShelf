import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const readText = (...parts) => readFile(path.join(repoRoot, ...parts), "utf8");

test("brand mark consistently represents video, bookmark, and shelf", async () => {
  const [extensionMark, frontendMark, component, popup, content] = await Promise.all([
    readText("extension", "public", "bilishelf-mark.svg"),
    readText("frontend", "public", "bilishelf-mark.svg"),
    readText("frontend", "src", "components", "icons", "BiliShelfMark.vue"),
    readText("extension", "entrypoints", "popup.html"),
    readText("extension", "content.js"),
  ]);

  assert.equal(extensionMark, frontendMark);
  for (const source of [extensionMark, component, content]) {
    assert.match(source, /#18232D/);
    assert.match(source, /#F36F98/);
    assert.match(source, /#4CCBBB/);
    assert.match(source, /M59 42\.5V61\.5L75 52L59 42\.5Z/);
    assert.match(source, /M84 20H103V63L93\.5 56\.5L84 63V20Z/);
  }
  assert.match(popup, /src="\/bilishelf-mark\.svg"/);
  assert.doesNotMatch(content, /M12 4\.5L19 8\.5V15\.5/);
  assert.doesNotMatch(popup, /M12 4\.5L19/);
});

test("extension icon PNGs use the generated brand mark at every declared size", async () => {
  for (const size of [16, 32, 48, 64, 96, 128]) {
    const png = await readFile(
      path.join(repoRoot, "extension", "public", "icons", `${size}.png`),
    );
    assert.equal(png.subarray(1, 4).toString("ascii"), "PNG");
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
    assert.equal(png[25], 6, `${size}px icon should retain RGBA transparency`);
  }
});

test("manifest metadata and manager chrome use the refreshed identity", async () => {
  const [config, zhLocale, enLocale, managerStyle, managerHeader] = await Promise.all([
    readText("extension", "wxt.config.ts"),
    readText("extension", "public", "_locales", "zh_CN", "messages.json"),
    readText("extension", "public", "_locales", "en", "messages.json"),
    readText("frontend", "src", "style.css"),
    readText("frontend", "src", "components", "layout", "ManagerHeader.vue"),
  ]);

  assert.match(config, /default_locale: "zh_CN"/);
  assert.match(config, /name: "__MSG_extensionName__"/);
  assert.match(zhLocale, /BiliShelf 视频收藏架/);
  assert.match(enLocale, /BiliShelf Video Library/);
  assert.match(managerStyle, /--primary: 343 65% 55%/);
  assert.match(managerStyle, /--hero-b: 172 54% 48%/);
  assert.doesNotMatch(managerStyle, /radial-gradient/);
  assert.match(managerHeader, /<BiliShelfMark class="h-10 w-10 md:h-12 md:w-12"/);
});
