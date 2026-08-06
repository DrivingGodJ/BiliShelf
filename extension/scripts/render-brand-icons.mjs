import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(scriptDir, "..");
const sourcePath = path.join(extensionRoot, "public", "bilishelf-mark.svg");
const outputDir = path.join(extensionRoot, "public", "icons");
const sizes = [16, 32, 48, 64, 96, 128];

async function firstExistingPath(candidates) {
  for (const candidate of candidates.filter(Boolean)) {
    try {
      await access(candidate);
      return candidate;
    } catch {
    }
  }
  throw new Error("No Chromium-based browser was found for icon rendering");
}

async function findBrowser() {
  if (process.env.BILISHELF_BROWSER_PATH) {
    return firstExistingPath([process.env.BILISHELF_BROWSER_PATH]);
  }
  if (process.platform === "win32") {
    return firstExistingPath([
      path.join(process.env["PROGRAMFILES(X86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
      path.join(process.env.PROGRAMFILES || "", "Microsoft", "Edge", "Application", "msedge.exe"),
      path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
    ]);
  }
  return firstExistingPath([
    "/usr/bin/microsoft-edge",
    "/usr/bin/microsoft-edge-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ]);
}

async function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function waitForJson(url, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`Timed out waiting for browser endpoint: ${url}`);
}

async function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  let requestId = 0;
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  };
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = () => reject(new Error("Failed to connect to browser DevTools"));
  });
  return {
    socket,
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++requestId;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

async function main() {
  const browserPath = await findBrowser();
  const port = await reservePort();
  const profileDir = await mkdtemp(path.join(os.tmpdir(), "bilishelf-icon-render-"));
  const browser = spawn(
    browserPath,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  );

  try {
    const targets = await waitForJson(`http://127.0.0.1:${port}/json/list`);
    const page = targets.find((target) => target.type === "page" && target.url === "about:blank")
      || targets.find((target) => target.type === "page");
    if (!page?.webSocketDebuggerUrl) throw new Error("No browser page target found");

    const svg = (await readFile(sourcePath, "utf8"))
      .replace('width="128"', 'width="100%"')
      .replace('height="128"', 'height="100%"');
    const cdp = await connectCdp(page.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Emulation.setDefaultBackgroundColorOverride", {
      color: { r: 0, g: 0, b: 0, a: 0 },
    });
    const { frameTree } = await cdp.send("Page.getFrameTree");
    await mkdir(outputDir, { recursive: true });

    for (const size of sizes) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: size,
        height: size,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await cdp.send("Page.setDocumentContent", {
        frameId: frameTree.frame.id,
        html: `<!doctype html><style>html,body{margin:0;width:${size}px;height:${size}px;overflow:hidden;background:transparent}svg{display:block;width:100%;height:100%}</style>${svg}`,
      });
      const result = await cdp.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
        clip: { x: 0, y: 0, width: size, height: size, scale: 1 },
      });
      await writeFile(path.join(outputDir, `${size}.png`), Buffer.from(result.data, "base64"));
    }

    const browserVersion = await waitForJson(`http://127.0.0.1:${port}/json/version`);
    if (browserVersion.webSocketDebuggerUrl) {
      const browserCdp = await connectCdp(browserVersion.webSocketDebuggerUrl);
      await browserCdp.send("Browser.close");
      browserCdp.socket.close();
    }
    cdp.socket.close();
  } finally {
    if (!browser.killed) browser.kill();
    await rm(profileDir, { recursive: true, force: true });
  }

  console.log(`Rendered BiliShelf icons: ${sizes.join(", ")}px`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
