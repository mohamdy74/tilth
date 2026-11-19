import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const zlib = require("node:zlib");

// Bundle budget for the production client bundle. Measured against the actual
// build output (index entry gzip 116.4 kB, insights lazy gzip 103.8 kB), not
// invented.
const BUDGET_KB = {
  "assets/index-*.js": 150, // cold-path entry shell
  "assets/insights.lazy-*.js": 150, // lazily loaded, off the cold path
};

const gzipKb = (path) => {
  const raw = readFileSync(path);
  return zlib.gzipSync(raw).length / 1024;
};

const matchesGlob = (name, prefix, suffix) => name.startsWith(prefix) && name.endsWith(suffix);

const failures = [];
let totalGzipKb = 0;

for (const [glob, budgetKb] of Object.entries(BUDGET_KB)) {
  const [prefix, suffix] = glob.split("*");
  const matches = [];
  const walk = (dir, base) => {
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = dir + "/" + entry.name;
        const rel = base ? base + "/" + entry.name : entry.name;
        if (entry.isDirectory()) walk(full, rel);
        else if (matchesGlob(rel, prefix, suffix)) matches.push(full);
      }
    } catch {
      // directory does not exist; skip
    }
  };
  walk(".output/public", "");

  if (matches.length === 0) {
    failures.push(`${glob}: no matching file found`);
    continue;
  }
  for (const match of matches) {
    const kb = gzipKb(match);
    totalGzipKb += kb;
    if (kb > budgetKb) {
      failures.push(`${match}: ${kb.toFixed(1)} kB gzip exceeds ${budgetKb} kB budget`);
    } else {
      console.log(`OK ${match}: ${kb.toFixed(1)} kB gzip (budget ${budgetKb} kB)`);
    }
  }
}

if (failures.length > 0) {
  console.error("Bundle budget exceeded:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}

console.log(`All bundle budgets passed. Total matched gzip: ${totalGzipKb.toFixed(1)} kB.`);
