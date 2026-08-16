import assert from "node:assert/strict";
import test from "node:test";

import {
  DATE_VS_WINDOW_PROHIBITION,
  FIELD_REQUEST_ITEMS,
  classifyCrashesVsDocumentedDate,
  dateVsWindowRow,
  lockOnChipModel,
  resolvePacketSubject,
} from "../lib/packet-carry.mjs";

test("Packet subject stays Compare A / investigated place after last click on B", () => {
  assert.equal(resolvePacketSubject({
    packetSubjectId: "intersection_node:26912",
    compareIds: ["intersection_node:26912", "intersection_node:21791"],
    selectedId: "intersection_node:21791",
  }), "intersection_node:26912");
  assert.equal(resolvePacketSubject({
    compareIds: ["intersection_node:26912", "intersection_node:21791"],
    selectedId: "intersection_node:21791",
  }), "intersection_node:26912");
  assert.equal(resolvePacketSubject({ selectedId: "intersection_node:26912" }), "intersection_node:26912");
});

test("date-vs-window copy is history + membership, not failed or untreated", () => {
  const afterDates = Array.from({ length: 66 }, () => "2023-06-24");
  const classified = classifyCrashesVsDocumentedDate(afterDates, "2023-03-01");
  assert.equal(classified.membership, "after");
  assert.equal(classified.after, 66);
  assert.equal(classified.before, 0);
  const row = dateVsWindowRow({
    humanLabel: "Accessible Pedestrian Signals",
    publishedDateValues: "2023-03-01",
    dateMeaning: "date_insta",
  }, afterDates);
  assert.equal(row.documentedDate, "2023-03-01");
  assert.equal(row.membership, "after");
  assert.equal(row.after, 66);
  assert.match(row.statement, /documented_history/);
  assert.match(row.statement, /window membership/);
  assert.doesNotMatch(row.statement, /\bfailed\b|untreated|DOT did nothing/i);
  assert.match(row.prohibition, /Not effectiveness/i);
  assert.equal(row.prohibition, DATE_VS_WINDOW_PROHIBITION);
  assert.ok(FIELD_REQUEST_ITEMS.some((item) => /volumes/i.test(item)));
  assert.ok(FIELD_REQUEST_ITEMS.some((item) => /Sight distance/i.test(item)));
  assert.doesNotMatch(FIELD_REQUEST_ITEMS.join(" "), /install an LPI|SIP/i);
});

test("lock-on counts follow the active roadUser, not Everyone leftover", () => {
  const everyone = lockOnChipModel({ injuryCount: 66, fatalCount: 0, roadUser: "everyone", windowKey: "36m", lens: "injury" });
  const walking = lockOnChipModel({ injuryCount: 8, fatalCount: 0, roadUser: "pedestrian", windowKey: "36m", lens: "injury" });
  assert.equal(everyone.injuryCount, 66);
  assert.equal(walking.injuryCount, 8);
  assert.equal(walking.roadUser, "pedestrian");
  assert.notEqual(walking.injuryCount, everyone.injuryCount);
});
