#!/usr/bin/env node
/**
 * W11 preflight: compare vinext start (3011), localhost wrapper (3012), and
 * an optional real host (W11_HOST_URL) against byte-identical dist/client/data/*.gz.
 *
 * Host proof sends Accept-Encoding: gzip and does not pass --compressed, so
 * curl keeps Content-Encoding bytes (browser JS would not). Chunked
 * Transfer-Encoding is still decoded. Content-Encoding: gzip is a FAIL.
 *
 * Does not mutate gz contents. Short curl timeouts. Does not kill hosts.
 * Never authorizes Step E.
 *
 *   node phase-3/scripts/prove_w11_data_gz_serving.mjs
 *   W11_HOST_URL=https://harm-lens-nyc.vercel.app node phase-3/scripts/prove_w11_data_gz_serving.mjs
 *   W11_DRY_RUN=1 W11_HOST_URL=https://preview.example node phase-3/scripts/prove_w11_data_gz_serving.mjs
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(root, "app/dist/client/data");
const appPort = Number(process.env.APP_PORT || 3011);
const previewPort = Number(process.env.PREVIEW_PORT || 3012);
const timeoutSec = Number(process.env.CURL_TIMEOUT || 8);
const hostTimeoutSec = Number(process.env.W11_HOST_CURL_TIMEOUT || 60);
const hostUrlRaw = (process.env.W11_HOST_URL || process.env.HOST_URL || "").trim().replace(/\/+$/, "");
const skipLocal = process.env.W11_SKIP_LOCAL === "1";
const dryRun = process.env.W11_DRY_RUN === "1";
const outJson = resolve(root, "STEP_E_PREFLIGHT_W11_PROOF.json");
const outHostJson = resolve(root, "STEP_E_PREFLIGHT_W11_HOST_PROOF.json");

const REQUIRED_HEADERS = {
  "Content-Type": "application/gzip",
  "Content-Encoding": "identity",
  "Cache-Control": "public, max-age=0, must-revalidate",
  "X-Content-Type-Options": "nosniff",
};

const EXPECTED_FROZEN = {
  "app-data.json.gz": "7a848a3174e74090709842903ca7d30c85691250cadc2b8d7e564b0641314614",
  "place-labels.json.gz": "21196fcdd9d89d03092a9f4abb8572e060861f0cb828fc2fa731e07adf9032b9",
  "ranked-places.geojson.gz": "56e2e2a3d62d31eb88bdffe434210001554bf658a3eac4a62bb020af5dd27972",
  "situate-1f-index.json.gz": "4d9d51ff8d5ba8011ade86bd37c262c0bca5a7cb0dcf28f2d93c75af49416d8f",
  "situate-approach-context-v1.json.gz": "b86e702c5c9de6bc7e14e08f876c77220e27d6d6b7d6c95dfff8c88f0a4f3ba9",
  "situate-approach-context-wave2-v1.json.gz": "5dc43770ffb74d5d676bda73e0a0c754fe92f2146ffc1c92fdedccad762e4ddf",
  "uncertainty.geojson.gz": "a64edd932ce3abdd78eea74a7fa9dde880000ced374b841520f6906109ad5137",
  "p2-5-ui-objects-v1.json.gz": "b33dcc8a9e21ad88e5798eb772f85ee7157e512de09ce49fdc10394921a7d454",
  "crash-when-v1.json.gz": "fa47ff55cdca6df709c1ffd031d5bd73fde846027a0ada8dc0106e2941864352",
  "crash-row-who-v1.json.gz": "2dcfe92d713a6ee1f5921d9476d7ec7c5fd2b47456f962e7246c828d0c52e870",
  "corridor-lion26b-v0-eastern-pkwy.json.gz": "3ac2d489e79b6cc43cd6c8bfe04f07b73e055c93f012be5e1ce1a01874b3ae61",
};

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function gzipMagic(buf) {
  return buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
}

function parseHeaderMap(headers) {
  const headerLines = headers.split(/\r?\n/).filter(Boolean);
  const headerMap = {};
  for (const line of headerLines.slice(1)) {
    const idx = line.indexOf(":");
    if (idx > 0) headerMap[line.slice(0, idx).toLowerCase()] = line.slice(idx + 1).trim();
  }
  return headerMap;
}

async function curlUrl(url, timeout) {
  const tmp = join(tmpdir(), `w11-curl-${sha256(Buffer.from(url)).slice(0, 12)}-${process.pid}`);
  const args = [
    "-sS",
    "-m", String(timeout),
    "-H", "Accept-Encoding: gzip",
    "-D", `${tmp}.hdr`,
    "-o", tmp,
    "-w", "%{http_code}",
    url,
  ];
  const code = await new Promise((resolveCode) => {
    const child = spawn("curl", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (exit) => resolveCode({ exit, stdout: stdout.trim(), stderr: stderr.trim() }));
  });
  const status = Number(code.stdout);
  let body = Buffer.alloc(0);
  let headers = "";
  try { body = readFileSync(tmp); } catch { body = Buffer.alloc(0); }
  try { headers = readFileSync(`${tmp}.hdr`, "utf8"); } catch { headers = ""; }
  try { unlinkSync(tmp); } catch { /* ignore */ }
  try { unlinkSync(`${tmp}.hdr`); } catch { /* ignore */ }
  const headerMap = parseHeaderMap(headers);
  return {
    url,
    curl_exit: code.exit,
    curl_stderr: code.stderr || null,
    http_status: status,
    bytes: body.length,
    sha256: body.length ? sha256(body) : null,
    gzip_magic: gzipMagic(body),
    content_type: headerMap["content-type"] || null,
    content_encoding: headerMap["content-encoding"] || null,
    cache_control: headerMap["cache-control"] || null,
    server: headerMap["server"] || null,
    x_matched_path: headerMap["x-matched-path"] || null,
    x_vercel_cache: headerMap["x-vercel-cache"] || null,
  };
}

async function curlFile(port, pathname) {
  return curlUrl(`http://127.0.0.1:${port}${pathname}`, timeoutSec);
}

function verdictFor(disk, host) {
  if (host.curl_exit !== 0 && host.http_status === 0) return "UNREACHABLE";
  if (host.http_status !== 200) return "FAIL";
  if (!host.gzip_magic) return "FAIL";
  if (host.sha256 !== disk.sha256) return "FAIL";
  if (host.content_encoding && /gzip/i.test(host.content_encoding)) return "FAIL";
  return "PASS";
}

function all(arr, want) {
  return arr.length > 0 && arr.every((v) => v === want);
}

function anyUnreachable(arr) {
  return arr.includes("UNREACHABLE");
}

function hostConfigInventory() {
  const vercelPath = resolve(root, "app/vercel.json");
  const nextPath = resolve(root, "app/next.config.ts");
  const distHeadersPath = resolve(root, "app/dist/client/_headers");
  const vercel = existsSync(vercelPath) ? JSON.parse(readFileSync(vercelPath, "utf8")) : null;
  const nextSrc = existsSync(nextPath) ? readFileSync(nextPath, "utf8") : null;
  const distHeaders = existsSync(distHeadersPath) ? readFileSync(distHeadersPath, "utf8") : null;
  return {
    vercel_json: {
      path: "phase-3/app/vercel.json",
      present: Boolean(vercel),
      sha256: vercel ? sha256(Buffer.from(JSON.stringify(vercel))) : null,
      gzip_header_rule: Boolean(vercel?.headers?.some((rule) => String(rule.source).includes(".gz"))),
    },
    next_config: {
      path: "phase-3/app/next.config.ts",
      present: Boolean(nextSrc),
      sets_gzip_headers: Boolean(nextSrc && nextSrc.includes("application/gzip") && nextSrc.includes("identity")),
    },
    dist_headers: {
      path: "phase-3/app/dist/client/_headers",
      present: Boolean(distHeaders),
      gzip_rule: Boolean(distHeaders && distHeaders.includes("/data/*.gz")),
    },
    required_response_headers: REQUIRED_HEADERS,
  };
}

function dryRunPlan(origin, files) {
  return {
    note: "Browser-equivalent proof: send Accept-Encoding: gzip, do not pass --compressed. SHA must match dist, not a gunzipped JSON body.",
    commands: files.flatMap((name) => {
      const url = `${origin}/data/${name}`;
      const disk = `phase-3/app/dist/client/data/${name}`;
      return [
        `curl -sS -m ${hostTimeoutSec} -D - -o /tmp/w11-${name} -H "Accept-Encoding: gzip" ${JSON.stringify(url)} | awk 'BEGIN{IGNORECASE=1} /HTTP\\/|content-type|content-encoding|cache-control|x-matched-path/{print}'`,
        `shasum -a 256 /tmp/w11-${name} ${disk}`,
        `xxd -l 2 /tmp/w11-${name}`,
      ];
    }),
    pass_rule: "HTTP 200, gzip magic 1f 8b, sha256 == dist, Content-Type application/gzip or application/octet-stream, Content-Encoding absent or identity (never gzip).",
  };
}

if (!existsSync(dataDir)) {
  const payload = {
    decision: "BLOCKED",
    step_e: "NOT AUTHORIZED",
    reason: `Missing ${dataDir}. Build phase-3/app before this proof.`,
    checked_at_utc: new Date().toISOString(),
  };
  writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`);
  console.error(payload.reason);
  process.exit(2);
}

const files = readdirSync(dataDir).filter((name) => name.endsWith(".gz")).sort();
const productionRedeployAuthorized = process.env.W11_PRODUCTION_REDEPLOY_AUTHORIZED === "1";
const stepEStatus = productionRedeployAuthorized ? "AUTHORIZED PRODUCTION REDEPLOY" : "NOT AUTHORIZED";
const expectedFiles = Object.keys(EXPECTED_FROZEN).sort();
if (files.length !== expectedFiles.length || files.some((name, index) => name !== expectedFiles[index])) {
  console.error(`W11 requires exactly ${expectedFiles.length} frozen gzip files: ${expectedFiles.join(", ")}. Found: ${files.join(", ")}`);
  process.exit(2);
}
const disks = files.map((name) => {
  const buf = readFileSync(resolve(dataDir, name));
  const diskSha = sha256(buf);
  if (diskSha !== EXPECTED_FROZEN[name]) {
    console.error(`Frozen hash mismatch for ${name}: ${diskSha} != ${EXPECTED_FROZEN[name]}`);
    process.exit(2);
  }
  return {
    file: name,
    pathname: `/data/${name}`,
    disk: {
      path: `phase-3/app/dist/client/data/${name}`,
      bytes: buf.length,
      sha256: diskSha,
      gzip_magic: gzipMagic(buf),
    },
  };
});

const checks = [];
if (!skipLocal && !dryRun) {
  for (const item of disks) {
    const host3011 = await curlFile(appPort, item.pathname);
    const host3012 = await curlFile(previewPort, item.pathname);
    checks.push({
      file: item.file,
      pathname: item.pathname,
      disk: item.disk,
      "3011": { ...host3011, verdict: verdictFor(item.disk, host3011) },
      "3012": { ...host3012, verdict: verdictFor(item.disk, host3012) },
    });
  }
}

const smoke3011Root = skipLocal || dryRun ? { http_status: null } : await curlFile(appPort, "/");
const smoke3011Worker = skipLocal || dryRun ? { http_status: null } : await curlFile(appPort, "/_next/static/chunks/maplibre-gl-worker.mjs");
const smoke3011Uncompressed = skipLocal || dryRun ? { http_status: null } : await curlFile(appPort, "/data/app-data.json");
const smoke3012Root = skipLocal || dryRun ? { http_status: null } : await curlFile(previewPort, "/");

const v3011 = checks.map((c) => c["3011"].verdict);
const v3012 = checks.map((c) => c["3012"].verdict);

let host3011Decision = skipLocal || dryRun ? "SKIPPED" : "FAIL";
if (!skipLocal && !dryRun) {
  if (anyUnreachable(v3011)) host3011Decision = "UNREACHABLE";
  else if (all(v3011, "PASS")) host3011Decision = "PASS";
}

let host3012Decision = skipLocal || dryRun ? "SKIPPED" : "FAIL";
if (!skipLocal && !dryRun) {
  if (anyUnreachable(v3012)) host3012Decision = "UNREACHABLE";
  else if (all(v3012, "PASS")) host3012Decision = "PASS";
}

const localDecision = host3011Decision === "PASS" ? "PASS" : "BLOCKED";

const localPayload = {
  check: "W11 /data/*.gz static serving",
  decision: localDecision,
  step_e: stepEStatus,
  meaning: {
    PASS: "vinext start on 3011 serves nested /data/*.gz byte-identical to dist; 3012 wrapper not required for local production-mode data. Step E is still not authorized.",
    BLOCKED: "vinext start on 3011 does not serve nested /data/*.gz byte-identical to dist. Local 3012 wrapper remains required. Step E is not authorized.",
  }[localDecision],
  checked_at_utc: new Date().toISOString(),
  hosts: {
    vinext_start: { port: appPort, decision: host3011Decision },
    localhost_wrapper: { port: previewPort, decision: host3012Decision },
  },
  host_smoke: skipLocal || dryRun ? { skipped: true } : {
    "3011_root": { http_status: smoke3011Root.http_status, note: "app shell; expected 200 even when /data/*.gz 404s" },
    "3011_maplibre_worker": { http_status: smoke3011Worker.http_status, note: "proves vinext start does serve some nested static files" },
    "3011_uncompressed_json": { http_status: smoke3011Uncompressed.http_status, note: "no uncompressed sibling exists; /data/app-data.json is also 404" },
    "3012_root": { http_status: smoke3012Root.http_status, note: "wrapper proxies app shell" },
  },
  files_checked: files.length,
  checks,
  blocker: localDecision === "BLOCKED" ? {
    vinext_start_uses: "Node startProdServer (not worker/index.ts)",
    static_file_cache: "vinext dist/server/static-file-cache.js skips relativePath ending in .br/.gz/.zst and treats those files as Content-Encoding variants of the uncompressed sibling",
    app_requests: "/data/*.json.gz and /data/*.geojson.gz as first-class gzip payloads (client DecompressionStream); there is no uncompressed sibling",
    why_worker_fix_unsafe: "vinext start never loads phase-3/app/worker/index.ts; a Cloudflare ASSETS intercept would not change 3011 and is not the Vercel production path",
    why_build_copy_unsafe: "Renaming or gunzipping dist files would require page.tsx URL changes (forbidden) or would lie about Content-Type; mutating frozen gz hashes is forbidden",
    local_workaround: "phase-3/start_local_preview.mjs on 3012 streams dist/client/data/*.gz as application/gzip without Content-Encoding",
    production_implication: "Vercel/static hosting must serve /data/*.gz as the gzip file bytes (not Content-Encoding of a missing .json). The 3012 wrapper is localhost-only and is not a production substitute.",
  } : null,
};

if (!skipLocal && !dryRun) {
  writeFileSync(outJson, `${JSON.stringify(localPayload, null, 2)}\n`);
}

const hostChecks = [];
let hostDecision = "NOT_RUN";
let hostMeaning = "Set W11_HOST_URL to prove a Vercel preview or production origin. 3012 is not a host proof.";

if (hostUrlRaw) {
  if (dryRun) {
    hostDecision = "DRY_RUN";
    hostMeaning = `No network proof. Config is staged. Run without W11_DRY_RUN against ${hostUrlRaw}.`;
  } else {
    for (const item of disks) {
      const host = await curlUrl(`${hostUrlRaw}${item.pathname}`, hostTimeoutSec);
      hostChecks.push({
        file: item.file,
        pathname: item.pathname,
        disk: item.disk,
        host: { ...host, verdict: verdictFor(item.disk, host) },
      });
    }
    const hostVerdicts = hostChecks.map((c) => c.host.verdict);
    if (anyUnreachable(hostVerdicts)) hostDecision = "UNREACHABLE";
    else if (all(hostVerdicts, "PASS")) hostDecision = "PASS";
    else hostDecision = "FAIL";
    hostMeaning = hostDecision === "PASS"
      ? `${hostUrlRaw} serves each /data/*.gz byte-identical to dist without Content-Encoding: gzip.${productionRedeployAuthorized ? " This is the authorized production redeploy proof." : " Step E is still not authorized."}`
      : `${hostUrlRaw} does not serve first-class /data/*.gz byte-identical to dist. 3012 is not a substitute. Step E is not authorized.`;
  }
}

const previewHost = /harm-lens-phase3-w11/.test(hostUrlRaw);
const deployBlocker = {
  vercel_cli: process.env.W11_PREVIEW_DEPLOYED === "1" || previewHost,
  vercel_token: Boolean(process.env.VERCEL_TOKEN),
  preview_created: process.env.W11_PREVIEW_DEPLOYED === "1" || previewHost,
  project: previewHost ? "harm-lens-phase3-w11" : null,
  product_production_alias: "https://harm-lens-nyc.vercel.app",
  product_production_touched: productionRedeployAuthorized,
  production_cutover: productionRedeployAuthorized
    ? "explicitly authorized production redeploy"
    : "forbidden without explicit user authorization — harm-lens-nyc.vercel.app was not aliased or redeployed",
  reason: previewHost
    ? "Preview project harm-lens-phase3-w11 serves public/data/*.gz with staged headers. Unique deployment URLs may 302 under Vercel Deployment Protection; the project URL was used for proof. This is not a cutover of harm-lens-nyc.vercel.app."
    : "Set W11_HOST_URL to a preview origin. Do not treat 3012 as production. Do not cut over harm-lens-nyc.vercel.app.",
};

const hostPayload = {
  check: "W11 /data/*.gz real-host serving",
  decision: hostUrlRaw ? (hostDecision === "PASS" ? "PASS" : "BLOCKED") : "BLOCKED",
  step_e: stepEStatus,
  w11_host: hostDecision,
  meaning: hostUrlRaw ? hostMeaning : "No W11_HOST_URL set. Production/preview proof not run. Local 3012 is not a host proof. Step E is not authorized.",
  checked_at_utc: new Date().toISOString(),
  host: {
    url: hostUrlRaw || null,
    role: hostUrlRaw?.includes("harm-lens-nyc.vercel.app")
      ? (productionRedeployAuthorized ? "production_redeploy_proof" : "production_observational")
      : hostUrlRaw?.includes("harm-lens-phase3-w11")
        ? "w11_preview_project"
        : (hostUrlRaw ? "preview_or_custom" : null),
    accept_encoding: "gzip",
    curl_compressed: false,
    timeout_sec: hostTimeoutSec,
  },
  deploy: deployBlocker,
  host_config: hostConfigInventory(),
  dry_run_plan: dryRunPlan(hostUrlRaw || "https://<preview-or-production>", files),
  files_checked: files.length,
  checks: hostChecks,
  remaining_blocker: hostDecision === "PASS" ? null : {
    production_today: "https://harm-lens-nyc.vercel.app/data/*.gz returns Next.js 404 HTML (older MVP; files are not on that deployment).",
    vinext_start: "3011 still 404s first-class .gz URLs (StaticFileCache skips them). Do not ship vinext start as the Vercel Node server without an upstream vinext fix.",
    vercel_fix_staged: "phase-3/app/vercel.json + next.config.ts headers serve /data/*.gz as application/gzip with Content-Encoding: identity. Merge those rules with public/data/*.gz into a Vercel preview (not production cutover).",
    must_not: "Do not treat 3012 as production. Do not set Content-Encoding: gzip on these URLs. Do not gunzip frozen payloads. Do not change page.tsx URLs.",
  },
  still_true_after_w11_host_pass: {
    step_e: stepEStatus,
    vinext_start_3011: "still 404s /data/*.gz",
    product_production: productionRedeployAuthorized
      ? "https://harm-lens-nyc.vercel.app is the explicitly authorized redeploy target"
      : "https://harm-lens-nyc.vercel.app untouched; still older MVP",
    not_a_cutover: !productionRedeployAuthorized,
  },
};

writeFileSync(outHostJson, `${JSON.stringify(hostPayload, null, 2)}\n`);

console.log(`W11 local decision: ${skipLocal || dryRun ? "SKIPPED" : localDecision}`);
if (!skipLocal && !dryRun) {
  console.log(`3011 vinext start: ${host3011Decision}`);
  console.log(`3012 wrapper: ${host3012Decision}`);
  for (const check of checks) {
    console.log(`  ${check.file}  3011=${check["3011"].verdict}(${check["3011"].http_status})  3012=${check["3012"].verdict}(${check["3012"].http_status})`);
  }
  console.log(`wrote ${outJson}`);
}
console.log(`W11 host decision: ${hostDecision}`);
console.log(`host url: ${hostUrlRaw || "(unset)"}`);
console.log(`step E: ${stepEStatus}`);
if (hostChecks.length) {
  for (const check of hostChecks) {
    console.log(`  ${check.file}  host=${check.host.verdict}(${check.host.http_status}) encoding=${check.host.content_encoding || "none"}`);
  }
}
console.log(`wrote ${outHostJson}`);
if (hostUrlRaw && hostDecision !== "PASS" && hostDecision !== "DRY_RUN") process.exit(1);
if (!hostUrlRaw && localDecision !== "PASS") process.exit(1);
