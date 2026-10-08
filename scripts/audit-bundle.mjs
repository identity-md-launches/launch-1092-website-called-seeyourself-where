import { readdir, stat, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert/strict";
const excludedRoots = new Set([
  ".git",
  ".github",
  ".imd",
  ".agents",
  ".aws",
  ".codex",
  "test",
]);
const entries = [];
async function walk(directory = ".") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (directory === "." && excludedRoots.has(entry.name)) continue;
    const path = join(directory, entry.name);
    assert.ok(
      !entry.isSymbolicLink(),
      `Submodule/symlink is not a deliverable: ${path}`,
    );
    assert.ok(
      !["node_modules", ".npm", ".cache", ".vite"].includes(entry.name),
      `Generated dependency/cache directory: ${path}`,
    );
    assert.ok(
      !entry.name.startsWith(".env"),
      `Environment file found: ${path}`,
    );
    if (entry.isDirectory()) await walk(path);
    else {
      assert.ok(
        !/\.(tgz|zip|tar|gz|log)$/.test(entry.name),
        `Unnecessary archive or log: ${path}`,
      );
      entries.push({ path, bytes: (await stat(path)).size });
    }
  }
}
await walk();
const html = await readFile("dist/index.html", "utf8");
assert.match(html, /src="\.\/assets\//);
assert.match(html, /href="\.\/assets\//);
assert.ok(!/https?:\/\//.test(html));
assert.ok(
  !(await readFile("dist/runtime-config.json", "utf8")).includes(
    "STUDIO_PROVIDER_KEY",
  ),
);
const clips = (await readdir("public/media")).filter(
  (name) => name.endsWith(".mp4") && name !== "hero.mp4",
);
assert.equal(clips.length, 15);
for (const clip of clips)
  for (const extension of ["mp4", "webm", "jpg"]) {
    const name = clip.replace(".mp4", `.${extension}`);
    assert.ok((await stat(`dist/media/${name}`)).size > 0);
    assert.ok(
      (await readFile(`dist/media/${name}`)).equals(
        await readFile(`public/media/${name}`),
      ),
      `Stale media export: ${name}`,
    );
  }
const total = entries.reduce((sum, entry) => sum + entry.bytes, 0);
const report = {
  limitBytes: 8388608,
  deliveredFileBytes: total,
  marginBytes: 8388608 - total,
  productionExportBytes: entries
    .filter((entry) => entry.path.startsWith("dist/"))
    .reduce((sum, entry) => sum + entry.bytes, 0),
  files: entries.length,
  localClips: clips.length,
  localPlaybackFormats: ["MP4", "WebM"],
  relativeAssetUrls: true,
  excludedGeneratedDependencies: true,
  note: "Uncompressed sum of deliverable files, excluding supplied inputs and protected metadata. Git metadata was not modified. This is a conservative content-size bound, not a packed Git bundle measurement.",
};
assert.ok(
  total < 8388608 - 4096,
  `Submission content exceeds budget: ${total}`,
);
await writeFile(
  "artifacts/bundle-report.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
