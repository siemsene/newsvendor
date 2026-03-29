import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const distDir = path.join(repoRoot, "dist");

const checks = [
  { browserName: "chromium", route: "/", viewport: { width: 1366, height: 900 }, storageMode: "blocked" },
  { browserName: "chromium", route: "/instructor/login", viewport: { width: 1366, height: 900 }, toggleTheme: true },
  { browserName: "chromium", route: "/instructor/register", viewport: { width: 1024, height: 768 } },
  { browserName: "chromium", route: "/", viewport: { width: 820, height: 1180 }, storageMode: "blocked" },
  { browserName: "firefox", route: "/", viewport: { width: 1366, height: 900 }, storageMode: "blocked" },
  { browserName: "firefox", route: "/instructor/login", viewport: { width: 1366, height: 900 }, toggleTheme: true },
  { browserName: "firefox", route: "/instructor/register", viewport: { width: 1024, height: 768 } },
];

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    console.error("Missing `playwright`. Install it with `npm install -D playwright`.");
    throw error;
  }
}

const mimeByExt = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".json", "application/json; charset=utf-8"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

async function createServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === "/") pathname = "/index.html";

      const filePath = path.resolve(distDir, `.${pathname}`);
      if (!filePath.startsWith(distDir)) {
        res.statusCode = 403;
        res.end("Forbidden");
        return;
      }

      try {
        const stat = await fs.stat(filePath);
        const finalPath = stat.isDirectory() ? path.join(filePath, "index.html") : filePath;
        const ext = path.extname(finalPath).toLowerCase();
        res.setHeader("Content-Type", mimeByExt.get(ext) ?? "application/octet-stream");
        res.end(await fs.readFile(finalPath));
      } catch {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(await fs.readFile(path.join(distDir, "index.html")));
      }
    } catch (error) {
      res.statusCode = 500;
      res.end(String(error));
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve compat server address.");
  }

  return { server, port: address.port };
}

function routeLabel(route) {
  return route === "/" ? "home" : route.replaceAll("/", "-").replace(/^-/, "");
}

async function main() {
  await fs.access(distDir);

  const artifactDir = path.join(os.tmpdir(), "newsvendor-compat-smoke");
  await fs.mkdir(artifactDir, { recursive: true });

  const { server, port } = await createServer();
  const { chromium, firefox } = await loadPlaywright();
  const browserLaunchers = { chromium, firefox };

  try {
    for (const [browserName, launcher] of Object.entries(browserLaunchers)) {
      const browser = await launcher.launch({ headless: true });
      try {
        const browserChecks = checks.filter((check) => check.browserName === browserName);

        for (const check of browserChecks) {
          const errors = [];
          const page = await browser.newPage({ viewport: check.viewport });

          page.on("pageerror", (error) => {
            errors.push(`pageerror: ${error.message}`);
          });
          page.on("console", (message) => {
            if (message.type() === "error") {
              errors.push(`console: ${message.text()}`);
            }
          });

          if (check.storageMode === "blocked") {
            await page.addInitScript(() => {
              Object.defineProperty(window, "localStorage", {
                configurable: true,
                get() {
                  throw new DOMException("localStorage disabled for compatibility smoke test", "SecurityError");
                },
              });
            });
          }

          await page.goto(`http://127.0.0.1:${port}${check.route}`, { waitUntil: "load", timeout: 60000 });
          await page.waitForTimeout(1200);

          const overflow = await page.evaluate(() => {
            const root = document.documentElement;
            return root.scrollWidth - root.clientWidth;
          });

          if (overflow > 1) {
            errors.push(`horizontal overflow detected: ${overflow}px`);
          }

          if (check.toggleTheme) {
            await page.getByRole("button", { name: /switch to/i }).click();
            await page.waitForTimeout(200);
          }

          const fileName = `${browserName}-${routeLabel(check.route)}-${check.viewport.width}x${check.viewport.height}.png`;
          await page.screenshot({ path: path.join(artifactDir, fileName), fullPage: true });
          await page.close();

          if (errors.length > 0) {
            throw new Error(`${browserName} ${check.route} ${check.viewport.width}x${check.viewport.height}\n${errors.join("\n")}`);
          }
        }
      } finally {
        await browser.close();
      }
    }
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  console.log(`Compatibility smoke checks passed. Artifacts: ${artifactDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
