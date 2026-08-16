import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import {
  ASK_LEGEND_STAGE,
  ASK_LEGEND_SUBTITLE,
  buildSearchUniverse,
  normalizeQuery,
  searchPlaceIds,
  searchNearMisses,
  searchPlaces,
} from "../lib/ask-legend/index.mjs";

const appRoot = new URL("../", import.meta.url);

async function loadFixturePlaces() {
  const raw = await readFile(new URL("lib/ask-legend/fixtures/places-slice.json", appRoot), "utf8");
  return JSON.parse(raw).places;
}

test("G0 doctrine constants stay claim-safe", () => {
  assert.equal(ASK_LEGEND_STAGE, "G0");
  assert.equal(ASK_LEGEND_SUBTITLE, "Searches this frozen evidence only");
  assert.doesNotMatch(ASK_LEGEND_SUBTITLE, /plan|yes\/no|risk|treatment/i);
});

test("normalizeQuery collapses cross-street separators and suffixes", () => {
  assert.equal(normalizeQuery(""), "");
  assert.equal(normalizeQuery("   "), "");
  assert.equal(normalizeQuery("Broadway & Rector Street"), "broadway & rector st");
  assert.equal(normalizeQuery("Broadway and Rector St"), "broadway & rector st");
  assert.equal(normalizeQuery("Flatbush Ave @ Livingston"), "flatbush ave & livingston");
  assert.equal(normalizeQuery("Atlantic / Surf"), "atlantic & surf");
  assert.equal(normalizeQuery("129st 101 ave in queens"), "129 st & 101 ave");
  assert.equal(normalizeQuery("101ave 129street in Staten Island"), "101 ave & 129 st");
});

test("I0 gold: NYC dialect resolves the frozen 101 Ave & 129 St node", async () => {
  const [appBytes, labelBytes] = await Promise.all([
    readFile(new URL("public/data/app-data.json.gz", appRoot)),
    readFile(new URL("public/data/place-labels.json.gz", appRoot)),
  ]);
  const appData = JSON.parse(gunzipSync(appBytes).toString("utf8"));
  const labels = JSON.parse(gunzipSync(labelBytes).toString("utf8"));
  const universe = buildSearchUniverse(appData.places, labels);
  for (const query of ["101 Ave & 129 St", "129 st & 101 ave", "129st 101 ave in queens"]) {
    const hits = searchPlaces(query, universe);
    assert.equal(hits[0]?.id, "intersection_node:34754", query);
  }
  const eastern = searchPlaces("eastern pkwy", universe);
  const easternTitles = eastern.map((hit) => universe.find((place) => place.id === hit.id)?.title ?? "");
  assert.ok(eastern.some((hit) => hit.id === "intersection_node:26912"));
  assert.ok(easternTitles.every((title) => /eastern/i.test(title)));
  assert.ok(!easternTitles.some((title) => /henry hudson|mosholu/i.test(title)));
  assert.deepEqual(searchPlaces("", universe), []);
  assert.deepEqual(searchPlaces("unknown invented road & nowhere ave", universe), []);
  const near = searchNearMisses("101 Drive & 129 St", universe);
  assert.ok(near.some((hit) => hit.id === "intersection_node:34754"));
  assert.deepEqual(searchNearMisses("xyzzy quux", universe), []);
});

test("gold: empty and whitespace fail closed to empty", async () => {
  const places = await loadFixturePlaces();
  assert.deepEqual(searchPlaces("", places), []);
  assert.deepEqual(searchPlaces("  \t  ", places), []);
  assert.deepEqual(searchPlaces("broadway", []), []);
});

test("gold: exact place id", async () => {
  const places = await loadFixturePlaces();
  const hits = searchPlaces("intersection_node:15193", places);
  assert.equal(hits[0]?.id, "intersection_node:15193");
  assert.equal(hits[0]?.reason, "exact place id");
  assert.ok(hits[0].score >= 100);
});

test("gold: bare LION node id", async () => {
  const places = await loadFixturePlaces();
  const hits = searchPlaces("15193", places);
  assert.equal(hits[0]?.id, "intersection_node:15193");
  assert.match(hits[0].reason, /LION id/i);
});

test("gold: LION node phrase", async () => {
  const places = await loadFixturePlaces();
  const hits = searchPlaces("LION node 15193", places);
  assert.equal(hits[0]?.id, "intersection_node:15193");
  assert.match(hits[0].reason, /LION node id/i);
});

test("gold: cross-street Broadway & Rector", async () => {
  const places = await loadFixturePlaces();
  const hits = searchPlaces("broadway & rector", places);
  assert.ok(hits.some((h) => h.id === "intersection_node:15193"));
  assert.equal(hits[0].id, "intersection_node:15193");
  assert.match(hits[0].reason, /cross-street/i);
});

test("gold: cross-street with Avenue/Street synonyms", async () => {
  const places = await loadFixturePlaces();
  const hits = searchPlaces("Flatbush Avenue and Livingston Street", places);
  assert.ok(hits.some((h) => h.id === "intersection_node:15092"));
});

test("gold: partial street Piave ranks fixture cross-streets", async () => {
  const places = await loadFixturePlaces();
  const ids = searchPlaceIds("piave", places);
  assert.ok(ids.includes("intersection_node:10001"));
  assert.ok(ids.includes("intersection_node:10002"));
  assert.ok(!ids.includes("intersection_node:15193"));
});

test("gold: midblock segment id and street", async () => {
  const places = await loadFixturePlaces();
  const byId = searchPlaces("midblock_segment:100008", places);
  assert.equal(byId[0]?.id, "midblock_segment:100008");

  const byLion = searchPlaces("segment 100008", places);
  assert.equal(byLion[0]?.id, "midblock_segment:100008");

  const byStreet = searchPlaces("208 street", places);
  assert.ok(byStreet.some((h) => h.id === "midblock_segment:100008"));
});

test("gold: invented place name yields no matches", async () => {
  const places = await loadFixturePlaces();
  const hits = searchPlaces("xyzzy nonexistent plaza & quux boulevard", places);
  assert.deepEqual(hits, []);
});

test("gold: never invents ids outside the frozen universe", async () => {
  const places = await loadFixturePlaces();
  const allowed = new Set(places.map((p) => p.id));
  const queries = [
    "broadway",
    "atlantic & surf",
    "hudson",
    "10001",
    "node 10002",
    "treadwell",
  ];
  for (const q of queries) {
    for (const hit of searchPlaces(q, places)) {
      assert.ok(allowed.has(hit.id), `invented id ${hit.id} for query ${q}`);
    }
  }
});

test("gold: cross-street shape requires both sides", async () => {
  const places = await loadFixturePlaces();
  // One real street + one invented side must not soft-match the real street alone
  const hits = searchPlaces("broadway & xyzzyquux", places);
  assert.deepEqual(hits, []);
});

test("buildSearchUniverse only keeps caller place ids", () => {
  const places = [
    { id: "intersection_node:1", placeType: "intersection_node", placeId: 1, street: null, displayName: null },
  ];
  const labelIndex = {
    labels: {
      "intersection_node:1": { title: "A & B", streetNames: ["A", "B"] },
      "intersection_node:999": { title: "Should Not Appear", streetNames: ["Z"] },
    },
  };
  const universe = buildSearchUniverse(places, labelIndex);
  assert.equal(universe.length, 1);
  assert.equal(universe[0].id, "intersection_node:1");
  assert.equal(universe[0].title, "A & B");
  assert.deepEqual(
    searchPlaces("Should Not Appear", universe),
    [],
  );
});

test("read-only frozen labels: Atlantic & Surf resolves without inventing", async () => {
  const bytes = await readFile(new URL("public/data/place-labels.json.gz", appRoot));
  const index = JSON.parse(gunzipSync(bytes).toString("utf8"));
  const label = index.labels["intersection_node:12481"];
  assert.ok(label, "frozen label sample must exist");
  const universe = buildSearchUniverse(
    [
      {
        id: "intersection_node:12481",
        placeType: "intersection_node",
        placeId: 12481,
        street: null,
        displayName: null,
      },
      {
        id: "intersection_node:15193",
        placeType: "intersection_node",
        placeId: 15193,
        street: null,
        displayName: null,
      },
    ],
    index,
  );
  const hits = searchPlaces("Atlantic Ave & Surf Ave", universe);
  assert.equal(hits[0]?.id, "intersection_node:12481");
  assert.ok(hits.every((h) => h.id === "intersection_node:12481" || h.id === "intersection_node:15193"));
});
