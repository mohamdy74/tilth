// vite-plugin-pwa writes sw.js during the vite build, before nitro has
// assembled .output/public, so its precache list misses the client assets
// (assets/*.js|css|woff2) and offline would break. This script regenerates
// the service worker against the FINAL .output/public with workbox-build.
// Keep the workbox options in sync with vite.config.ts.

import { generateSW } from "workbox-build";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const outDir = join(process.cwd(), ".output", "public");
if (!existsSync(join(outDir, "_shell.html"))) {
  console.error("postbuild-sw: .output/public/_shell.html missing — must run after vite build");
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
console.log("postbuild-sw: regenerated .output/public/sw.js against the final build output");
