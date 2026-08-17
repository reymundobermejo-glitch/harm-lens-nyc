import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import {
  ASK_LEGEND_STAGE,
  ASK_LEGEND_TASK_HONESTY,
  ASK_LEGEND_TOOLKIT_STAGE,
  TOOLKIT_TOOLS,
  buildSearchUniverse,
  readSessionBag,
  runPlannerJob,
  searchPlaces,
} from "../lib/ask-legend/index.mjs";

const universe = [
  {
    id: "intersection_node:26912",
    placeType: "intersection_node",
    placeId: 26912,
    title: "Buffalo Ave & Eastern Pkwy",
    streetNames: ["Buffalo Ave", "Eastern Parkway", "Eastern Pkwy"],
    displayName: "Buffalo Ave & Eastern Pkwy",
  },
  {
    id: "intersection_node:34754",
    placeType: "intersection_node",
    placeId: 34754,
    title: "101 Ave & 129 St",
    streetNames: ["101 Ave", "129 St"],
    displayName: "101 Ave & 129 St",
  },
  {
    id: "intersection_node:21791",
    placeType: "intersection_node",
    placeId: 21791,
    title: "Ave C & E 18 St",
    streetNames: ["Avenue C", "Ave C", "E 18 St"],
    displayName: "Ave C & E 18 St",
  },
  {
    id: "intersection_node:44846",
    placeType: "intersection_node",
    placeId: 44846,
    title: "Henry Hudson Pkwy E & W 230 St",
    streetNames: ["Henry Hudson Pkwy E", "W 230 St"],
    displayName: "Henry Hudson Pkwy E & W 230 St",
  },
  {
    id: "intersection_node:49014",
    placeType: "intersection_node",
    placeId: 49014,
    title: "E Mosholu Pkwy S & Jerome Ave",
    streetNames: ["E Mosholu Pkwy S", "Jerome Ave"],
    displayName: "E Mosholu Pkwy S & Jerome Ave",
  },
];
const allowedPlaceIds = universe.map((place) => place.id);
const ctx = { universe, allowedPlaceIds, injuryCount: 66, fatalCount: 0 };
const session = {
  screen: "explore",
  selectedId: null,
  compareIds: [],
  lens: "injury",
  roadUser: "everyone",
  windowKey: "36m",
  grain: "intersection_node",
  look: null,
  pileIds: [],
  query: "",
  crashYearFocus: null,
  analysisEnd: "2026-06-11",
  sourceStatus: "maintenance",
};

test("toolkit does not replace G0 and does not enable G2", () => {
  assert.equal(ASK_LEGEND_STAGE, "G0");
  assert.equal(ASK_LEGEND_TOOLKIT_STAGE, "toolkit");
  assert.equal(ASK_LEGEND_TASK_HONESTY, "Governed investigation only — no risk, cause, or treatment.");
  assert.ok(TOOLKIT_TOOLS.includes("composeWhyPlace"));
  assert.ok(TOOLKIT_TOOLS.includes("composeEvidenceBrief"));
  assert.equal(searchPlaces("129st 101 ave in queens", universe)[0]?.id, "intersection_node:34754");
});

test("I0 remainder: eastern pkwy is named-street identity, not pkwy suffix", () => {
  const hits = searchPlaces("eastern pkwy", universe);
  const ids = hits.map((hit) => hit.id);
  assert.ok(ids.includes("intersection_node:26912"));
  assert.ok(!ids.includes("intersection_node:44846"));
  assert.ok(!ids.includes("intersection_node:49014"));
  assert.equal(searchPlaces("129st 101 ave in queens", universe)[0]?.id, "intersection_node:34754");
});

test("I0 remainder gold: frozen 34754 and eastern pkwy named-street identity", async () => {
  const appRoot = new URL("../", import.meta.url);
  const [appBytes, labelBytes] = await Promise.all([
    readFile(new URL("public/data/app-data.json.gz", appRoot)),
    readFile(new URL("public/data/place-labels.json.gz", appRoot)),
  ]);
  const appData = JSON.parse(gunzipSync(appBytes).toString("utf8"));
  const labels = JSON.parse(gunzipSync(labelBytes).toString("utf8"));
  const frozen = buildSearchUniverse(appData.places, labels);
  assert.equal(searchPlaces("129st 101 ave in queens", frozen)[0]?.id, "intersection_node:34754");
  const eastern = searchPlaces("eastern pkwy", frozen);
  const titles = eastern.map((hit) => frozen.find((place) => place.id === hit.id)?.title ?? "");
  assert.ok(eastern.some((hit) => hit.id === "intersection_node:26912"));
  assert.ok(titles.every((title) => /eastern/i.test(title)));
  assert.ok(!titles.some((title) => /henry hudson|mosholu/i.test(title)));
});

test("session bag copies only known workspace fields", () => {
  const bag = readSessionBag({
    screen: "inspect",
    selectedId: "intersection_node:26912",
    compareIds: ["intersection_node:26912", "intersection_node:21791"],
    lens: "injury",
    roadUser: "everyone",
    windowKey: "36m",
    mode: "intersection_node",
    mapLookBorough: "Brooklyn",
    focusGroup: { ids: ["intersection_node:1"] },
    query: "buffalo",
    crashYearFocus: "2023",
    analysisEnd: "2026-06-11",
    sourceStatus: "maintenance",
    inventedMetric: "KSI",
  });
  assert.equal(bag.selectedId, "intersection_node:26912");
  assert.equal(bag.look, "Brooklyn");
  assert.deepEqual(bag.pileIds, ["intersection_node:1"]);
  assert.equal("inventedMetric" in bag, false);
  assert.equal("ksi" in bag, false);
});

test("G-INV-26912 Why Buffalo selects 26912 and opens Inspect Why", () => {
  const result = runPlannerJob("Why is Buffalo Ave & Eastern Pkwy showing up?", session, ctx);
  assert.equal(result.ok, true);
  assert.deepEqual(result.toolNames, ["selectPlace", "openInspect", "composeWhyPlace"]);
  assert.equal(result.tools[0].args.placeId, "intersection_node:26912");
  assert.equal(result.tools[1].args.tab, "why");
  assert.match(result.why.statement, /66/);
  assert.match(result.why.doesNotSupport, /risk|priority|treatment/i);
  assert.match(result.why.concentrationNotRisk, /concentration is not the same as high individual risk/i);
  assert.doesNotMatch(result.trace, /\bLLM\b|openai|anthropic/i);
});

test("G-PREP-1 prepare meeting opens Packet DRAFT, not a treatment", () => {
  const result = runPlannerJob("Prepare this for the meeting", { ...session, selectedId: "intersection_node:26912" }, ctx);
  assert.equal(result.ok, true);
  assert.deepEqual(result.toolNames, ["composeEvidenceBrief", "openPacket"]);
  assert.equal(result.brief.releaseStatus, "DRAFT");
  assert.match(result.brief.next, /never a treatment/i);
});

test("Show 2023 crashes focuses Inspect Crashes on 2023", () => {
  const result = runPlannerJob("Show 2023 crashes", { ...session, selectedId: "intersection_node:26912" }, ctx);
  assert.equal(result.ok, true);
  assert.deepEqual(result.toolNames, ["openInspect", "setCrashYear"]);
  assert.equal(result.tools[0].args.tab, "records");
  assert.equal(result.tools[1].args.year, "2023");
});

test("G-FLIP-1 switch to Died keeps camera and only sets fatal lens", () => {
  const died = runPlannerJob("Switch to Died", { ...session, selectedId: "intersection_node:26912" }, ctx);
  assert.equal(died.ok, true);
  assert.deepEqual(died.toolNames, ["setLens"]);
  assert.equal(died.tools[0].args.lens, "fatal");
  assert.equal(died.keepCamera, true);
  const flip = runPlannerJob("Would fatalities change this?", session, ctx);
  assert.equal(flip.ok, true);
  assert.equal(flip.tools[0].args.lens, "fatal");
  assert.equal(flip.keepCamera, true);
});

test("gold must-refuse does not plan map mutations", () => {
  const cases = [
    ["What should DOT install here?", "treatment"],
    ["Is this the most dangerous intersection for a pedestrian?", "risk"],
    ["Left turns caused these crashes.", "cause"],
    ["There's no APS so they did nothing.", "untreated"],
    ["What's going on at a fake node 99999999?", "place"],
    ["Show me KSI.", "ksi"],
    ["The bike lane failed.", "effectiveness"],
  ];
  for (const [prompt, code] of cases) {
    const result = runPlannerJob(prompt, { ...session, selectedId: "intersection_node:26912" }, ctx);
    assert.equal(result.ok, false, prompt);
    assert.equal(result.refused, true, prompt);
    assert.deepEqual(result.tools, [], prompt);
    assert.deepEqual(result.toolNames, [], prompt);
    if (code !== "place") assert.equal(result.prohibition, code, prompt);
  }
});

test("unknown job and missing place: offer vs refuse", () => {
  const offer = runPlannerJob("Invent a new rank for this corner", session, ctx);
  assert.equal(offer.ok, true);
  assert.equal(offer.job, "offer");
  assert.deepEqual(offer.tools, []);
  assert.match(offer.coachCopy, /Start/);
  assert.deepEqual(runPlannerJob("Show 2023 crashes", session, ctx).tools, []);
  assert.equal(runPlannerJob("Show 2023 crashes", session, ctx).ok, false);
  assert.deepEqual(runPlannerJob("Prepare this for the meeting", session, ctx).tools, []);
});

test("Legend v1.2 pronouns this / this place / here use selectedId 26912", () => {
  const selected = { ...session, selectedId: "intersection_node:26912" };
  const why = runPlannerJob("Why is this showing up?", selected, ctx);
  assert.equal(why.ok, true);
  assert.equal(why.tools[0].args.placeId, "intersection_node:26912");
  const place = runPlannerJob("Why is this place showing up?", selected, ctx);
  assert.equal(place.tools[0].args.placeId, "intersection_node:26912");
  const missing = runPlannerJob("What am I missing?", selected, ctx);
  assert.equal(missing.ok, true);
  assert.ok(missing.toolNames.includes("listMissingEvidence"));
  const install = runPlannerJob("What should DOT install here?", selected, ctx);
  assert.equal(install.ok, false);
  assert.deepEqual(install.tools, []);
  const none = runPlannerJob("Why is this showing up?", { ...session, selectedId: null }, ctx);
  assert.equal(none.ok, false);
  assert.match(none.reason, /Choose a place/i);
  assert.deepEqual(none.tools, []);
});

test("Prepare uses packet subject / Compare A, not last click on B", () => {
  const result = runPlannerJob("Prepare this for the meeting", {
    ...session,
    selectedId: "intersection_node:21791",
    packetSubjectId: "intersection_node:26912",
    compareIds: ["intersection_node:26912", "intersection_node:21791"],
  }, ctx);
  assert.equal(result.ok, true);
  assert.equal(result.tools[0].args.placeId, "intersection_node:26912");
  assert.equal(result.tools[1].args.placeId, "intersection_node:26912");
});
