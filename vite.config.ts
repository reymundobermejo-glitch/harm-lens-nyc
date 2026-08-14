import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const appRoot = dirname(fileURLToPath(import.meta.url));

const GZ_PAYLOAD_HEADERS_BLOCK = [
  "",
  "# First-class /data/*.gz payloads (W11) — file bytes, not Content-Encoding",
  "/data/*.gz",
  "  Content-Type: application/gzip",
  "  Content-Encoding: identity",
  "  Cache-Control: public, max-age=0, must-revalidate",
  "  X-Content-Type-Options: nosniff",
  "",
].join("\n");

function gzipServingHeaders() {
  return {
    name: "gzip-serving-headers",
    enforce: "post" as const,
    closeBundle() {
      const headersPath = resolve(appRoot, "dist/client/_headers");
      let current = "";
      try {
        current = readFileSync(headersPath, "utf8");
      } catch {
        current = "";
      }
      if (current.includes("/data/*.gz")) return;
      mkdirSync(dirname(headersPath), { recursive: true });
      const prefix = current.replace(/\s*$/, "");
      writeFileSync(headersPath, prefix ? `${prefix}\n${GZ_PAYLOAD_HEADERS_BLOCK}` : GZ_PAYLOAD_HEADERS_BLOCK);
    },
  };
}

function copyMapLibreWorker() {
  const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];
  const srcDir = resolve(appRoot, "node_modules/maplibre-gl/dist");
  const copyTo = (dir: string) => {
    mkdirSync(dir, { recursive: true });
    for (const file of files) copyFileSync(resolve(srcDir, file), resolve(dir, file));
  };
  return {
    name: "copy-maplibre-worker",
    enforce: "post" as const,
    writeBundle() {
      copyTo(resolve(appRoot, "dist/client"));
      copyTo(resolve(appRoot, "dist/client/_next/static/chunks"));
    },
    closeBundle() {
      copyTo(resolve(appRoot, "dist/client"));
      copyTo(resolve(appRoot, "dist/client/_next/static/chunks"));
    },
  };
}

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    // MapLibre ships its Web Worker as a module-relative asset. Pre-bundling
    // rewrites that path under vinext and leaves the GeoJSON worker missing in
    // local previews, which makes ranked nodes appear to vanish.
    optimizeDeps: { exclude: ["maplibre-gl"] },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      copyMapLibreWorker(),
      gzipServingHeaders(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
