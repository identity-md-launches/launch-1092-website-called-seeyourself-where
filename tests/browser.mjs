import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, mkdir, stat, writeFile } from "node:fs/promises";
import { join, resolve, extname } from "node:path";
import { tmpdir } from "node:os";
const require = createRequire(
  process.env.SEEYOURSELF_DEPS
    ? resolve(process.env.SEEYOURSELF_DEPS, "package.json")
    : import.meta.url,
);
const { chromium } = require("playwright");
const { expect } = require("playwright/test");
const { default: AxeBuilder } = require("@axe-core/playwright");
const sharp = require("sharp");
const root = resolve("dist");
const errors = [],
  failures = [],
  reports = [],
  requests = [];
const types = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};
const server = createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    if (!path.startsWith("/preview/")) {
      response.writeHead(404);
      response.end();
      return;
    }
    const file = resolve(root, path.slice(9) || "index.html");
    if (!file.startsWith(root + "/") && file !== root) throw Error("Forbidden");
    const bytes = await readFile(file);
    response.setHeader(
      "Content-Type",
      types[extname(file)] || "application/octet-stream",
    );
    response.end(bytes);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
    permissions: ["camera", "microphone"],
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => {
    if (!request.failure()?.errorText.includes("ERR_ABORTED"))
      failures.push(request.url());
  });
  page.on("request", (request) => requests.push(request.url()));
  page.on("response", (response) => {
    if (response.status() >= 400)
      failures.push(`${response.status()} ${response.url()}`);
  });
  async function screenshot(name) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `artifacts/${name}.jpg`,
      fullPage: true,
      type: "jpeg",
      quality: 78,
    });
  }
  async function audit(name) {
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    reports.push({
      name,
      violations: result.violations.map((item) => ({
        id: item.id,
        impact: item.impact,
        nodes: item.nodes.map((n) => ({
          html: n.html,
          failure: n.failureSummary,
        })),
      })),
    });
  }
  async function go(route) {
    await page.goto(url + "#" + route);
    await page.waitForFunction(() => document.querySelector("h1"));
  }
  async function noOverflow(label) {
    const sizes = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }));
    assert.ok(
      sizes.scroll <= sizes.viewport,
      `${label}: ${JSON.stringify(sizes)}`,
    );
  }
  await go("/");
  await page.locator(".hero-player video").evaluate((video) => video.pause());
  await page.evaluate(() => document.fonts.ready);
  assert.equal(
    await page.evaluate(() => document.fonts.check("600 16px Manrope")),
    true,
  );
  await screenshot("home-desktop");
  await audit("home-desktop");
  const contrast = await page.evaluate(() => {
    const rgb = (value) =>
      value
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number);
    const luminance = (value) =>
      rgb(value)
        .map((x) => {
          const s = x / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
    const background = getComputedStyle(
      document.documentElement,
    ).backgroundColor;
    return [
      ["Body text on page", "h1", background, 4.5],
      ["Secondary text on page", ".hero-description", background, 4.5],
      ["Large step numbers on page", ".step-number", background, 3],
      [
        "Primary button text on fill",
        ".button.primary",
        getComputedStyle(document.querySelector(".button.primary"))
          .backgroundColor,
        4.5,
      ],
    ].map(([name, selector, bg, required]) => {
      const fg = getComputedStyle(document.querySelector(selector)).color;
      const [a, b] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
      return {
        name,
        foreground: fg,
        background: bg,
        ratio: Number(((a + 0.05) / (b + 0.05)).toFixed(2)),
        required,
      };
    });
  });
  assert.ok(contrast.every((pair) => pair.ratio >= pair.required));
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.textContent),
    "Skip to content",
  );
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => document.activeElement.id), "main");
  // A representative keyboard path into a preview; native dialog traps focus and Escape restores it.
  await page
    .getByRole("button", { name: "Preview The last word", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await page.evaluate(
      () => document.activeElement.closest("dialog") !== null,
    ),
    true,
  );
  await page.keyboard.press("Escape");
  assert.equal(
    await page.evaluate(() =>
      document.activeElement.getAttribute("aria-label"),
    ),
    "Preview The last word",
  );
  await screenshot("keyboard-focus");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page.locator(".hero-player video").evaluate((video) => video.paused),
    true,
  );
  await page.getByRole("link", { name: "Try it", exact: true }).click();
  await page.getByRole("button", { name: "Continue to clips" }).click();
  await page
    .getByText("Add a clear selfie to continue, or explore with a sample.")
    .waitFor();
  const fixture = join(tmpdir(), "seeyourself-synthetic-selfie.png");
  await sharp(
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#bad9c6"/><circle cx="200" cy="185" r="95" fill="#f4d2ae"/><circle cx="170" cy="175" r="8"/><circle cx="230" cy="175" r="8"/><path d="M170 222 Q200 245 230 222" fill="none" stroke="#46342c" stroke-width="6"/><path d="M70 400Q75 270 200 280Q325 270 330 400" fill="#393e63"/></svg>',
    ),
  )
    .png()
    .toFile(fixture);
  await page.locator("#selfie").setInputFiles({
    name: "invalid.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await page
    .getByText("Choose a JPG, PNG, or WebP photo smaller than 10 MB.")
    .waitFor();
  await page.locator("#selfie").setInputFiles(fixture);
  await page.getByText("Selfie added. Choose a different photo").waitFor();
  await page.getByRole("button", { name: "Continue to clips" }).click();
  await page
    .getByText("Confirm that this is your own face and voice.")
    .waitFor();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Start camera check" }).click();
  await page
    .getByText("Recording captured — not yet verified in preview mode.")
    .waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Record 20 seconds" }).click();
  await page
    .getByText("Voice sample captured", { exact: true })
    .first()
    .waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Remove voice sample" }).click();
  await page.getByRole("button", { name: "Continue to clips" }).click();
  await page
    .getByText("Live verification is not connected in this preview.", {
      exact: false,
    })
    .waitFor();
  await audit("setup-errors-and-captured-proof");
  await page
    .getByRole("button", { name: "Explore with a sample", exact: false })
    .click();
  await expect(page.locator(".clip-card")).toHaveCount(15);
  await page.getByRole("button", { name: "Sports", exact: true }).click();
  await expect(page.locator(".clip-card")).toHaveCount(2);
  await page
    .getByRole("searchbox", { name: "Search scenes" })
    .fill("nonexistent-film");
  await page.getByRole("heading", { name: "No scenes found" }).waitFor();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator(".clip-card")).toHaveCount(15);
  await page
    .getByRole("searchbox", { name: "Search scenes" })
    .fill("last word");
  await expect(page.locator(".clip-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Preview The last word" }).click();
  await audit("clip-preview-dialog");
  await page.getByRole("button", { name: "Put me in this" }).click();
  await page.getByRole("heading", { name: "Setting the scene…" }).waitFor();
  await page.getByRole("heading", { name: "Your scene is ready." }).waitFor();
  await page.waitForFunction(
    () => document.querySelector(".result-video video")?.readyState > 0,
  );
  await screenshot("result-desktop");
  await audit("result");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download sample" }).click();
  const download = await downloadPromise;
  assert.equal(
    download.suggestedFilename(),
    "seeyourself-the-last-word-sample.mp4",
  );
  const downloadPath = join(tmpdir(), "seeyourself-test-download.mp4");
  await download.saveAs(downloadPath);
  assert.ok((await stat(downloadPath)).size > 10000);
  for (const platform of ["WhatsApp", "X", "Instagram"]) {
    await page.getByRole("button", { name: platform, exact: true }).click();
    await page.getByRole("heading", { name: `Share to ${platform}` }).waitFor();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
  }
  await page.getByRole("link", { name: "My videos", exact: true }).click();
  await expect(page.locator(".saved-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Delete face & voice data" }).click();
  await page
    .getByRole("button", { name: "Delete face and voice data", exact: true })
    .click();
  await page
    .getByText("No face or voice data saved.", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Delete The last word" }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".saved-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Delete The last word" }).click();
  await page.getByRole("button", { name: "Delete video", exact: true }).click();
  await page
    .getByRole("heading", { name: "Your first scene starts here." })
    .waitFor();
  assert.match(await page.locator(".credit-pill").innerText(), /2 free/);
  await audit("my-videos-empty");
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("link", { name: "Explore clips", exact: true })
      .first()
      .click();
    await page.getByRole("searchbox").fill("");
    await page
      .getByRole("button", { name: "Preview Main character energy" })
      .click();
    await page.getByRole("button", { name: "Put me in this" }).click();
    await page.getByRole("heading", { name: "Your scene is ready." }).waitFor();
  }
  await page.getByRole("link", { name: "Try another clip" }).click();
  await page.getByRole("button", { name: "Preview The last word" }).click();
  await page.getByRole("button", { name: "See credit packs" }).click();
  await page
    .getByRole("heading", { name: "Keep the good takes coming." })
    .waitFor();
  await page.getByRole("button", { name: "Get 30 credits" }).click();
  await page
    .getByRole("heading", { name: "Credit packs are coming soon." })
    .waitFor();
  await page.getByRole("button", { name: "Cancel" }).click();
  await audit("pricing");
  await page.reload();
  assert.match(await page.locator(".credit-pill").innerText(), /0 free/);
  await go("/videos");
  await expect(page.locator(".saved-card")).toHaveCount(2);
  const reflow = [];
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/setup",
      "/clips",
      "/videos",
      "/pricing",
      "/privacy",
      "/result",
    ]) {
      await go(route);
      await noOverflow(`${width} ${route}`);
      reflow.push({ width, route, overflow: false });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await go("/");
  await screenshot("home-mobile");
  await audit("home-mobile");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Explore clips" })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "Open navigation" })
      .getAttribute("aria-expanded"),
    "false",
  );
  await screenshot("library-mobile");
  await audit("library-mobile");
  await go("/setup");
  await screenshot("setup-mobile");
  await audit("setup-mobile");
  await page.setViewportSize({ width: 768, height: 1000 });
  await go("/clips");
  await page.evaluate(() => (document.documentElement.style.fontSize = "32px"));
  await noOverflow("200% text size /clips");
  await page.evaluate(() => (document.documentElement.style.fontSize = ""));
  await page.emulateMedia({ forcedColors: "active" });
  const forcedOutline = await page
    .getByRole("button", { name: "All scenes", exact: true })
    .evaluate((el) => {
      el.focus();
      return getComputedStyle(el).borderStyle;
    });
  assert.equal(forcedOutline, "solid");
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  // A completed render must not resurrect a sample deleted while that render was pending.
  const raceContext = await browser.newContext();
  const race = await raceContext.newPage();
  await race.goto(url + "#/clips");
  await race.getByRole("button", { name: "Preview The last word" }).click();
  await race.getByRole("button", { name: "Put me in this" }).click();
  await race.getByRole("heading", { name: "Your scene is ready." }).waitFor();
  await race.getByRole("link", { name: "Try another clip" }).click();
  await race
    .getByRole("button", { name: "Preview Main character energy" })
    .click();
  await race.getByRole("button", { name: "Put me in this" }).click();
  await race.getByRole("heading", { name: "Setting the scene…" }).waitFor();
  await race.getByRole("link", { name: "My videos", exact: true }).click();
  await race.getByRole("button", { name: "Delete The last word" }).click();
  await race.getByRole("button", { name: "Delete video", exact: true }).click();
  await expect(
    race.getByRole("button", { name: "Preview The last word" }),
  ).toHaveCount(0);
  await expect(
    race.getByRole("button", { name: "Preview Main character energy" }),
  ).toHaveCount(1);
  await expect(race.locator(".saved-card")).toHaveCount(1);
  await race.reload();
  await expect(race.locator(".saved-card")).toHaveCount(1);
  await expect(race.locator(".credit-pill")).toContainText("1 free video");
  await raceContext.close();
  const report = {
    contrast,
    browser: browser.version(),
    urlPath: "/preview/",
    checks: [
      "upload validation",
      "consent gate",
      "5-second camera capture using fake device",
      "20-second voice recording using fake device",
      "sample disclosure",
      "15 clips",
      "category filters",
      "search",
      "empty search recovery",
      "dialog keyboard focus and Escape",
      "loading and result",
      "MP4 download",
      "all three share fallbacks",
      "identity deletion",
      "video delete cancellation and confirmation",
      "three-credit cap",
      "pricing checkout disclosure",
      "reload persistence",
      "mobile navigation",
      "reduced motion pauses autoplay",
      "200% text enlargement at 768px",
      "forced-color borders",
      "font loading",
      "deletion during pending generation does not restore deleted history or credits",
    ],
    reflow,
    axe: reports,
    errors,
    failures,
    thirdPartyRequests: requests.filter(
      (item) =>
        !item.startsWith(url.split("/preview/")[0]) &&
        !item.startsWith("blob:") &&
        !item.startsWith("data:"),
    ),
  };
  await writeFile(
    "artifacts/browser-results.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
  assert.ok(
    reports.every((report) => report.violations.length === 0),
    "Accessibility violations found; see artifacts/browser-results.json",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
