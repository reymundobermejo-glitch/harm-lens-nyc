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
    "Open a year to see the dates.",
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
    "On the street",
  ]) assert.match(page, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(page, /NYC_MAX_BOUNDS/);
  assert.match(page, /minZoom: 8\.5/);
  assert.match(page, /data-testid="map-hud-overlay"/);
  assert.match(page, /map\.resize\(\)/);
  assert.match(page, /transitionDuration = window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches \? 0 : 380/);
  assert.match(page, /circle-opacity-transition/);
  assert.match(page, /activeP25Count\(p25, place\.id, windowKey, roadUser, lens\) > 0 \|\| place\.id === selectedId/);
  assert.match(page, /emphasizedPlaceIds=\{emphasizedMapPlaceIds\}/);
  assert.match(page, /Died · only places with a death record\. Many Hurt places go dark\./);
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
    'Where crash reports pile up on NYC streets.',
    'Places with crash reports',
    'Extra faint marks',
    'Your working set — not a priority list.',
    'Stable ID from NYC’s LION street network.',
    'Street segment · peer mode (not snapped into an intersection).',
    'Why this place surfaced',
    'Supporting crash records',
    'Hurt and Died under this lock',
    'Published street records',
    'Place ID &amp; method',
    'Does this still show if we change the window?',
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
    "You picked this",
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
    const block = css.match(new RegExp(`(?:^|\\n)${selector.replace(".", "\\.")} \\{[^}]+\\}`))?.[0] ?? "";
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
  assert.ok(page.includes("A number is how many"));
  assert.ok(page.includes("are stacked"));
  assert.ok(page.includes("onFocusGroup"));
  assert.ok(page.includes("focus-places"));
  assert.ok(page.includes("map-focus-group"));
  assert.ok(page.includes("This pile ·"));
  assert.ok(page.includes("Whole city"));
  assert.ok(page.includes("Where crash reports pile up on NYC streets."));
  assert.doesNotMatch(page, /two harm lenses/);
  assert.match(page, /mapHudExpanded, setMapHudExpanded] = useState\(false\)/);
  assert.match(page, /hl-map-hud:expanded/);
  assert.match(page, /data-testid="map-hud-collapsed-bar"/);
  assert.match(page, /data-testid="map-look-select"/);
  assert.match(page, /aria-label="Looking at"/);
  assert.match(page, /data-testid="fit-nyc" value="">Whole city<\/option>/);
  for (const borough of ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"]) {
    assert.ok(page.includes(borough), `missing look option: ${borough}`);
  }
  assert.doesNotMatch(page, />Look at \{borough/);
  assert.match(page, /Show more/);
  assert.match(css, /\.map-hud\.collapsed \{ height: auto; min-height: 54px; max-height: 20%; \}/);
  assert.match(css, /\.map-hud\.expanded \{ max-height: 40%; \}/);
  assert.match(css, /\.map-hud \{[^}]+pointer-events: none[^}]+overflow: hidden/);
  assert.match(css, /\.map-hud-compact \{[^}]+pointer-events: auto/);
  assert.match(css, /\.map-panel \{[^}]+min-height: 0/);
  assert.match(css, /\.map-wrap \{[^}]+min-height: 0/);
  assert.match(css, /\.map-canvas \{[^}]+min-height: 420px/);
  assert.match(page, /fitNycInRemainingViewport/);
  assert.match(page, /searchPlaces\(value, askLegendUniverse\)/);
  assert.match(page, /data-testid="map-search-zero"/);
  assert.doesNotMatch(page, /locked evidence frame/);
  assert.ok(page.includes('useState<string | null>(null)'));
  for (const label of ["Counts", "Crashes", "On the street", "Note"]) assert.ok(page.includes(label));
  assert.ok(page.includes("Place ID &amp; method"));
  assert.ok(page.includes("setWorkerUrl"));
  assert.ok(page.includes("/_next/static/chunks/maplibre-gl-worker.mjs"));
  assert.ok(page.includes("Search street, cross-street, or LION id"));
  assert.ok(page.includes("named street arm"));
  assert.ok(page.includes("groupUnknownEvidence"));
  assert.ok(page.includes("approachStreetName"));
});

test("I0.3 map universe follows the active lens and preserves selected keep", async () => {
  const [page, p25] = await Promise.all([
    readFile(new URL("app/page.tsx", appRoot), "utf8"),
    readJsonGzip("public/data/p2-5-ui-objects-v1.json.gz"),
  ]);
  const positive = (lens) => Object.values(p25.places).filter((place) => (place.counts?.["36m"]?.everyone?.[lens] ?? 0) > 0).length;
  assert.ok(positive("fatal") < positive("injury"));
  assert.equal(positive("injury"), 25_204);
  assert.equal(positive("fatal"), 407);
  assert.match(page, /activeP25Count\(p25, place\.id, windowKey, roadUser, lens\) > 0 \|\| place\.id === selectedId/);
  assert.match(page, /return \[\.\.\.top, selectedPlace\]/);
  assert.match(page, /map\.setPaintProperty\("places-point", "circle-radius", NEIGHBORHOOD_POINT_RADIUS\)/);
  assert.doesNotMatch(page, /setPaintProperty\("places-point", "circle-radius",[^\n]*(injuryCount|fatalCount|activeP25Count)/);
  assert.ok(page.includes("Selected · kept on lens flip"));
});

test("I1 makes the free map a night instrument without weakening lens rules", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("app/page.tsx", appRoot), "utf8"),
    readFile(new URL("app/globals.css", appRoot), "utf8"),
  ]);
  assert.match(page, /"background-color": "#071219"/);
  assert.match(page, /"raster-saturation": -1/);
  assert.match(page, /id: "ortho"[\s\S]{0,220}visibility: "none"/);
  assert.match(page, /showOldPhoto, setShowOldPhoto] = useState\(false\)/);
  assert.ok(page.includes("Old photo (2018)"));
  assert.ok(page.includes('id: "places-core"'));
  assert.match(page, /"circle-color": "#ffffff", "circle-radius": 1\.25/);
  assert.match(page, /map\.setPaintProperty\("places-point", "circle-radius", NEIGHBORHOOD_POINT_RADIUS\)/);
  assert.match(page, /map\.setPaintProperty\("places-core", "circle-opacity", \["case"/);
  assert.match(page, /map\.setPaintProperty\("selected-ring", "circle-color", lensFill\)/);
  assert.match(css, /Track I1 — night city/);
  assert.match(css, /\.map-hud-compact, \.map-hud-expanded, \.imagery-badge, \.map-legend, \.map-preview[\s\S]{0,360}backdrop-filter: blur\(18px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.map-hud\.collapsed \{ height: auto; min-height: 54px; max-height: 20%; \}/);
});

test("I2 gives the map hover hands and binds frozen crash dates", async () => {
  const [page, css, p25, crashWhen] = await Promise.all([
    readFile(new URL("app/page.tsx", appRoot), "utf8"),
    readFile(new URL("app/globals.css", appRoot), "utf8"),
    readJsonGzip("public/data/p2-5-ui-objects-v1.json.gz"),
    readJsonGzip("public/data/crash-when-v1.json.gz"),
  ]);
  assert.equal(crashWhen.meta.projectionVersion, "HL-CRASH-WHEN-v1");
  assert.equal(crashWhen.meta.sourceSnapshotSha256, "0c2663aa4485ffb29801e8268946e4343781eb84fc0635b14767f71ea8e9490c");
  assert.equal(crashWhen.meta.p25ProjectionSha256, "b33dcc8a9e21ad88e5798eb772f85ee7157e512de09ce49fdc10394921a7d454");
  assert.equal(crashWhen.meta.supportingIdCount, crashWhen.meta.matchedIdCount);
  assert.equal(crashWhen.meta.missingIdCount, 0);

  const buffalo = p25.places["intersection_node:26912"];
  const ids24 = buffalo.ids["24m"].everyone.injury;
  const ids36 = buffalo.ids["36m"].everyone.injury;
  const ids48 = buffalo.ids["48m"].everyone.injury;
  assert.equal(ids36.length, 66);
  assert.ok(ids24.length < ids36.length);
  assert.ok(ids36.length < ids48.length);
  const dates36 = ids36.map((id) => crashWhen.records[String(id)].crashDate).filter(Boolean).sort();
  assert.equal(dates36.length, 66);
  assert.ok(dates36[0] >= p25.meta.windows["36m"].start);
  assert.ok(dates36.at(-1) <= p25.meta.windows["36m"].end);
  const outside36 = ids48.find((id) => !new Set(ids36).has(id));
  assert.ok(outside36);
  assert.ok(crashWhen.records[String(outside36)].crashDate < p25.meta.windows["36m"].start);

  for (const term of [
    'promoteId: "id"',
    'id: "places-hit"',
    '"circle-radius": 11',
    '["feature-state", "hover"]',
    "clearHoveredFeature",
    "Selected · kept on lens flip",
    "When each record occurred",
    "How long” sets the qualifying period",
    "crash-date-span",
  ]) assert.ok(page.includes(term), `missing I2 contract: ${term}`);
  assert.doesNotMatch(page, /filtersActive/);
  assert.match(page, /else if \(selectedId\)[\s\S]{0,900}else if \(focusGroup\)[\s\S]{0,700}else if \(mapLookBorough\)/);
  assert.match(css, /\.selected-place-card\.lock-on-chip \{[\s\S]{0,500}position: absolute/);
  assert.match(css, /\.crash-record-list/);
});

test("I3 turns Inspect and Compare into glass readouts without new metrics", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("app/page.tsx", appRoot), "utf8"),
    readFile(new URL("app/globals.css", appRoot), "utf8"),
  ]);
  const frozen = {
    "app-data.json.gz": "7a848a3174e74090709842903ca7d30c85691250cadc2b8d7e564b0641314614",
    "place-labels.json.gz": "21196fcdd9d89d03092a9f4abb8572e060861f0cb828fc2fa731e07adf9032b9",
    "ranked-places.geojson.gz": "56e2e2a3d62d31eb88bdffe434210001554bf658a3eac4a62bb020af5dd27972",
    "situate-1f-index.json.gz": "4d9d51ff8d5ba8011ade86bd37c262c0bca5a7cb0dcf28f2d93c75af49416d8f",
    "situate-approach-context-v1.json.gz": "b86e702c5c9de6bc7e14e08f876c77220e27d6d6b7d6c95dfff8c88f0a4f3ba9",
    "situate-approach-context-wave2-v1.json.gz": "5dc43770ffb74d5d676bda73e0a0c754fe92f2146ffc1c92fdedccad762e4ddf",
    "uncertainty.geojson.gz": "a64edd932ce3abdd78eea74a7fa9dde880000ced374b841520f6906109ad5137",
    "p2-5-ui-objects-v1.json.gz": "b33dcc8a9e21ad88e5798eb772f85ee7157e512de09ce49fdc10394921a7d454",
    "crash-when-v1.json.gz": "fa47ff55cdca6df709c1ffd031d5bd73fde846027a0ada8dc0106e2941864352",
  };
  for (const [name, expected] of Object.entries(frozen)) {
    const bytes = await readFile(new URL(`public/data/${name}`, appRoot));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, name);
  }
  assert.match(page, /label="Hurt"/);
  assert.match(page, /label="Died"/);
  assert.match(page, /data-testid="inspect-readout"/);
  assert.match(page, /id: "compare-pin-glow"/);
  assert.match(page, /compare-lock-lost/);
  assert.match(page, /data-testid="compare-lock-capsule"/);
  assert.match(page, /Lock broken/);
  assert.match(page, /crash-when-primary/);
  assert.match(page, /NYC_BOUNDS: \[\[number, number\], \[number, number\]\] = \[\[-74\.26, 40\.49\], \[-73\.70, 40\.92\]\]/);
  assert.doesNotMatch(page, /compare-pin-rings[\s\S]{0,80}#173a4b/);
  assert.match(css, /Track I3 — Inspect \/ Compare glass readouts/);
  assert.match(css, /\.count-mark strong \{[\s\S]{0,220}font-size: clamp\(52px/);
  assert.match(css, /\.count-mark\.injury\.active strong \{ color: #d98b28/);
  assert.match(css, /\.count-mark\.fatal\.active strong \{ color: #c94a37/);
  assert.match(css, /backdrop-filter: blur\(22px\)/);
  assert.match(css, /\.map-panel\.compare-lock-lost \.map-wrap::after/);
  assert.match(css, /\.crash-record-list time \{[\s\S]{0,180}font-size: 20px/);
  assert.match(css, /\.shared-lock-capsule/);
});

test("I3.2 makes crash years findable without mutating crash-when", async () => {
  const [page, css, p25, crashWhen] = await Promise.all([
    readFile(new URL("app/page.tsx", appRoot), "utf8"),
    readFile(new URL("app/globals.css", appRoot), "utf8"),
    readJsonGzip("public/data/p2-5-ui-objects-v1.json.gz"),
    readJsonGzip("public/data/crash-when-v1.json.gz"),
  ]);
  assert.equal(createHash("sha256").update(await readFile(new URL("public/data/crash-when-v1.json.gz", appRoot))).digest("hex"), "fa47ff55cdca6df709c1ffd031d5bd73fde846027a0ada8dc0106e2941864352");
  const buffalo = p25.places["intersection_node:26912"];
  const countYears = (ids) => {
    const years = {};
    for (const id of ids) {
      const date = crashWhen.records[String(id)]?.crashDate;
      const year = date ? date.slice(0, 4) : "Unknown";
      years[year] = (years[year] ?? 0) + 1;
    }
    return years;
  };
  const injury36 = countYears(buffalo.ids["36m"].everyone.injury);
  assert.ok((injury36["2023"] ?? 0) > 0);
  assert.equal(Object.values(injury36).reduce((sum, n) => sum + n, 0), 66);
  assert.equal((countYears(buffalo.ids["24m"].everyone.injury)["2023"] ?? 0), 0);
  const aveCFatals = p25.places["intersection_node:21791"].ids["36m"].everyone.fatal;
  const fatalYears = countYears(aveCFatals);
  assert.equal(aveCFatals.length, 2);
  assert.equal(fatalYears["2023"], 1);
  assert.equal(fatalYears["2024"], 1);
  assert.match(page, /testId="inspect-year-chips"/);
  assert.match(page, /compare-year-chips-/);
  assert.match(page, /Open a year to see the dates/);
  assert.match(page, /function groupCrashIdsByYear/);
  assert.match(page, /setTab\("records"\)/);
  assert.doesNotMatch(page, /ordered\.slice\(0, 8\)/);
  assert.doesNotMatch(page, /Inspect all \$\{ids\.length\} records/);
  assert.match(css, /Track I3\.2 — crash years findable from Counts/);
  assert.match(css, /\.year-chip/);
  assert.match(css, /\.crash-year-block/);
});

test("I2.1 makes the left rail follow a pile without becoming a sixth screen", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("app/page.tsx", appRoot), "utf8"),
    readFile(new URL("app/globals.css", appRoot), "utf8"),
  ]);
  const frozen = {
    "app-data.json.gz": "7a848a3174e74090709842903ca7d30c85691250cadc2b8d7e564b0641314614",
    "place-labels.json.gz": "21196fcdd9d89d03092a9f4abb8572e060861f0cb828fc2fa731e07adf9032b9",
    "ranked-places.geojson.gz": "56e2e2a3d62d31eb88bdffe434210001554bf658a3eac4a62bb020af5dd27972",
    "situate-1f-index.json.gz": "4d9d51ff8d5ba8011ade86bd37c262c0bca5a7cb0dcf28f2d93c75af49416d8f",
    "situate-approach-context-v1.json.gz": "b86e702c5c9de6bc7e14e08f876c77220e27d6d6b7d6c95dfff8c88f0a4f3ba9",
    "situate-approach-context-wave2-v1.json.gz": "5dc43770ffb74d5d676bda73e0a0c754fe92f2146ffc1c92fdedccad762e4ddf",
    "uncertainty.geojson.gz": "a64edd932ce3abdd78eea74a7fa9dde880000ced374b841520f6906109ad5137",
    "p2-5-ui-objects-v1.json.gz": "b33dcc8a9e21ad88e5798eb772f85ee7157e512de09ce49fdc10394921a7d454",
    "crash-when-v1.json.gz": "fa47ff55cdca6df709c1ffd031d5bd73fde846027a0ada8dc0106e2941864352",
  };
  for (const [name, expected] of Object.entries(frozen)) {
    const bytes = await readFile(new URL(`public/data/${name}`, appRoot));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, name);
  }
  assert.match(page, /type ActiveScreen = "overview" \| "explore" \| "inspect" \| "compare" \| "packet"/);
  assert.doesNotMatch(page, /Map scoreboard/);
  assert.doesNotMatch(page, /legend-pile">12/);
  assert.match(page, /Closer look · whole city/);
  assert.match(page, /These search matches/);
  assert.match(page, /This pile · \$\{formatNumber\(focusGroup\?\.ids\.length \?\? 0\)\} places/);
  assert.match(page, /if \(focusGroup\) \{\s*const idSet = new Set\(focusGroup\.ids\);/);
  assert.match(page, /data-testid="explore-place-list"/);
  assert.match(page, /data-testid="list-pile-banner"/);
  assert.match(page, /A number is how many \$\{stackedPlaceWord\} are stacked/);
  assert.match(page, /NYC_BOUNDS: \[\[number, number\], \[number, number\]\] = \[\[-74\.26, 40\.49\], \[-73\.70, 40\.92\]\]/);
  assert.match(page, /eligiblePlaces = useMemo\(\(\) => \{[\s\S]*?\}, \[agreementFilter, corridorId, data, lens, mode, p25, roadUser, searchMatchRank, selectedId, situateYesPlaceIds, windowKey\]\)/);
  assert.doesNotMatch(page, /eligiblePlaces = useMemo\([\s\S]{0,1200}mapLookBorough/);
  assert.doesNotMatch(page, /visiblePlaces = useMemo\([\s\S]{0,1800}mapLookBorough/);
  assert.doesNotMatch(page, /queryRenderedFeatures\([\s\S]{0,200}visiblePlaces/);
  assert.match(page, /return \[\.\.\.top, selectedPlace\]/);
  assert.match(page, /else if \(selectedId\)[\s\S]{0,900}else if \(focusGroup\)[\s\S]{0,700}else if \(mapLookBorough\)/);
  assert.match(css, /Track I2\.1 — left rail follows the pile/);
  assert.match(css, /\.list-pile-banner/);
  assert.match(css, /\.row-pair/);
});

test("I4 splits Overview night from cream Packet downloads", async () => {
  const [page, css, brief] = await Promise.all([
    readFile(new URL("app/page.tsx", appRoot), "utf8"),
    readFile(new URL("app/globals.css", appRoot), "utf8"),
    readFile(new URL("lib/evidence-brief.ts", appRoot), "utf8"),
  ]);
  const frozen = {
    "app-data.json.gz": "7a848a3174e74090709842903ca7d30c85691250cadc2b8d7e564b0641314614",
    "place-labels.json.gz": "21196fcdd9d89d03092a9f4abb8572e060861f0cb828fc2fa731e07adf9032b9",
    "ranked-places.geojson.gz": "56e2e2a3d62d31eb88bdffe434210001554bf658a3eac4a62bb020af5dd27972",
    "situate-1f-index.json.gz": "4d9d51ff8d5ba8011ade86bd37c262c0bca5a7cb0dcf28f2d93c75af49416d8f",
    "situate-approach-context-v1.json.gz": "b86e702c5c9de6bc7e14e08f876c77220e27d6d6b7d6c95dfff8c88f0a4f3ba9",
    "situate-approach-context-wave2-v1.json.gz": "5dc43770ffb74d5d676bda73e0a0c754fe92f2146ffc1c92fdedccad762e4ddf",
    "uncertainty.geojson.gz": "a64edd932ce3abdd78eea74a7fa9dde880000ced374b841520f6906109ad5137",
    "p2-5-ui-objects-v1.json.gz": "b33dcc8a9e21ad88e5798eb772f85ee7157e512de09ce49fdc10394921a7d454",
    "crash-when-v1.json.gz": "fa47ff55cdca6df709c1ffd031d5bd73fde846027a0ada8dc0106e2941864352",
  };
  for (const [name, expected] of Object.entries(frozen)) {
    const bytes = await readFile(new URL(`public/data/${name}`, appRoot));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, name);
  }
  const firstOverview = css.match(/\.overview-screen \{[^}]+\}/)?.[0] ?? "";
  const firstPacket = css.match(/\.packet-screen \{[^}]+\}/)?.[0] ?? "";
  assert.match(firstOverview, /#071219/);
  assert.doesNotMatch(firstOverview, /#f7f4ea|#d9e1dc/);
  assert.match(firstPacket, /#071219/);
  assert.doesNotMatch(firstPacket, /#f7f4ea|#e6ece8/);
  assert.match(page, /data-testid="open-the-map"/);
  assert.match(page, />Open the map </);
  assert.match(page, /const openTheMap = \(\) => \{[\s\S]{0,280}setFocusGroup\(null\)/);
  assert.match(page, /if \(screen === "packet" && !selectedId && !packetSubjectId\) setScreen\("explore"\)/);
  assert.match(page, /testId="packet-year-chips"/);
  assert.match(page, /packet-checks-disclosure/);
  assert.match(page, /className="count-grid packet-giants"/);
  assert.match(page, /data-testid="evidence-brief-screen"/);
  assert.match(page, /Closer look · whole city/);
  assert.match(page, /if \(focusGroup\) \{\s*const idSet = new Set\(focusGroup\.ids\);/);
  assert.match(css, /Track I4 — Overview \+ in-app Packet night/);
  assert.match(css, /\.overview-city/);
  assert.match(css, /\.packet-readout/);
  assert.match(brief, /background:#f2c94c/);
  assert.match(brief, /color:#17211f/);
  assert.match(brief, /<span class="draft">DRAFT<\/span>/);
  assert.match(brief, /Equality \$\{brief\.evidence\.equalityStatus\}/);
  assert.doesNotMatch(brief, /#071219/);
  assert.match(page, /type ActiveScreen = "overview" \| "explore" \| "inspect" \| "compare" \| "packet"/);
});

test("Ask Legend toolkit task box is wired without an LLM", async () => {
  const [page, css, toolkit] = await Promise.all([
    readFile(new URL("app/page.tsx", appRoot), "utf8"),
    readFile(new URL("app/globals.css", appRoot), "utf8"),
    readFile(new URL("lib/ask-legend/toolkit.mjs", appRoot), "utf8"),
  ]);
  assert.match(page, /data-testid="legend-task-box"/);
  assert.match(page, /placeholder="What are you trying to do\?"/);
  assert.match(page, /ASK_LEGEND_TASK_HONESTY/);
  assert.match(page, /runPlannerJob\(/);
  assert.match(page, /event\.key !== "\/"/);
  assert.match(css, /\.legend-task-box/);
  assert.match(toolkit, /Governed investigation only — no risk, cause, or treatment/);
  assert.doesNotMatch(toolkit, /openai|anthropic|fetch\(|ChatCompletion|api\.openai/i);
  assert.doesNotMatch(page, /openai|anthropic|ChatCompletion/i);
  assert.match(page, /data-testid="map-hud-who"/);
  assert.match(page, /data-testid="who-lock-row"/);
  assert.match(page, /data-testid="lock-on-injury"/);
  assert.match(page, /data-road-user=\{roadUser\}/);
  assert.match(page, /data-testid="packet-subject"/);
  assert.match(page, /data-testid="packet-date-vs-window"/);
  assert.match(page, /data-testid="packet-field-request"/);
  assert.match(page, /data-testid="packet-situate"/);
  assert.match(page, /Street records at this place · not Yes \/ No \/ Plan/);
  assert.match(page, /Published in this source/);
  assert.doesNotMatch(page, /Situate Yes \/ Unknown/);
  assert.match(page, /resolvePacketSubject/);
  assert.match(css, /\.map-hud-who/);
  assert.match(css, /\.who-lock-row/);
  assert.match(toolkit, /isSelectedPlacePronoun/);
  assert.match(toolkit, /Why is this showing up|this place|here/);
});

test("P4 binds crash-row WHO flags and recorded clock time without mutating the nine hashes", async () => {
  const frozen = {
    "app-data.json.gz": "7a848a3174e74090709842903ca7d30c85691250cadc2b8d7e564b0641314614",
    "place-labels.json.gz": "21196fcdd9d89d03092a9f4abb8572e060861f0cb828fc2fa731e07adf9032b9",
    "ranked-places.geojson.gz": "56e2e2a3d62d31eb88bdffe434210001554bf658a3eac4a62bb020af5dd27972",
    "situate-1f-index.json.gz": "4d9d51ff8d5ba8011ade86bd37c262c0bca5a7cb0dcf28f2d93c75af49416d8f",
    "situate-approach-context-v1.json.gz": "b86e702c5c9de6bc7e14e08f876c77220e27d6d6b7d6c95dfff8c88f0a4f3ba9",
    "situate-approach-context-wave2-v1.json.gz": "5dc43770ffb74d5d676bda73e0a0c754fe92f2146ffc1c92fdedccad762e4ddf",
    "uncertainty.geojson.gz": "a64edd932ce3abdd78eea74a7fa9dde880000ced374b841520f6906109ad5137",
    "p2-5-ui-objects-v1.json.gz": "b33dcc8a9e21ad88e5798eb772f85ee7157e512de09ce49fdc10394921a7d454",
    "crash-when-v1.json.gz": "fa47ff55cdca6df709c1ffd031d5bd73fde846027a0ada8dc0106e2941864352",
  };
  for (const [name, expected] of Object.entries(frozen)) {
    const bytes = await readFile(new URL(`public/data/${name}`, appRoot));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, name);
  }
  const whoBytes = await readFile(new URL("public/data/crash-row-who-v1.json.gz", appRoot));
  assert.equal(createHash("sha256").update(whoBytes).digest("hex"), "2dcfe92d713a6ee1f5921d9476d7ec7c5fd2b47456f962e7246c828d0c52e870");
  const [page, css, p25, crashWhen, crashWho] = await Promise.all([
    readFile(new URL("app/page.tsx", appRoot), "utf8"),
    readFile(new URL("app/globals.css", appRoot), "utf8"),
    readJsonGzip("public/data/p2-5-ui-objects-v1.json.gz"),
    readJsonGzip("public/data/crash-when-v1.json.gz"),
    readJsonGzip("public/data/crash-row-who-v1.json.gz"),
  ]);
  assert.equal(crashWho.meta.projectionVersion, "HL-CRASH-ROW-WHO-v1");
  assert.equal(crashWho.meta.supportingIdCount, 95_175);
  assert.equal(crashWho.meta.matchedIdCount, 95_175);
  assert.equal(crashWho.meta.missingIdCount, 0);
  assert.equal(crashWho.meta.p25ProjectionSha256, frozen["p2-5-ui-objects-v1.json.gz"]);
  const buffalo = p25.places["intersection_node:26912"];
  const everyone = buffalo.ids["36m"].everyone.injury;
  const pedestrian = buffalo.ids["36m"].pedestrian.injury;
  assert.equal(everyone.length, 66);
  assert.equal(pedestrian.length, 8);
  assert.deepEqual(pedestrian.slice().sort((a, b) => a - b), [4694522, 4725667, 4781251, 4788016, 4815980, 4820925, 4859047, 4894051]);
  const goldWho = everyone.map((id) => crashWho.records[String(id)]);
  assert.equal(goldWho.filter((row) => row.pedestrian).length, 8);
  assert.equal(goldWho.filter((row) => row.cyclist).length, 5);
  assert.equal(goldWho.filter((row) => row.motorist).length, 52);
  assert.equal(goldWho.filter((row) => row.uncategorized).length, 1);
  assert.equal(goldWho.filter((row) => Number(row.pedestrian) + Number(row.cyclist) + Number(row.motorist) >= 2).length, 0);
  assert.equal(crashWho.records["4812290"].uncategorized, true);
  assert.equal(crashWho.records["4812290"].personsInjured, 1);
  assert.equal(goldWho.reduce((sum, row) => sum + (row.personsInjured ?? 0), 0), 97);
  assert.equal(goldWho.reduce((sum, row) => sum + (row.personsKilled ?? 0), 0), 0);
  for (const id of pedestrian) {
    assert.equal(crashWho.records[String(id)].pedestrian, true);
    assert.ok(everyone.includes(id));
  }
  assert.ok(everyone.every((id) => crashWhen.records[String(id)].crashTime));
  assert.match(page, /crash-row-who-v1\.json\.gz/);
  assert.match(page, /HL-CRASH-ROW-WHO-v1/);
  assert.match(page, /Walking \/ Biking \/ Driving|CrashWhoFlags/);
  assert.match(page, /Groups can overlap\. Counts are crashes involving that class/);
  assert.match(page, /Recorded clock time on police crash records/);
  assert.match(page, /data-testid="crash-clock-profile"/);
  assert.match(page, /data-testid="crash-who-breakdown"/);
  assert.match(page, /data-testid="crash-people-beside"/);
  assert.match(page, /crashWho=\{crashWho\}/);
  assert.match(page, /NYC_BOUNDS: \[\[number, number\], \[number, number\]\] = \[\[-74\.26, 40\.49\], \[-73\.70, 40\.92\]\]/);
  assert.doesNotMatch(page, /dangerous at rush hour/i);
  assert.doesNotMatch(page, /repeatedly appear/);
  assert.doesNotMatch(page, /contributing factor is a cause/i);
  assert.match(css, /Track P4 — crash-row WHO flags/);
  assert.match(css, /\.crash-who-flag/);
  assert.match(css, /\.clock-hour-bars/);
});

test("P3.1 binds two Eastern Parkway LION components as an additive overlay", async () => {
  const frozen = {
    "app-data.json.gz": "7a848a3174e74090709842903ca7d30c85691250cadc2b8d7e564b0641314614",
    "place-labels.json.gz": "21196fcdd9d89d03092a9f4abb8572e060861f0cb828fc2fa731e07adf9032b9",
    "ranked-places.geojson.gz": "56e2e2a3d62d31eb88bdffe434210001554bf658a3eac4a62bb020af5dd27972",
    "situate-1f-index.json.gz": "4d9d51ff8d5ba8011ade86bd37c262c0bca5a7cb0dcf28f2d93c75af49416d8f",
    "situate-approach-context-v1.json.gz": "b86e702c5c9de6bc7e14e08f876c77220e27d6d6b7d6c95dfff8c88f0a4f3ba9",
    "situate-approach-context-wave2-v1.json.gz": "5dc43770ffb74d5d676bda73e0a0c754fe92f2146ffc1c92fdedccad762e4ddf",
    "uncertainty.geojson.gz": "a64edd932ce3abdd78eea74a7fa9dde880000ced374b841520f6906109ad5137",
    "p2-5-ui-objects-v1.json.gz": "b33dcc8a9e21ad88e5798eb772f85ee7157e512de09ce49fdc10394921a7d454",
    "crash-when-v1.json.gz": "fa47ff55cdca6df709c1ffd031d5bd73fde846027a0ada8dc0106e2941864352",
  };
  for (const [name, expected] of Object.entries(frozen)) {
    const bytes = await readFile(new URL(`public/data/${name}`, appRoot));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, name);
  }
  const whoBytes = await readFile(new URL("public/data/crash-row-who-v1.json.gz", appRoot));
  assert.equal(createHash("sha256").update(whoBytes).digest("hex"), "2dcfe92d713a6ee1f5921d9476d7ec7c5fd2b47456f962e7246c828d0c52e870");
  const overlayBytes = await readFile(new URL("public/data/corridor-lion26b-v0-eastern-pkwy.json.gz", appRoot));
  assert.equal(overlayBytes[0], 0x1f);
  assert.equal(overlayBytes[1], 0x8b);
  assert.equal(createHash("sha256").update(overlayBytes).digest("hex"), "3ac2d489e79b6cc43cd6c8bfe04f07b73e055c93f012be5e1ce1a01874b3ae61");
  const [page, css, p25, overlay] = await Promise.all([
    readFile(new URL("app/page.tsx", appRoot), "utf8"),
    readFile(new URL("app/globals.css", appRoot), "utf8"),
    readJsonGzip("public/data/p2-5-ui-objects-v1.json.gz"),
    readJsonGzip("public/data/corridor-lion26b-v0-eastern-pkwy.json.gz"),
  ]);
  assert.equal(Object.keys(p25.corridors).length, 18);
  assert.equal(overlay.meta.overlayVersion, "HL-CORRIDOR-LION26B-v0-EASTERN-PKWY-OVERLAY-v1");
  assert.equal(overlay.meta.corridorVersion, "HL-CORRIDOR-LION26B-v0");
  assert.equal(overlay.meta.officialDotCorridorLayer, false);
  assert.equal(overlay.meta.p25ProjectionSha256, frozen["p2-5-ui-objects-v1.json.gz"]);
  const c001 = overlay.corridors["HL-CORRIDOR-L26B-v0-B3-SC338430-LGC01-C001"];
  const c002 = overlay.corridors["HL-CORRIDOR-L26B-v0-B3-SC338430-LGC01-C002"];
  assert.equal(Object.keys(overlay.corridors).length, 2);
  assert.equal(c001.displayName, "Eastern Parkway");
  assert.equal(c002.displayName, "Eastern Parkway");
  assert.equal(c001.componentOrdinal, 1);
  assert.equal(c002.componentOrdinal, 2);
  assert.equal(c001.conservation36.uniqueCollisionIds, 879);
  assert.equal(c001.conservation36.ids.length, 879);
  assert.equal(c001.conservation36.naiveLinkRows, 1657);
  assert.equal(c002.conservation36.uniqueCollisionIds, 25);
  assert.equal(c002.conservation36.ids.length, 25);
  assert.ok(c001.placeIds.includes("intersection_node:26912"));
  assert.ok(c001.placeIds.includes("intersection_node:18681"));
  assert.ok(!c001.placeIds.includes("intersection_node:27195"));
  assert.ok(!c002.placeIds.includes("intersection_node:27195"));
  assert.ok(c001.segmentIds.includes("43363"));
  assert.ok(c001.segmentIds.includes("43365"));
  assert.equal(c001.metrics.injury.count, c001.metrics.injury.ids.length);
  assert.equal(c001.metrics.fatal.count, c001.metrics.fatal.ids.length);
  assert.equal(c002.metrics.injury.count, c002.metrics.injury.ids.length);
  assert.ok(!JSON.stringify(overlay).includes("Utica Avenue"));
  assert.ok(!JSON.stringify(overlay).includes("EASTERN PARKWAY BIKE PATH"));
  assert.ok(!p25.corridors["HL-CORRIDOR-L26B-v0-B3-SC338430-LGC01-C001"]);
  assert.match(page, /corridor-lion26b-v0-eastern-pkwy\.json\.gz/);
  assert.match(page, /mergeCorridorOverlay/);
  assert.match(page, /data-testid="analytical-corridor-select"/);
  assert.match(page, /data-testid="packet-corridor-component"/);
  assert.match(page, /Not Vision Zero View, SIP, or official priority/);
  assert.match(page, /Search is not this lock/);
  assert.doesNotMatch(page, /the Eastern Parkway corridor/);
  assert.match(page, /NYC_BOUNDS: \[\[number, number\], \[number, number\]\] = \[\[-74\.26, 40\.49\], \[-73\.70, 40\.92\]\]/);
  assert.match(css, /Track P3\.1 — Eastern Parkway LION component overlay/);
});

test("P5 shareable investigation set is a fail-closed URL, not a new gz", async () => {
  const frozen = {
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
  const dataDir = new URL("public/data/", appRoot);
  const { readdir } = await import("node:fs/promises");
  const gzFiles = (await readdir(dataDir)).filter((name) => name.endsWith(".gz")).sort();
  assert.deepEqual(gzFiles, Object.keys(frozen).sort());
  for (const [name, expected] of Object.entries(frozen)) {
    const bytes = await readFile(new URL(`public/data/${name}`, appRoot));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, name);
  }
  const [page, css] = await Promise.all([
    readFile(new URL("app/page.tsx", appRoot), "utf8"),
    readFile(new URL("app/globals.css", appRoot), "utf8"),
  ]);
  assert.match(page, /from "\.\.\/lib\/share-set\.mjs"/);
  assert.match(page, /data-testid="share-copy-link"/);
  assert.match(page, /data-testid="share-export-json"/);
  assert.match(page, /data-testid="share-refuse"/);
  assert.match(page, /data-testid="share-set-copy"/);
  assert.match(page, /SHARE_SET_COPY/);
  assert.match(page, /parseAndValidateShareHref/);
  assert.match(page, /SHARE_STORAGE_KEY/);
  assert.doesNotMatch(page, /notOfficialPriority: false/);
  assert.match(page, /NYC_BOUNDS: \[\[number, number\], \[number, number\]\] = \[\[-74\.26, 40\.49\], \[-73\.70, 40\.92\]\]/);
  assert.match(css, /Track P5 — shareable investigation set \(W22\)/);
});

test("P6.H4 binds citywide coverage footnotes only on Packet limitations and Evidence Brief data-currency", async () => {
  const frozen = {
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
  for (const [name, expected] of Object.entries(frozen)) {
    const bytes = await readFile(new URL(`public/data/${name}`, appRoot));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, name);
  }
  const [page, brief, chips, p25, situate] = await Promise.all([
    readFile(new URL("app/page.tsx", appRoot), "utf8"),
    readFile(new URL("lib/evidence-brief.ts", appRoot), "utf8"),
    readFile(new URL("lib/ask-legend/chips.mjs", appRoot), "utf8"),
    readJsonGzip("public/data/p2-5-ui-objects-v1.json.gz"),
    readJsonGzip("public/data/situate-1f-index.json.gz"),
  ]);
  assert.match(page, /data-testid="packet-limitations"/);
  assert.match(page, /data-testid="packet-coverage-footnotes"/);
  assert.match(page, /coverageFootnotes/);
  assert.match(brief, /coverageFootnotesBlock/);
  assert.match(brief, /5\. Data currency/);
  assert.match(brief, /coverageHtml/);
  assert.match(page, /coverageFootnotes\.heading/);
  const situateBlock = page.slice(page.indexOf("data-testid=\"packet-situate\""), page.indexOf("data-testid=\"packet-date-vs-window\""));
  assert.doesNotMatch(situateBlock, /13,543|qt6m-xctn|fb86-vt7u|current_phase/);
  assert.doesNotMatch(chips, /qt6m-xctn|fb86-vt7u|13,543|traffic_signals|ordinary.signal/i);
  assert.match(page, /NYC_BOUNDS: \[\[number, number\], \[number, number\]\] = \[\[-74\.26, 40\.49\], \[-73\.70, 40\.92\]\]/);
  const buffalo = p25.places["intersection_node:26912"];
  const utica = p25.places["intersection_node:26863"];
  const top = Object.entries(p25.places)
    .filter(([id]) => id.startsWith("intersection_node:"))
    .sort((a, b) => b[1].counts["36m"].everyone.injury - a[1].counts["36m"].everyone.injury)[0];
  assert.equal(top[0], "intersection_node:26912");
  assert.equal(buffalo.counts["36m"].everyone.injury, 66);
  assert.equal(buffalo.counts["36m"].everyone.fatal, 0);
  assert.equal(utica.counts["36m"].everyone.injury, 43);
  assert.match(JSON.stringify(situate.places["intersection_node:26912"]), /date_insta=2023-03-01/);
});

test("copy contrast Hold up fold keeps window checks without printing robustness", async () => {
  const [page, css, p25] = await Promise.all([
    readFile(new URL("app/page.tsx", appRoot), "utf8"),
    readFile(new URL("app/globals.css", appRoot), "utf8"),
    readJsonGzip("public/data/p2-5-ui-objects-v1.json.gz"),
  ]);
  assert.doesNotMatch(page, /Hold up\?/);
  assert.doesNotMatch(page, />Robustness</);
  assert.doesNotMatch(page, /tab === "robustness"/);
  assert.match(page, /Does this still show if we change the window\?/);
  assert.match(page, /data-testid="window-checks"/);
  assert.match(page, /Incomplete or deferred tests are never summarized as “stable\.”/);
  assert.match(page, /Window checks/);
  assert.match(page, /Where crash reports pile up on NYC streets\./);
  assert.match(page, /The night map and the list share one lock\./);
  assert.match(page, /One place: Hurt and Died, dated reports/);
  assert.match(page, /Two places, same Who, How long, and grain\./);
  assert.match(page, /Keep Who, How long, and grain matched\./);
  assert.match(page, /Look-order under your lock\./);
  assert.doesNotMatch(page, /Look at places\. Switch injury and fatal/);
  assert.match(page, /\["feature-state", "pulse"\]/);
  assert.match(page, /id: "places-hit"/);
  assert.match(page, /"circle-radius": 11/);
  assert.match(page, /"circle-radius": 12/);
  assert.match(page, /lastPulseIdRef/);
  assert.match(page, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(page, /setPaintProperty\("places-point", "circle-radius",[^\n]*(injuryCount|fatalCount|activeP25Count)/);
  assert.doesNotMatch(page, /heatmap|extrusion|pitch:\s*[1-9]/);
  assert.match(css, /\.window-checks-read, \.robustness-read \{[^}]*background: rgba\(112,184,173,\.12\)/);
  assert.doesNotMatch(css, /\.robustness-read \{[^}]*#edf2ee/);
  assert.doesNotMatch(css, /\.situate-totals span \{[^}]*#d8d0c1/);
  assert.doesNotMatch(css, /\.map-framing-hint \{[^}]*#f5f2e8|#fffaf0|245, 242, 232/);
  assert.match(css, /\.overview-copy > p \{[^}]*color: var\(--ink\)[^}]*font-size: 16px/);
  assert.match(css, /\.window-checks-read, \.robustness-read \{[^}]*font-size: 13px/);
  assert.match(css, /\.count-mark\.injury\.active strong \{ color: #d98b28/);
  assert.match(css, /\.count-mark\.fatal\.active strong \{ color: #c94a37/);
  assert.equal(p25.places["intersection_node:26912"].counts["36m"].everyone.injury, 66);
  assert.match(page, /NYC_BOUNDS: \[\[number, number\], \[number, number\]\] = \[\[-74\.26, 40\.49\], \[-73\.70, 40\.92\]\]/);
});


