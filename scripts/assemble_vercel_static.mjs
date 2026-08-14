#!/usr/bin/env node
/**
 * Assemble a Vercel static output of THIS Phase 3 app:
 * vinext client shell + frozen public/data/*.gz (byte-identical).
 *
 * Why: `vercel.json` outputDirectory `public` is data-only (W11 host 404s `/`).
 * vinext start 404s nested `/data/*.gz`. The 3012 wrapper is localhost-only
 * and must not ship. This folder is the production static cutover payload.
 *
 * Does not mutate frozen gz bytes. Requires a live 3012 HTML capture of the
 * same local build (RSC bootstrap is inlined in the first document).
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appRoot = resolve(root, "app");
const distClient = resolve(appRoot, "dist/client");
const publicData = resolve(appRoot, "public/data");
const outDir = resolve(appRoot, "vercel-out");
const previewOrigin = (process.env.PREVIEW_ORIGIN || "http://127.0.0.1:3012").replace(/\/+$/, "");

const FROZEN = {
  "app-data.json.gz": "7a848a3174e74090709842903ca7d30c85691250cadc2b8d7e564b0641314614",
  "place-labels.json.gz": "21196fcdd9d89d03092a9f4abb8572e060861f0cb828fc2fa731e07adf9032b9",
  "ranked-places.geojson.gz": "56e2e2a3d62d31eb88bdffe434210001554bf658a3eac4a62bb020af5dd27972",
  "situate-1f-index.json.gz": "4d9d51ff8d5ba8011ade86bd37c262c0bca5a7cb0dcf28f2d93c75af49416d8f",
  "situate-approach-context-v1.json.gz": "b86e702c5c9de6bc7e14e08f876c77220e27d6d6b7d6c95dfff8c88f0a4f3ba9",
  "situate-approach-context-wave2-v1.json.gz": "5dc43770ffb74d5d676bda73e0a0c754fe92f2146ffc1c92fdedccad762e4ddf",
  "uncertainty.geojson.gz": "a64edd932ce3abdd78eea74a7fa9dde880000ced374b841520f6906109ad5137",
  "p2-5-ui-objects-v1.json.gz": "b33dcc8a9e21ad88e5798eb772f85ee7157e512de09ce49fdc10394921a7d454",
};

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!existsSync(join(distClient, "_next"))) {
  fail("Missing dist/client/_next. Run: cd phase-3/app && npm run build");
}
if (!existsSync(publicData)) {
  fail("Missing public/data");
}

const htmlProc = spawnSync("curl", ["-sS", "-m", "12", "-f", `${previewOrigin}/`], {
  encoding: "utf8",
  maxBuffer: 4 * 1024 * 1024,
});
if (htmlProc.status !== 0) {
  fail(
    `Need a live Phase 3 HTML capture from ${previewOrigin}/ (exit ${htmlProc.status}): ${htmlProc.stderr || htmlProc.stdout || "no body"}. Start PORT=3011 vinext then node phase-3/start_local_preview.mjs`,
  );
}
let html = htmlProc.stdout;
if (!html.includes("Harm Lens") || !html.includes("Loading frozen Phase 2 objects")) {
  fail("Captured HTML is not the Phase 3 app shell.");
}
html = html
  .replaceAll("http://localhost:3011", "")
  .replaceAll("http://127.0.0.1:3011", "")
  .replaceAll("http://localhost:3012", "")
  .replaceAll("http://127.0.0.1:3012", "");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(distClient, outDir, {
  recursive: true,
  filter: (src) => !src.includes(`${distClient}/.vite`) && !src.endsWith(".assetsignore"),
});

const outData = join(outDir, "data");
mkdirSync(outData, { recursive: true });
cpSync(publicData, outData, { recursive: true });

for (const [name, expected] of Object.entries(FROZEN)) {
  const got = sha256(join(outData, name));
  if (got !== expected) {
    fail(`Frozen hash mismatch for ${name}: ${got} != ${expected}`);
  }
  const distHash = sha256(join(distClient, "data", name));
  if (distHash !== expected) {
    fail(`dist/client/data/${name} hash mismatch: ${distHash}`);
  }
}

writeFileSync(join(outDir, "index.html"), html);
writeFileSync(
  join(outDir, "vercel-out-manifest.json"),
  `${JSON.stringify(
    {
      assembled_at: new Date().toISOString(),
      source: "phase-3/app dist/client + public/data + 3012 HTML capture",
      preview_origin: previewOrigin,
      wrapper_shipped: false,
      frozen_hashes: FROZEN,
    },
    null,
    2,
  )}\n`,
);

console.log(`Assembled ${outDir}`);
console.log("Frozen gz hashes verified against public/data and dist/client/data.");
console.log("index.html captured from", previewOrigin);
