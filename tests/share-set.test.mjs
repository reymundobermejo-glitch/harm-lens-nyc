import assert from "node:assert/strict";
import test from "node:test";

import {
  SHARE_SET_COPY,
  SHARE_SET_VERSION,
  buildSharePayload,
  encodeSharePayload,
  parseAndValidateShareHref,
  parseShareToken,
  shareHref,
  shareRefuseCopy,
  stripShareFromHref,
  validateSharePayload,
} from "../lib/share-set.mjs";

const BUFFALO = "intersection_node:26912";
const UTICA = "intersection_node:26863";
const SEARCH_GOLD = "intersection_node:34754";
const SEARCH_ONLY = "intersection_node:27195";
const C001 = "HL-CORRIDOR-L26B-v0-B3-SC338430-LGC01-C001";
const C002 = "HL-CORRIDOR-L26B-v0-B3-SC338430-LGC01-C002";

const freeze = {
  objectVersion: "HL-PHASE2-OBJECTS-v1",
  assignmentVersion: "HL-SPATIAL-26B-v2",
  analysisEnd: "2026-06-11",
  p25ObjectVersion: "HL-P2.5-OBJECT-RELEASE-v1",
  corridorVersion: "HL-CORRIDOR-LION26B-v0",
};

const universe = {
  freeze,
  places: {
    [BUFFALO]: { id: BUFFALO, placeType: "intersection_node" },
    [UTICA]: { id: UTICA, placeType: "intersection_node" },
    [SEARCH_GOLD]: { id: SEARCH_GOLD, placeType: "intersection_node" },
    [SEARCH_ONLY]: { id: SEARCH_ONLY, placeType: "intersection_node" },
    "midblock_segment:1": { id: "midblock_segment:1", placeType: "midblock_segment" },
  },
  corridorIds: new Set([C001, C002]),
  corridorPlaceIds: {
    [C001]: new Set([BUFFALO, UTICA]),
    [C002]: new Set(),
  },
};

function goldPayload(extra = {}) {
  return buildSharePayload({
    lens: "injury",
    roadUser: "everyone",
    windowKey: "36m",
    mode: "intersection_node",
    placeIds: [BUFFALO, UTICA],
    packetSubjectId: BUFFALO,
    freeze,
    ...extra,
  });
}

test("P5 share URL restores lock, saved IDs, and Packet subject Buffalo", () => {
  const payload = goldPayload();
  const href = shareHref("http://127.0.0.1:3012", payload);
  assert.match(href, /^http:\/\/127\.0\.0\.1:3012\/#hlshare=/);
  const restored = parseAndValidateShareHref(href, universe);
  assert.equal(restored.ok, true);
  assert.deepEqual(restored.payload.placeIds, [BUFFALO, UTICA]);
  assert.equal(restored.payload.packetSubjectId, BUFFALO);
  assert.equal(restored.payload.lens, "injury");
  assert.equal(restored.payload.roadUser, "everyone");
  assert.equal(restored.payload.windowKey, "36m");
  assert.equal(restored.payload.mode, "intersection_node");
  assert.equal(restored.payload.corridorId, undefined);
  assert.match(SHARE_SET_COPY, /not a priority list/);
  assert.match(SHARE_SET_COPY, /not official DOT ranking/);
});

test("P5 share is fail-closed: invented id and missing window refuse without a mixed lock", () => {
  const invented = goldPayload({ placeIds: [BUFFALO, "intersection_node:999999"] });
  const inventedResult = validateSharePayload(invented, universe);
  assert.equal(inventedResult.ok, false);
  assert.match(inventedResult.reason, /Unknown or invented place IDs/);
  assert.equal(inventedResult.payload, undefined);

  const missingWindow = { ...goldPayload(), windowKey: undefined };
  const missing = validateSharePayload(missingWindow, universe);
  assert.equal(missing.ok, false);
  assert.match(missing.reason, /required method-lock field/);

  const badFreeze = goldPayload({ freeze: { ...freeze, analysisEnd: "2024-01-01" } });
  const frozen = validateSharePayload(badFreeze, universe);
  assert.equal(frozen.ok, false);
  assert.match(frozen.reason, /Snapshot versions do not match/);

  const grain = goldPayload({ placeIds: ["midblock_segment:1"], packetSubjectId: "midblock_segment:1" });
  assert.equal(validateSharePayload(grain, universe).ok, false);

  const token = parseShareToken("%%%not-a-token%%%");
  assert.equal(token.ok, false);
  assert.equal(shareRefuseCopy("invented"), inventedResult.reason);
});

test("P5 corridor share uses exact C001 id, never Eastern Parkway, and excludes search-only 27195", () => {
  const named = validateSharePayload(goldPayload({ corridorId: "Eastern Parkway" }), universe);
  assert.equal(named.ok, false);
  assert.match(named.reason, /exact component id/);

  const searchOnly = validateSharePayload(goldPayload({
    corridorId: C001,
    placeIds: [BUFFALO, SEARCH_ONLY],
  }), universe);
  assert.equal(searchOnly.ok, false);

  const ok = validateSharePayload(goldPayload({ corridorId: C001, placeIds: [BUFFALO] }), universe);
  assert.equal(ok.ok, true);
  assert.equal(ok.payload.corridorId, C001);
  assert.ok(!ok.payload.placeIds.includes(SEARCH_ONLY));

  const otherComponent = validateSharePayload(goldPayload({ corridorId: C002, placeIds: [BUFFALO] }), universe);
  assert.equal(otherComponent.ok, false);
});

test("P5 round-trip keeps Who/window visible in the payload so Walking cannot keep Everyone 66", () => {
  const walking = goldPayload({ roadUser: "pedestrian" });
  const href = shareHref("http://127.0.0.1:3012", walking);
  const restored = parseAndValidateShareHref(href, universe);
  assert.equal(restored.payload.roadUser, "pedestrian");
  assert.notEqual(restored.payload.roadUser, "everyone");
  assert.equal(restored.payload.windowKey, "36m");
  const everyoneHref = shareHref("http://127.0.0.1:3012", goldPayload());
  assert.notEqual(href, everyoneHref);
  assert.equal(parseShareToken(encodeSharePayload(walking)).payload.version, SHARE_SET_VERSION);
  const stripped = stripShareFromHref(href);
  assert.equal(stripped, "/");
});
