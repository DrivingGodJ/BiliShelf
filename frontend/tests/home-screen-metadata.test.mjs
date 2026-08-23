import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const frontendRoot = new URL("../", import.meta.url);

async function readPngSize(relativePath) {
  const png = await readFile(new URL(relativePath, frontendRoot));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}

test("publishes iPhone and installable web app metadata", async () => {
  const html = await readFile(new URL("index.html", frontendRoot), "utf8");
  const manifest = JSON.parse(
    await readFile(new URL("public/manifest.webmanifest", frontendRoot), "utf8"),
  );

  assert.match(html, /rel="apple-touch-icon"[^>]+apple-touch-icon\.png/);
  assert.match(html, /rel="manifest"[^>]+manifest\.webmanifest/);
  assert.match(html, /name="apple-mobile-web-app-title" content="拾光"/);
  assert.equal(manifest.short_name, "拾光");
  assert.equal(manifest.display, "standalone");
  assert.deepEqual(
    manifest.icons.map((icon) => icon.sizes),
    ["192x192", "512x512"],
  );
  assert.deepEqual(await readPngSize("public/apple-touch-icon.png"), {
    width: 180,
    height: 180,
  });
  assert.deepEqual(await readPngSize("public/app-icon-192.png"), {
    width: 192,
    height: 192,
  });
  assert.deepEqual(await readPngSize("public/app-icon-512.png"), {
    width: 512,
    height: 512,
  });
});
