import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(
  process.env.SEEYOURSELF_DEPS
    ? join(process.env.SEEYOURSELF_DEPS, "package.json")
    : import.meta.url,
);
const sharp = require("sharp");

// Pass a locally downloaded Tears of Steel 720p movie. Only licensed silent excerpts ship.
const source = process.argv[2];
if (!source)
  throw Error("Usage: node scripts/prepare-media.mjs /tmp/tears-of-steel.mov");
mkdirSync("public/media", { recursive: true });
const scenes = [
  ["the-last-word", 182],
  ["main-character", 319],
  ["plot-twist", 409],
  ["mission-ready", 126],
  ["not-impressed", 167],
  ["future-you", 530],
  ["loading-brain", 57],
  ["the-standoff", 147],
  ["monday-mood", 408],
  ["zero-gravity", 211],
  ["one-more-take", 200],
];
function ffmpeg(args) {
  const result = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { stdio: "inherit" },
  );
  if (result.status) throw Error("Media encoding failed");
}
// Dedicated hero crop keeps the actor visible at both narrow and wide widths.
ffmpeg([
  "-ss",
  "319",
  "-i",
  source,
  "-t",
  "5",
  "-an",
  "-vf",
  "crop=iw*0.55:ih:iw*0.23:0,scale=600:-2,fps=20",
  "-c:v",
  "libx264",
  "-preset",
  "fast",
  "-crf",
  "29",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  "public/media/hero.mp4",
]);
ffmpeg([
  "-ss",
  "1",
  "-i",
  "public/media/hero.mp4",
  "-frames:v",
  "1",
  "-q:v",
  "3",
  "public/media/hero.jpg",
]);
const watermark = join(tmpdir(), "seeyourself-watermark.png");
await sharp(
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="162" height="26"><rect width="162" height="26" rx="5" fill="#111110"/><text x="9" y="17" font-family="sans-serif" font-size="11" fill="white">AI-generated · SAMPLE</text></svg>',
  ),
)
  .png()
  .toFile(watermark);
for (const [id, start] of scenes) {
  ffmpeg([
    "-ss",
    String(start),
    "-i",
    source,
    "-i",
    watermark,
    "-t",
    "5",
    "-an",
    "-filter_complex",
    "[0:v]scale=640:-2,fps=20[video];[video][1:v]overlay=W-w-12:12",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "29",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    `public/media/${id}.mp4`,
  ]);
  ffmpeg([
    "-ss",
    String(start + 1),
    "-i",
    source,
    "-frames:v",
    "1",
    "-vf",
    "scale=640:-2",
    "-q:v",
    "4",
    `public/media/${id}.jpg`,
  ]);
}
// Original illustrated scene templates, created for SeeYourself (CC0).
for (const [id, type, bg, accent] of [
  ["midnight-drive", "drive", "#141b38", "#eb7582"],
  ["coastal-escape", "drive", "#366b71", "#f8bf7f"],
  ["winning-shot", "sport", "#194b44", "#f59b59"],
  ["victory-lap", "sport", "#51404b", "#efb865"],
]) {
  const scene =
    type === "drive"
      ? `<circle cx="470" cy="115" r="64" fill="${accent}"/><path d="M0 200L150 100 270 220 400 160 640 210V360H0" fill="#162930"/><path d="M280 192L355 192 580 360H60" fill="#24232e"/><path d="M316 215L322 215 331 260H311M307 290L339 290 354 360H290" fill="${accent}"/><path d="M0 309Q320 270 640 309V360H0" fill="#11151a"/><ellipse cx="220" cy="315" rx="76" ry="45" fill="none" stroke="#626273" stroke-width="14"/><path d="M170 351L193 304 211 300 213 337M267 351L244 304 226 300 224 337" fill="#d9a784"/><rect x="400" y="308" width="105" height="31" rx="5" fill="#263637"/><path d="M411 324H428L440 316 450 333 462 322H495" fill="none" stroke="${accent}" stroke-width="2"/>`
      : `<path d="M0 235H640V360H0" fill="#be8056"/><path d="M0 330H640M320 235V360" stroke="#efd6b8" stroke-width="3"/><ellipse cx="320" cy="325" rx="130" ry="33" fill="none" stroke="#efd6b8" stroke-width="3"/><rect x="479" y="55" width="8" height="185" fill="#e3ccb8"/><rect x="434" y="50" width="101" height="65" rx="4" fill="#dddacf"/><rect x="460" y="76" width="43" height="28" fill="none" stroke="#393c35" stroke-width="3"/><path d="M454 112H511L499 148H466Z" fill="none" stroke="#eee0cb" stroke-width="3"/><ellipse cx="297" cy="323" rx="48" ry="10" fill="#89583e"/><circle cx="287" cy="159" r="19" fill="#dca985"/><path d="M267 183H308L319 246H264Z" fill="${accent}"/><path d="M270 191L247 166 262 120M302 191L324 149 356 126" fill="none" stroke="#dca985" stroke-width="14" stroke-linecap="round"/><path d="M280 247L271 281 244 302M303 247L318 281 338 300" fill="none" stroke="#192b30" stroke-width="19" stroke-linecap="round"/><circle cx="365" cy="107" r="22" fill="#e88543"/><path d="M345 107H385M365 86V129" stroke="#593d32" stroke-width="2"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="${bg}"/>${scene}</svg>`;
  const tmp = join(tmpdir(), `seeyourself-${id}.svg`);
  writeFileSync(tmp, svg);
  await sharp(Buffer.from(svg))
    .jpeg({ quality: 88 })
    .toFile(`public/media/${id}.jpg`);
  ffmpeg([
    "-loop",
    "1",
    "-i",
    `public/media/${id}.jpg`,
    "-i",
    watermark,
    "-t",
    "5",
    "-filter_complex",
    "[0:v]zoompan=z='1+0.0005*on':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=100:s=640x360:fps=20[video];[video][1:v]overlay=W-w-12:12",
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "29",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    `public/media/${id}.mp4`,
  ]);
}

// Royalty-free playback fallback for Chromium builds without proprietary H.264 codecs.
for (const file of readdirSync("public/media").filter((name) =>
  name.endsWith(".mp4"),
)) {
  ffmpeg([
    "-i",
    `public/media/${file}`,
    "-an",
    "-c:v",
    "libvpx-vp9",
    "-b:v",
    "0",
    "-crf",
    "40",
    "-row-mt",
    "1",
    `public/media/${file.replace(".mp4", ".webm")}`,
  ]);
}
