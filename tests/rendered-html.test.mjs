import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appRoot = new URL("../", import.meta.url);

async function readJsonGzip(relativePath) {
  const bytes = await readFile(new URL(relativePath, appRoot));
  return JSON.parse(gunzipSync(bytes));
}

test("browser projection preserves the locked Gate 2 contract", async () => {
  const data = await readJsonGzip("public/data/app-data.json.gz");
  assert.equal(data.meta.objectVersion, "HL-PHASE2-OBJECTS-v1");
  assert.equal(data.meta.assignmentVersion, "HL-SPATIAL-26B-v2");
  assert.equal(data.meta.analysisEnd, "2026-06-11");
  assert.equal(data.meta.sourceStatus, "maintenance");
  assert.equal(data.meta.fatalThreshold, 1);
  assert.equal(data.meta.noMatchStatement, "No matching record established under the listed frozen sources and match version.");
  assert.equal(data.meta.imagery.provider, "NYC OTI/DoITT");
  assert.equal(data.meta.imagery.license, "CC BY 4.0");
  assert.equal(data.places.length, 40_549);
  assert.equal(Object.keys(data.samplePackets).length, 4);

  for (const place of data.places) {
    assert.ok(place.assignmentClass === "intersection_confident" || place.assignmentClass === "midblock");
    assert.equal(place.injuryCount, new Set(place.injurySupportingIds).size);
    assert.equal(place.fatalCount, new Set(place.fatalSupportingIds).size);
    assert.equal(place.equalityPass, true);
    assert.notEqual(place.fragility.summaryStatus, "stable");
  }

  for (const packet of Object.values(data.samplePackets)) {
    assert.equal(packet.fields.lep_validation_status.value, "DRAFT");
  }
});

test("map layers preserve grain and uncertainty semantics", async () => {
  const [ranked, uncertainty] = await Promise.all([
    readJsonGzip("public/data/ranked-places.geojson.gz"),
    readJsonGzip("public/data/uncertainty.geojson.gz"),
  ]);
  assert.equal(ranked.features.length, 40_549);
  assert.deepEqual(new Set(ranked.features.map((feature) => feature.properties.placeType)), new Set(["intersection_node", "midblock_segment"]));
  assert.ok(ranked.features.every((feature) => feature.properties.placeType === "intersection_node" ? feature.properties.ranked === true : feature.properties.ranked === false));
  assert.equal(uncertainty.features.length, 97_040);
  assert.ok(uncertainty.features.every((feature) => feature.properties.ranked === false));
  assert.deepEqual(new Set(uncertainty.features.map((feature) => feature.properties.assignmentClass)), new Set(["intersection_possible_or_exception", "unresolved"]));
});

test("full 1F Situate projection covers every screened place with governed buckets", async () => {
  const [data, situate] = await Promise.all([
    readJsonGzip("public/data/app-data.json.gz"),
    readJsonGzip("public/data/situate-1f-index.json.gz"),
  ]);
  assert.equal(situate.meta.indexVersion, "HL-SITUATE-1F-PROJECTION-v1");
  assert.equal(situate.meta.matchVersion, "HL-VZDOT-MATCH-v1");
  assert.equal(situate.meta.claimStatus, "CONDITIONAL");
  assert.equal(situate.meta.summary.projectedPlaces, 40_549);
  assert.equal(situate.meta.summary.matchedRelationshipRows, 23_317);
  assert.equal(situate.meta.summary.ambiguousRelationshipRows, 5_737);
  assert.equal(situate.meta.summary.unmatchedPlaceholderRows, 22_895);
  assert.deepEqual(new Set(Object.keys(situate.places)), new Set(data.places.map((place) => place.id)));

  for (const place of Object.values(situate.places)) {
    assert.ok(["documented", "documented_and_ambiguous", "ambiguous", "unmatched"].includes(place.status));
    assert.ok(place.documentedHistory.every((record) => record.claimClass === "documented_history" && record.relationshipStatus === "matched_established_non_ambiguous"));
    assert.ok(place.ambiguous.every((record) => record.claimClass === "unknown" && record.relationshipStatus === "ambiguous_candidate_needs_review"));
    if (place.status === "unmatched") {
      assert.equal(place.documentedHistory.length, 0);
      assert.equal(place.ambiguous.length, 0);
      assert.equal(place.noMatchStatement, "No matching record established under the listed frozen sources and match version.");
    } else {
      assert.equal(place.noMatchStatement, null);
    }
  }

  for (const grain of ["intersection_node", "midblock_segment"]) {
    const documented = situate.places[situate.meta.summary.validationExamples.documented[grain]];
    const ambiguous = situate.places[situate.meta.summary.validationExamples.ambiguous[grain]];
    const unmatched = situate.places[situate.meta.summary.validationExamples.unmatched[grain]];
    assert.ok(documented.documentedHistory.length > 0);
    assert.ok(ambiguous.ambiguous.length > 0);
    assert.equal(unmatched.status, "unmatched");
  }
});

test("decision surface exposes required disclosures and Phase 3.2 interaction jobs", async () => {
  const [page, layout, social] = await Promise.all([
    readFile(new URL("app/page.tsx", appRoot), "utf8"),
    readFile(new URL("app/layout.tsx", appRoot), "utf8"),
    readFile(new URL("public/harm-lens-social.png", appRoot)),
  ]);
  for (const required of [
    "Source status: maintenance",
    "June 11, 2026",
    "Possible / exception · non-ranked",
    "Unresolved · non-ranked",
    "Fatal elevation threshold = 1",
    "Inspect all ${ids.length} IDs",
    "Incomplete or deferred tests are never summarized as “stable.”",
    "Download DRAFT LEP",
    "Evidence Completeness Checklist",
    "Current-context reference only",
    "At a glance",
    "Documented street changes",
    "Street network and rules",
    "What the sources do not establish",
    "Source and match receipt",
    "Whole city",
    "Start A/B",
    "Open compare",
    "Saved for review",
    "Differences only",
    "Counts",
    "Crashes",
    "Hold up?",
    "On the street",
  ]) assert.match(page, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(page, /NYC_MAX_BOUNDS/);
  assert.match(page, /minZoom: 9/);
  assert.match(page, /duration: 380/);
  assert.match(page, /isStillGzipped/);
  assert.doesNotMatch(page, /fields\.history_matches|historyMatches/);
  assert.match(layout, /harm-lens-social\.png/);
  assert.ok(social.byteLength > 100_000);
  assert.equal(createHash("sha256").update(social).digest("hex").length, 64);
});

test("Phase 3.3 separates screens and teaches place and tool meaning", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("app/page.tsx", appRoot), "utf8"),
    readFile(new URL("app/globals.css", appRoot), "utf8"),
  ]);
  for (const term of [
    'type ActiveScreen = "overview" | "explore" | "inspect" | "compare" | "packet"',
    'Look at places. Switch injury and fatal. Open one to see why it showed up.',
    'Places with crash reports',
    'Extra faint marks',
    'Your working set — not a priority list.',
    'Stable ID from NYC’s LION street network.',
    'Street segment · peer mode (not snapped into an intersection).',
    'Why this place is on the list',
    'Supporting crash records',
    'Whether the signal changes under checks',
    'Documented street changes and published rules',
    'Place ID &amp; method',
    'We re-checked this place with different time windows.',
    'Incomplete checks are never called stable.',
    'DRAFT Location Evidence Packet',
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    '© OpenStreetMap contributors, ODbL',
  ]) assert.ok(page.includes(term), `missing Phase 3.3 term: ${term}`);
  assert.match(css, /\.workspace\.screen-explore/);
  assert.match(css, /\.overview-screen/);
  assert.match(css, /\.packet-screen/);
  assert.match(css, /harbor|radial-gradient/);
  assert.doesNotMatch(page, /fields\.history_matches|historyMatches/);
});

test("Situate UI consumes the place-complete approach projection without weakening Speed", async () => {
  const [page, projectionBytes, fixtures, verification] = await Promise.all([
    readFile(new URL("app/page.tsx", appRoot), "utf8"),
    readFile(new URL("public/data/situate-approach-context-v1.json.gz", appRoot)),
    readFile(new URL("tests/fixtures/situate-wave1-claim-fixtures.json", appRoot), "utf8").then(JSON.parse),
    readFile(new URL("tests/fixtures/situate-wave1-verification.json", appRoot), "utf8").then(JSON.parse),
  ]);
  assert.equal(createHash("sha256").update(projectionBytes).digest("hex"), "b86e702c5c9de6bc7e14e08f876c77220e27d6d6b7d6c95dfff8c88f0a4f3ba9");
  assert.equal(verification.decision, "PASS");
  assert.equal(verification.checks.find((check) => check.id === "V1").evidence.places, 40_549);
  assert.equal(verification.checks.find((check) => check.id === "V6").evidence.leaks, 0);
  assert.equal(fixtures.decision, "PASS");
  assert.ok(fixtures.fixtures.length >= 20);
  for (const testId of ["situate-documented-street-changes", "situate-street-network-and-rules", "situate-unknown-evidence", "situate-approach-"]) {
    assert.ok(page.includes(testId));
  }
  assert.match(page, /situate-approach-context-v1\.json\.gz/);
  assert.doesNotMatch(page, /Street \/ approach context/);
});

test("H4 merges the frozen Wave-2 overlay by exact place key without weakening claims", async () => {
  const [page, wave2Bytes, baseBytes, oneFBytes, verification, fixtures] = await Promise.all([
    readFile(new URL("app/page.tsx", appRoot), "utf8"),
    readFile(new URL("public/data/situate-approach-context-wave2-v1.json.gz", appRoot)),
    readFile(new URL("public/data/situate-approach-context-v1.json.gz", appRoot)),
    readFile(new URL("public/data/situate-1f-index.json.gz", appRoot)),
    readFile(new URL("tests/fixtures/situate-wave2-verification.json", appRoot), "utf8").then(JSON.parse),
    readFile(new URL("tests/fixtures/situate-wave2-claim-fixtures.json", appRoot), "utf8").then(JSON.parse),
  ]);
  assert.equal(createHash("sha256").update(wave2Bytes).digest("hex"), "5dc43770ffb74d5d676bda73e0a0c754fe92f2146ffc1c92fdedccad762e4ddf");
  assert.equal(createHash("sha256").update(baseBytes).digest("hex"), "b86e702c5c9de6bc7e14e08f876c77220e27d6d6b7d6c95dfff8c88f0a4f3ba9");
  assert.equal(createHash("sha256").update(oneFBytes).digest("hex"), "4d9d51ff8d5ba8011ade86bd37c262c0bca5a7cb0dcf28f2d93c75af49416d8f");
  assert.equal(verification.decision, "PASS");
  assert.equal(verification.checks.find((check) => check.id === "V1_key_equality").evidence.projection, 40_549);
  assert.equal(fixtures.allPass, true);
  assert.ok(fixtures.fixtureCount >= 15);
  for (const term of [
    "situate-approach-context-wave2-v1.json.gz",
    "HL-APPROACH-SITUATE-WAVE2-v1",
    "Frozen Wave-2 Situate projection could not be loaded.",
    "mergeSituatePlace",
  ]) assert.ok(page.includes(term), `missing H4 behavior: ${term}`);
  assert.doesNotMatch(page, /all NYC signs|is present forever|No match means untreated/i);
});

test("Phase 3.4 labels every screened place from frozen sources without rewriting Phase 2", async () => {
  const [data, labels] = await Promise.all([
    readJsonGzip("public/data/app-data.json.gz"),
    readJsonGzip("public/data/place-labels.json.gz"),
  ]);
  assert.equal(labels.meta.version, "HL-PLACE-LABELS-LION26B-v1");
  assert.equal(labels.meta.sourceDirectoryManifestSha256, "707aa6d4c12d60e9744394d4dba776d07f440f9e635cd10daa7722b6def31f95");
  assert.equal(labels.meta.coverage.screenIntersections, 26_441);
  assert.equal(labels.meta.coverage.intersectionsWithNonGenericTitle, 26_441);
  assert.equal(labels.meta.coverage.intersectionsWithCrossStreetTitle, 26_381);
  assert.equal(labels.meta.coverage.screenMidblocks, 14_108);
  assert.deepEqual(new Set(Object.keys(labels.labels)), new Set(data.places.map((place) => place.id)));
  assert.equal(labels.labels["intersection_node:26912"].title, "Buffalo Ave & Eastern Pkwy");
  assert.equal(labels.labels["intersection_node:28915"].title, "Linden Blvd & Pennsylvania Ave");
  assert.ok(Object.values(labels.labels).every((label) => label.title && !label.title.includes("undefined")));
});

test("Phase 3.4 keeps selection on Explore and makes Compare and Packet honest", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("app/page.tsx", appRoot), "utf8"),
    readFile(new URL("app/globals.css", appRoot), "utf8"),
  ]);
  assert.doesNotMatch(page, /else if \(screen === "explore"\)\s*\{\s*setScreen\("inspect"\)/);
  for (const term of [
    "selected-halo",
    "selected-place-card",
    "You picked this place",
    "Open this place",
    "Show on map",
    "clusterMaxZoom: 10",
    "oti-fallback",
    "kept-on-flip",
    "Selected · kept on lens flip",
    "Choose place A and B on Explore first.",
    "A frozen DRAFT packet exists for four sample places only.",
    "Showing the top ${visiblePlaces.length} places",
    "Extra faint marks are not on the main list.",
  ]) assert.ok(page.includes(term), `missing Phase 3.4 behavior: ${term}`);
  assert.match(css, /selected-place-card/);
  assert.doesNotMatch(page, /selected-map-popup/);
  assert.doesNotMatch(page, /useState\("intersection_node:26802"\)/);
  assert.doesNotMatch(css, /@media \(max-width: 920px\)[\s\S]{0,250}\.job-nav \{ display: none/);
});

test("Track P3 binds the released P2.5 locks without changing baseline meaning", async () => {
  const [page, projection] = await Promise.all([
    readFile(new URL("app/page.tsx", appRoot), "utf8"),
    readJsonGzip("public/data/p2-5-ui-objects-v1.json.gz"),
  ]);
  assert.equal(projection.meta.projectionVersion, "HL-P2.5-UI-PROJECTION-v1");
  assert.equal(projection.meta.objectVersion, "HL-P2.5-OBJECT-RELEASE-v1");
  assert.equal(projection.meta.basePlaceCount, 40_549);
  assert.equal(Object.keys(projection.places).length, 40_549);
  assert.equal(Object.keys(projection.corridors).length, 18);
  assert.equal(projection.meta.persistenceVersion, "HL-PERSISTENCE-36M-48M-P90POS-v1");
  const buffalo = projection.places["intersection_node:26912"];
  assert.equal(buffalo.counts["36m"].everyone.injury, 66);
  assert.equal(buffalo.ids["36m"].everyone.injury.length, 66);
  const topEveryone = Object.entries(projection.places)
    .filter(([key]) => key.startsWith("intersection_node:"))
    .sort((a, b) => b[1].counts["36m"].everyone.injury - a[1].counts["36m"].everyone.injury)[0];
  assert.equal(topEveryone[0], "intersection_node:26912");
  const pedestrianTop = projection.places["intersection_node:26863"];
  assert.equal(pedestrianTop.counts["36m"].pedestrian.injury, 21);
  assert.equal(pedestrianTop.ids["36m"].pedestrian.injury.length, 21);
  for (const corridor of Object.values(projection.corridors)) {
    for (const lens of ["injury", "fatal"]) assert.equal(corridor.metrics[lens].count, corridor.metrics[lens].ids.length);
  }
  const northernBoroughs = new Set(Object.values(projection.corridors).filter((item) => item.displayName === "Northern Boulevard").map((item) => item.boroughName));
  assert.deepEqual(northernBoroughs, new Set(["Queens", "Staten Island"]));
  for (const term of [
    "Who was harmed",
    "Show human toll beside frequency",
    "Named groups overlap",
    "Analytical LION corridor · not a DOT program layer",
    "restart A/B",
  ]) assert.ok(page.includes(term), `missing P3 behavior: ${term}`);
});

test("C5 reserves non-overlapping chrome bands and keeps narrow controls reachable", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("app/page.tsx", appRoot), "utf8"),
    readFile(new URL("app/globals.css", appRoot), "utf8"),
  ]);
  for (const selector of [".camera-toolbar", ".selected-place-card", ".compare-mini"]) {
    const block = css.match(new RegExp(`${selector.replace(".", "\\.")} \\{[^}]+\\}`))?.[0] ?? "";
    assert.match(block, /position: relative/);
    assert.doesNotMatch(block, /position: absolute/);
  }
  assert.match(css, /\.camera-toolbar \{[^}]+flex: 0 0 auto[^}]+flex-wrap: wrap[^}]+overflow: visible/);
  assert.match(css, /\.selected-place-card \{[^}]+width: 100%[^}]+grid-template-columns/);
  assert.match(css, /\.compare-mini \{[^}]+width: 100%[^}]+grid-template-columns/);
  assert.match(css, /@media \(max-width: 920px\)[\s\S]+\.job-nav button \{ min-height: 44px/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]+\.selected-place-card \{ min-height: 142px/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]+\.compare-mini \{ min-height: 154px/);
  assert.match(css, /\.map-toolbar \{[^}]*z-index: 8/);
  assert.match(css, /\.camera-toolbar \{[^}]*z-index: 6/);
  assert.ok(page.includes("cluster-framing-hint"));
  assert.ok(page.includes("A number is a pile."));
  assert.ok(page.includes("onFocusGroup"));
  assert.ok(page.includes("focus-places"));
  assert.ok(page.includes("map-focus-group"));
  assert.ok(page.includes("This pile ·"));
  assert.ok(page.includes("Whole city"));
  assert.ok(page.includes("Look at places. Switch injury and fatal."));
  assert.doesNotMatch(page, /two harm lenses/);
  assert.doesNotMatch(page, /locked evidence frame/);
  assert.ok(page.includes('useState<string | null>(null)'));
  for (const label of ["Counts", "Crashes", "Hold up?", "On the street", "Note"]) assert.ok(page.includes(label));
  assert.ok(page.includes("Place ID &amp; method"));
  assert.ok(page.includes("setWorkerUrl"));
  assert.ok(page.includes("/_next/static/chunks/maplibre-gl-worker.mjs"));
  assert.ok(page.includes("Search street, cross-street, or LION id"));
  assert.ok(page.includes("named street arm"));
  assert.ok(page.includes("groupUnknownEvidence"));
  assert.ok(page.includes("approachStreetName"));
});
