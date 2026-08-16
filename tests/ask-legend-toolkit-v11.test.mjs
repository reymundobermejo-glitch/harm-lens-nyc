import assert from "node:assert/strict";
import test from "node:test";

import {
  ASK_LEGEND_TOOLKIT_V11,
  MISSING_EVIDENCE_ITEMS,
  bucketObservedHours,
  runPlannerJob,
} from "../lib/ask-legend/index.mjs";

const universe = [
  {
    id: "intersection_node:26912",
    placeType: "intersection_node",
    placeId: 26912,
    title: "Buffalo Ave & Eastern Pkwy",
    streetNames: ["Buffalo Ave", "Eastern Pkwy"],
    displayName: "Buffalo Ave & Eastern Pkwy",
  },
];
const ctx = {
  universe,
  allowedPlaceIds: ["intersection_node:26912"],
  injuryCount: 66,
  fatalCount: 0,
  supportingIds: [1, 2, 3, 4],
  crashWhenRecords: {
    1: { crashTime: "08:10:00" },
    2: { crashTime: "08:40:00" },
    3: { crashTime: "17:05:00" },
    4: { crashTime: null },
  },
};
const selected = {
  screen: "inspect",
  selectedId: "intersection_node:26912",
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

test("v1.1 stage sits on top of v1 without an LLM", () => {
  assert.equal(ASK_LEGEND_TOOLKIT_V11, "toolkit-v1.1");
});

test("v1 gold Why / 2023 / Prepare / refuse still pass through", () => {
  const why = runPlannerJob("Why is Buffalo Ave & Eastern Pkwy showing up?", { ...selected, selectedId: null }, ctx);
  assert.equal(why.ok, true);
  assert.deepEqual(why.toolNames, ["selectPlace", "openInspect", "composeWhyPlace"]);
  const crashes = runPlannerJob("Show 2023 crashes", selected, ctx);
  assert.deepEqual(crashes.toolNames, ["openInspect", "setCrashYear"]);
  const prep = runPlannerJob("Prepare this for the meeting", selected, ctx);
  assert.equal(prep.brief.releaseStatus, "DRAFT");
  const refuse = runPlannerJob("What should DOT install here?", selected, ctx);
  assert.equal(refuse.ok, false);
  assert.deepEqual(refuse.tools, []);
});

test("Walk me through this place tours Counts → Crashes → On the street → Hold up?", () => {
  const none = runPlannerJob("Walk me through this place", { ...selected, selectedId: null }, ctx);
  assert.equal(none.ok, false);
  assert.deepEqual(none.tools, []);
  const result = runPlannerJob("Walk me through this place", selected, ctx);
  assert.equal(result.ok, true);
  assert.deepEqual(result.toolNames, ["walkThroughPlace"]);
  assert.deepEqual(result.walk.map((step) => step.tab), ["why", "records", "situate", "robustness"]);
  assert.match(result.walk[0].caption, /Counts/);
  assert.match(result.walk[3].caption, /Hold up/);
});

test("G-MISS-1 What am I missing lists field gaps, not treatments", () => {
  const result = runPlannerJob("What am I missing?", selected, ctx);
  assert.equal(result.ok, true);
  assert.ok(result.toolNames.includes("listMissingEvidence"));
  for (const item of MISSING_EVIDENCE_ITEMS) assert.ok(result.missing.items.includes(item));
  assert.match(result.missing.never, /Never untreated/i);
  assert.doesNotMatch(JSON.stringify(result.missing), /install|SIP|treatment prescription/i);
});

test("G-CHAL-1 Poke holes is four lines with no official priority", () => {
  const result = runPlannerJob("Poke holes", selected, ctx);
  assert.equal(result.ok, true);
  assert.ok(result.toolNames.includes("challengeCase"));
  assert.ok(result.challenge.supports);
  assert.ok(result.challenge.weakens);
  assert.ok(result.challenge.unknowns);
  assert.match(result.challenge.strongest, /66/);
  assert.match(result.challenge.strongest, /not official priority/i);
  assert.doesNotMatch(result.challenge.strongest, /should install|deserves resources/i);
  const gold = runPlannerJob("I think this intersection deserves resources. Help me make the case.", selected, ctx);
  assert.equal(gold.ok, true);
  assert.ok(gold.toolNames.includes("challengeCase"));
});

test("observedHours buckets crash_time as source_fact, not cause", () => {
  const hours = bucketObservedHours(ctx.supportingIds, ctx.crashWhenRecords);
  assert.equal(hours.claimClass, "source_fact");
  assert.equal(hours.buckets.find((row) => row.hour === 8)?.count, 2);
  assert.equal(hours.unknown, 1);
  assert.match(hours.prohibition, /Not cause/);
  const result = runPlannerJob("When during the day are these records?", selected, ctx);
  assert.equal(result.ok, true);
  assert.ok(result.toolNames.includes("observedHours"));
  assert.equal(result.hours.claimClass, "source_fact");
  assert.equal(result.hours.detector, "time_of_day");
  assert.match(result.hours.prohibition, /Not cause/);
  assert.match(result.hours.prohibition, /Not “dangerous at rush hour.”/);
  assert.doesNotMatch(result.understood, /dangerous at rush hour/);
});
