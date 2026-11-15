// vite-plugin-pwa writes sw.js during the vite build, before the final client
// output is assembled, so its precache list misses client assets and offline
// would break. This script regenerates the worker beside the prerendered shell.
// Keep the workbox options in sync with vite.config.ts.

import { generateSW } from "workbox-build";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

function findShellDirs(root, matches = []) {
  if (existsSync(join(root, "_shell.html"))) matches.push(root);

  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return matches;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    findShellDirs(join(root, entry.name), matches);
  }

  return matches;
}

const cwd = process.cwd();
const outDir = [join(cwd, ".output"), join(cwd, "dist")]
  .flatMap((root) => findShellDirs(root))
  .sort(
    (a, b) => statSync(join(b, "_shell.html")).mtimeMs - statSync(join(a, "_shell.html")).mtimeMs,
  )[0];

if (!outDir) {
  console.error(
    "postbuild-sw: could not find _shell.html under .output/ or dist/ — must run after vite build",
  );
  process.exit(1);
}

const shellRevision = createHash("md5")
  .update(readFileSync(join(outDir, "_shell.html")))
  .digest("hex");

await generateSW({
  globDirectory: outDir,
  // woff2 only, same as vite.config.ts: SW-capable browsers all support woff2;
  // the legacy .woff fallbacks stay served but are not precached.
  globPatterns: ["**/*.{js,css,woff2,svg,png,ico,webmanifest,jpg}"],
  // The OS fetches manifest/home-screen icons in its own context at install
  // time and never consults this cache — precaching them is dead weight
  // (DOWNFORCE lesson). The worker must never precache itself.
  globIgnores: ["icons/*.png", "sw.js", "workbox-*.js"],
  additionalManifestEntries: [{ url: "_shell.html", revision: shellRevision }],
  navigateFallback: "_shell.html",
  cleanupOutdatedCaches: true,
  skipWaiting: false,
  clientsClaim: true,
  inlineWorkboxRuntime: true,
  swDest: join(outDir, "sw.js"),
});

// Self-check: the published worker must precache the app shell and the
// hashed assets, and keep the SKIP_WAITING listener the update banner uses.
const sw = readFileSync(join(outDir, "sw.js"), "utf8");
for (const needle of ["_shell.html", "assets/", "SKIP_WAITING", "precache"]) {
  if (!sw.includes(needle)) {
    console.error(`postbuild-sw: generated sw.js is missing ${needle}`);
    process.exit(1);
  }
}
// Drop a stale workbox runtime left by the plugin-generated sw.js.
for (const f of readdirSync(outDir)) {
  if (f.startsWith("workbox-")) rmSync(join(outDir, f));
}
console.log(`postbuild-sw: regenerated ${join(outDir, "sw.js")} against the final build output`);
