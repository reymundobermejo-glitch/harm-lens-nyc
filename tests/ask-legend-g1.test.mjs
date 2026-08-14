import assert from "node:assert/strict";
import test from "node:test";

import {
  ALLOWLISTED_TOOLS,
  ASK_LEGEND_CHIP_CATALOG,
  ASK_LEGEND_CHIP_STAGES,
  ASK_LEGEND_STAGE,
  CLAIM_SAFE_SITUATE_FAMILIES,
  HOLD_SITUATE_FAMILIES,
  applyChip,
  buildSituateFilterIndexFromYesMap,
  clearFilters,
  filterSituateFamily,
  fitNyc,
  flyToPlace,
  getChip,
  invokeAllowlistedTool,
  listChips,
  parseChip,
  placeHasDocumentedYes,
  searchPlaces,
  selectPlace,
  setAgreementFilter,
  setLens,
  setMode,
} from "../lib/ask-legend/index.mjs";

test("G0 stage export and searchPlaces API remain intact", () => {
  assert.equal(ASK_LEGEND_STAGE, "G0");
  assert.deepEqual(ASK_LEGEND_CHIP_STAGES, ["G1a", "G1b"]);
  assert.deepEqual(searchPlaces("", [{ id: "a", placeType: "intersection_node", placeId: 1 }]), []);
});

test("G1a setLens accepts injury|fatal and refuses else", () => {
  assert.equal(setLens({ lens: "fatal" }).ok, true);
  assert.equal(setLens({ lens: "injury" }).args.lens, "injury");
  assert.equal(setLens({ lens: "risk" }).ok, false);
  assert.equal(setLens({ lens: "risk" }).refused, true);
});

test("G1a setMode accepts grain enums only", () => {
  assert.equal(setMode({ mode: "intersection_node" }).ok, true);
  assert.equal(setMode({ mode: "midblock_segment" }).ok, true);
  assert.equal(setMode({ mode: "corridor" }).refused, true);
});

test("G1a setAgreementFilter accepts governed states only", () => {
  assert.equal(setAgreementFilter({ agreementFilter: "fatal_led" }).ok, true);
  assert.equal(setAgreementFilter({ agreementFilter: "priority" }).refused, true);
});

test("G1a fitNyc and clearFilters return validated payloads", () => {
  assert.deepEqual(fitNyc().args, { frame: "nyc" });
  assert.equal(clearFilters().tool, "clearFilters");
  assert.equal(clearFilters().ok, true);
});

test("G1a selectPlace / flyToPlace fail closed outside frozen universe", () => {
  const allowed = new Set(["intersection_node:15193"]);
  const ok = selectPlace({ placeId: "intersection_node:15193" }, { allowedPlaceIds: allowed });
  assert.equal(ok.ok, true);
  assert.equal(ok.args.placeId, "intersection_node:15193");

  const bad = flyToPlace({ placeId: "intersection_node:999999" }, { allowedPlaceIds: allowed });
  assert.equal(bad.refused, true);
  assert.match(bad.reason, /not in frozen/);
});

test("unknown tool invoke refuses", () => {
  const result = invokeAllowlistedTool("rankPlaces", {});
  assert.equal(result.refused, true);
  assert.ok(ALLOWLISTED_TOOLS.includes("setLens"));
  assert.ok(!ALLOWLISTED_TOOLS.includes("rankPlaces"));
});

test("chip catalog is frozen data with unique ids and allowlisted tools", () => {
  const ids = ASK_LEGEND_CHIP_CATALOG.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length >= 18);
  for (const chip of ASK_LEGEND_CHIP_CATALOG) {
    assert.ok(chip.stage === "G1a" || chip.stage === "G1b");
    assert.ok(ALLOWLISTED_TOOLS.includes(chip.tool), chip.tool);
    assert.equal(typeof chip.label, "string");
    assert.equal(typeof chip.args, "object");
  }
  assert.ok(listChips("G1a").every((c) => c.stage === "G1a"));
  assert.ok(listChips("G1b").every((c) => c.stage === "G1b"));
  assert.equal(getChip("g1a-lens-fatal")?.tool, "setLens");
});

test("parseChip / applyChip: catalog chip ok; invented chip refused", () => {
  const parsed = parseChip({ id: "g1a-fit-nyc" });
  assert.equal(parsed.ok, true);
  const applied = applyChip("g1a-fit-nyc");
  assert.equal(applied.ok, true);
  assert.equal(applied.tool, "fitNyc");

  assert.equal(parseChip({ id: "g1b-yes-exclusive-ped" }).refused, true);
  assert.equal(applyChip("not-a-real-chip").refused, true);
  assert.equal(
    parseChip({ id: "g1a-lens-fatal", tool: "setMode", args: { mode: "intersection_node" } }).refused,
    true,
  );
});

test("G1b documented Yes filter returns only Yes places", () => {
  const index = buildSituateFilterIndexFromYesMap({
    "intersection_node:1": ["bike_routes", "bus_lanes"],
    "intersection_node:2": ["truck_routes"],
    "intersection_node:3": [],
  });
  const hit = filterSituateFamily({ family: "bike_routes", matchMode: "documented_yes" }, index);
  assert.equal(hit.ok, true);
  assert.deepEqual(hit.placeIds, ["intersection_node:1"]);
  assert.equal(placeHasDocumentedYes(index.places["intersection_node:3"], "bike_routes"), false);
});

test("G1b refuses HOLD families and untreated/No match modes", () => {
  const index = buildSituateFilterIndexFromYesMap({
    "intersection_node:1": ["slow_zones"],
  });
  for (const family of HOLD_SITUATE_FAMILIES) {
    const result = filterSituateFamily({ family, matchMode: "documented_yes" }, index);
    assert.equal(result.refused, true, family);
    assert.match(result.reason, /HOLD|allowlist/i);
  }
  const untreated = filterSituateFamily(
    { family: "bike_routes", matchMode: "untreated_no" },
    buildSituateFilterIndexFromYesMap({ "intersection_node:1": ["bike_routes"] }),
  );
  assert.equal(untreated.refused, true);
  assert.match(untreated.reason, /documented_yes/);
});

test("G1b refuses unknown families; Wave-2 trio is claim-safe", () => {
  assert.ok(CLAIM_SAFE_SITUATE_FAMILIES.includes("bus_lanes"));
  assert.ok(CLAIM_SAFE_SITUATE_FAMILIES.includes("parking_regulation_signs"));
  assert.ok(CLAIM_SAFE_SITUATE_FAMILIES.includes("enhanced_crossings"));
  const result = filterSituateFamily(
    { family: "exclusive_pedestrian_signal", matchMode: "documented_yes" },
    buildSituateFilterIndexFromYesMap({}),
  );
  assert.equal(result.refused, true);
});

test("G1b evidence rows: speed requires eligibility; unmatched is not Yes", () => {
  const place = {
    id: "intersection_node:9",
    streetNetworkAndRules: [
      { family: "speed_limits", claimClass: "regulatory_posted", speedClaimEligible: false },
      { family: "bike_routes", claimClass: "current_inventory" },
    ],
    familyStatus: {
      bus_lanes: { status: "unmatched" },
      enhanced_crossings: { status: "established" },
    },
  };
  assert.equal(placeHasDocumentedYes(place, "speed_limits"), false);
  assert.equal(placeHasDocumentedYes(place, "bike_routes"), true);
  assert.equal(placeHasDocumentedYes(place, "bus_lanes"), false);
  assert.equal(placeHasDocumentedYes(place, "enhanced_crossings"), true);

  const index = { places: { "intersection_node:9": place } };
  const enh = filterSituateFamily({ family: "enhanced_crossings" }, index);
  assert.deepEqual(enh.placeIds, ["intersection_node:9"]);
  const bus = filterSituateFamily({ family: "bus_lanes" }, index);
  assert.deepEqual(bus.placeIds, []);
});

test("applyChip G1b uses situate index and never invents place ids", () => {
  const allowed = ["intersection_node:1", "intersection_node:2"];
  const index = buildSituateFilterIndexFromYesMap({
    "intersection_node:1": ["oneF_lpi"],
    "intersection_node:99": ["oneF_lpi"], // outside allowed → dropped
  });
  const result = applyChip("g1b-yes-lpi", { situateIndex: index, allowedPlaceIds: allowed });
  assert.equal(result.ok, true);
  assert.deepEqual(result.placeIds, ["intersection_node:1"]);
  assert.ok(result.placeIds.every((id) => allowed.includes(id)));
});

test("no HOLD family appears in frozen chip catalog", () => {
  for (const chip of ASK_LEGEND_CHIP_CATALOG) {
    const family = chip.args?.family;
    if (typeof family === "string") {
      assert.ok(!HOLD_SITUATE_FAMILIES.includes(family), family);
      assert.ok(CLAIM_SAFE_SITUATE_FAMILIES.includes(family), family);
      assert.equal(chip.args.matchMode, "documented_yes");
    }
  }
});
