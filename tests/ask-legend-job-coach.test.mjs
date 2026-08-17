import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import {
  ASK_LEGEND_JOB_COACH,
  ASK_LEGEND_STAGE,
  LIST_ORDER_NOT_DANGEROUS,
  boroughOfLonLat,
  resolveCoachLock,
  runPlannerJob,
} from "../lib/ask-legend/index.mjs";

const GOLD_HASHES = {
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

const rankedPlaces = [
  {
    id: "intersection_node:26912",
    placeType: "intersection_node",
    placeId: 26912,
    longitude: -73.92560682554654,
    latitude: 40.66850525271033,
    injuryRank: 1,
    fatalRank: 379,
    injuryCount: 66,
    fatalCount: 0,
    count: 66,
  },
  {
    id: "intersection_node:26863",
    placeType: "intersection_node",
    placeId: 26863,
    longitude: -73.93111937853939,
    latitude: 40.66879854250314,
    injuryRank: 3,
    fatalRank: 379,
    injuryCount: 43,
    fatalCount: 0,
    count: 43,
  },
  {
    id: "intersection_node:41385",
    placeType: "intersection_node",
    placeId: 41385,
    longitude: -73.9374,
    latitude: 40.74892,
    injuryRank: 5,
    fatalRank: 200,
    injuryCount: 36,
    fatalCount: 0,
    count: 36,
  },
  {
    id: "intersection_node:34754",
    placeType: "intersection_node",
    placeId: 34754,
    longitude: -73.81789813429059,
    latitude: 40.69225103031204,
    injuryRank: 5596,
    fatalRank: 400,
    injuryCount: 3,
    fatalCount: 0,
    count: 3,
  },
  {
    id: "intersection_node:21791",
    placeType: "intersection_node",
    placeId: 21791,
    longitude: -73.9775353163581,
    latitude: 40.7258766747295,
    injuryRank: 5596,
    fatalRank: 1,
    injuryCount: 3,
    fatalCount: 2,
    count: 3,
  },
];

const allowedPlaceIds = rankedPlaces.map((place) => place.id);
const ctx = { rankedPlaces, allowedPlaceIds, universe: rankedPlaces };
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

const QB = "Compare the Queens location with the most collisions with Brooklyn’s and show both.";

test("job coach is not G0 and not G2", () => {
  assert.equal(ASK_LEGEND_STAGE, "G0");
  assert.equal(ASK_LEGEND_JOB_COACH, "job-coach-v1");
});

test("gold coords bind Buffalo Brooklyn and 34754 Queens", () => {
  assert.equal(boroughOfLonLat(-73.92560682554654, 40.66850525271033), "Brooklyn");
  assert.equal(boroughOfLonLat(-73.93111937853939, 40.66879854250314), "Brooklyn");
  assert.equal(boroughOfLonLat(-73.81789813429059, 40.69225103031204), "Queens");
  assert.equal(boroughOfLonLat(-73.9374, 40.74892), "Queens");
  assert.equal(boroughOfLonLat(-73.9775353163581, 40.7258766747295), "Manhattan");
});

test("lock unset uses Everyone / 36m / Hurt / intersections and says so", () => {
  const lock = resolveCoachLock({});
  assert.equal(lock.unset, true);
  assert.equal(lock.roadUser, "everyone");
  assert.equal(lock.windowKey, "36m");
  assert.equal(lock.lens, "injury");
  assert.equal(lock.grain, "intersection_node");
  const result = runPlannerJob("I don't know where to start", {}, ctx);
  assert.equal(result.ok, true);
  assert.equal(result.job, "coach");
  assert.ok(result.toolNames.includes("setRoadUser"));
  assert.ok(result.toolNames.includes("setWindow"));
  assert.ok(result.toolNames.includes("setLens"));
  assert.ok(result.toolNames.includes("setMode"));
  assert.match(result.coachCopy, /Lock was unset/);
  assert.match(result.coachCopy, /Everyone \/ 36m \/ Hurt \/ intersections/);
  assert.equal(result.tools.find((call) => call.tool === "setRoadUser")?.args.roadUser, "everyone");
  assert.equal(result.tools.find((call) => call.tool === "setWindow")?.args.windowKey, "36m");
  assert.equal(result.tools.find((call) => call.tool === "setLens")?.args.lens, "injury");
  assert.equal(result.tools.find((call) => call.tool === "setMode")?.args.mode, "intersection_node");
});

test("G-COACH-START selects city #1 Buffalo 26912 and opens Why", () => {
  const result = runPlannerJob("I don't know where to start", session, ctx);
  assert.equal(result.ok, true);
  assert.equal(result.job, "coach");
  assert.ok(!result.toolNames.includes("setRoadUser"));
  assert.deepEqual(result.toolNames, ["startCoachJob", "selectPlace", "openInspect", "composeWhyPlace"]);
  assert.equal(result.tools[1].args.placeId, "intersection_node:26912");
  assert.equal(result.tools[2].args.tab, "why");
  assert.match(result.why.statement, /66/);
  assert.match(result.coachCopy, /Everyone \/ 36m \/ Hurt \/ intersections/);
  assert.match(result.coachCopy, /list order/i);
  assert.doesNotMatch(result.coachCopy, /most-dangerous intersection|official priority/i);
  assert.equal(result.nextScreen, "Inspect Why");
  assert.match(result.stepCopy, /Next screen: Inspect Why/);
  assert.match(result.trace, /Next: Inspect Why/);
  assert.doesNotMatch(JSON.stringify(result), /\bLLM\b|openai|anthropic/i);
});

test("G-COACH-QB selects Queens #1 and Brooklyn #1 and opens Compare", () => {
  const result = runPlannerJob(QB, session, ctx);
  assert.equal(result.ok, true);
  assert.equal(result.job, "coach");
  const tops = result.tools.filter((call) => call.tool === "selectTopInBorough");
  assert.equal(tops.length, 2);
  assert.equal(tops[0].args.borough, "Queens");
  assert.equal(tops[0].args.placeId, "intersection_node:41385");
  assert.equal(tops[1].args.borough, "Brooklyn");
  assert.equal(tops[1].args.placeId, "intersection_node:26912");
  assert.equal(result.tools.find((call) => call.tool === "selectPlace")?.args.placeId, "intersection_node:41385");
  const compare = result.tools.find((call) => call.tool === "openCompare");
  assert.deepEqual(compare.args.compareIds, ["intersection_node:41385", "intersection_node:26912"]);
  assert.ok(result.coachCopy.includes(LIST_ORDER_NOT_DANGEROUS));
  assert.match(result.coachCopy, /not most-dangerous/);
  assert.equal(result.nextScreen, "Compare");
  assert.doesNotMatch(JSON.stringify(result.tools), /intersection_node:99999999/);
});

test("charter Queens top collisions phrasing also opens Compare", () => {
  const result = runPlannerJob("Compare Queens’ top collisions with Brooklyn’s and show both.", session, ctx);
  assert.equal(result.ok, true);
  assert.ok(result.toolNames.includes("openCompare"));
});

test("start under Walking lock uses that list #1, not Buffalo Everyone 66", () => {
  const walkingPlaces = [
    { ...rankedPlaces[1], count: 21, injuryCount: 21 },
    { ...rankedPlaces[0], count: 8, injuryCount: 8 },
    { ...rankedPlaces[2], count: 4, injuryCount: 4 },
  ];
  const result = runPlannerJob("I don't know where to start", {
    ...session,
    roadUser: "pedestrian",
  }, { rankedPlaces: walkingPlaces, allowedPlaceIds: walkingPlaces.map((place) => place.id) });
  assert.equal(result.ok, true);
  assert.equal(result.tools.find((call) => call.tool === "selectPlace")?.args.placeId, "intersection_node:26863");
  assert.match(result.coachCopy, /Walking \/ 36m \/ Hurt \/ intersections/);
  assert.match(result.why.statement, /21/);
  assert.doesNotMatch(result.why.statement, /\b66\b/);
});

test("existing Why / walk / refuse still pass through job coach", () => {
  const why = runPlannerJob("Why is Buffalo Ave & Eastern Pkwy showing up?", session, {
    ...ctx,
    universe: [{
      id: "intersection_node:26912",
      placeType: "intersection_node",
      placeId: 26912,
      title: "Buffalo Ave & Eastern Pkwy",
      streetNames: ["Buffalo Ave", "Eastern Pkwy"],
      displayName: "Buffalo Ave & Eastern Pkwy",
    }],
    injuryCount: 66,
    fatalCount: 0,
  });
  assert.equal(why.ok, true);
  assert.deepEqual(why.toolNames, ["selectPlace", "openInspect", "composeWhyPlace"]);
  assert.equal(why.nextScreen, "Inspect Why");
  const walk = runPlannerJob("Walk me through this place", { ...session, selectedId: "intersection_node:26912" }, ctx);
  assert.equal(walk.ok, true);
  assert.ok(walk.toolNames.includes("walkThroughPlace"));
  const prep = runPlannerJob("Prepare this for the meeting", { ...session, selectedId: "intersection_node:26912" }, ctx);
  assert.equal(prep.nextScreen, "Packet");
});

test("must-refuse treatment risk cause KSI 5-year still mutate nothing", () => {
  const cases = [
    ["What should DOT install here?", "treatment"],
    ["Is this the most dangerous intersection for a pedestrian?", "risk"],
    ["Left turns caused these crashes.", "cause"],
    ["Show me KSI.", "ksi"],
    ["Pedestrian fatalities on Flatbush last 5 years vs the borough.", "gated"],
  ];
  for (const [prompt, code] of cases) {
    const result = runPlannerJob(prompt, { ...session, selectedId: "intersection_node:26912" }, ctx);
    assert.equal(result.ok, false, prompt);
    assert.deepEqual(result.tools, [], prompt);
    assert.equal(result.prohibition, code, prompt);
  }
});

test("coach without a ranked list fails closed", () => {
  const result = runPlannerJob("I don't know where to start", session, { allowedPlaceIds });
  assert.equal(result.ok, false);
  assert.deepEqual(result.tools, []);
});

test("frozen Everyone/36m Hurt gold: Buffalo #1 66, Utica 43, Queens #1 41385", async () => {
  const appRoot = new URL("../", import.meta.url);
  const [appBytes, labelBytes] = await Promise.all([
    readFile(new URL("public/data/app-data.json.gz", appRoot)),
    readFile(new URL("public/data/place-labels.json.gz", appRoot)),
  ]);
  const appData = JSON.parse(gunzipSync(appBytes).toString("utf8"));
  const labels = JSON.parse(gunzipSync(labelBytes).toString("utf8"));
  const buffalo = appData.places.find((place) => place.id === "intersection_node:26912");
  const utica = appData.places.find((place) => place.id === "intersection_node:26863");
  assert.equal(buffalo.injuryRank, 1);
  assert.equal(buffalo.injuryCount, 66);
  assert.equal(buffalo.fatalCount, 0);
  assert.equal(utica.injuryCount, 43);
  assert.equal(labels.labels["intersection_node:26912"].title, "Buffalo Ave & Eastern Pkwy");
  assert.equal(labels.labels["intersection_node:26863"].title, "Eastern Pkwy & Utica Ave");
  const frozenRanked = appData.places
    .filter((place) => place.placeType === "intersection_node")
    .map((place) => ({
      id: place.id,
      placeType: place.placeType,
      placeId: place.placeId,
      longitude: place.longitude,
      latitude: place.latitude,
      injuryRank: place.injuryRank,
      fatalRank: place.fatalRank,
      injuryCount: place.injuryCount,
      fatalCount: place.fatalCount,
      count: place.injuryCount,
    }));
  const frozenCtx = {
    rankedPlaces: frozenRanked,
    allowedPlaceIds: frozenRanked.map((place) => place.id),
  };
  const start = runPlannerJob("I don't know where to start", session, frozenCtx);
  assert.equal(start.tools.find((call) => call.tool === "selectPlace")?.args.placeId, "intersection_node:26912");
  assert.match(start.why.statement, /66/);
  const compare = runPlannerJob(QB, session, frozenCtx);
  const tops = compare.tools.filter((call) => call.tool === "selectTopInBorough");
  assert.equal(tops[0].args.placeId, "intersection_node:41385");
  assert.equal(labels.labels["intersection_node:41385"].title, "Jackson Ave & Queens Blvd");
  assert.equal(tops[1].args.placeId, "intersection_node:26912");
});

test("job coach does not mutate product gz or recrop NYC_BOUNDS", async () => {
  const appRoot = new URL("../", import.meta.url);
  for (const [file, expected] of Object.entries(GOLD_HASHES)) {
    const bytes = await readFile(new URL(`public/data/${file}`, appRoot));
    const digest = createHash("sha256").update(bytes).digest("hex");
    assert.equal(digest, expected, file);
  }
  const page = await readFile(new URL("app/page.tsx", appRoot), "utf8");
  assert.match(page, /NYC_BOUNDS: \[\[number, number\], \[number, number\]\] = \[\[-74\.26, 40\.49\], \[-73\.70, 40\.92\]\]/);
});
