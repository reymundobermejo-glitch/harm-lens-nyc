/**
 * P1.1 Meeting Carry helpers — Packet subject, date-vs-window membership, lock-on chip model.
 * No new metrics. Last click on Compare B must not retarget the brief.
 */

export function resolvePacketSubject(session = {}) {
  if (typeof session.packetSubjectId === "string" && session.packetSubjectId) return session.packetSubjectId;
  const compareA = Array.isArray(session.compareIds) ? session.compareIds[0] : null;
  if (typeof compareA === "string" && compareA) return compareA;
  if (typeof session.selectedId === "string" && session.selectedId) return session.selectedId;
  return null;
}

export function isoDatePrefix(value) {
  if (typeof value === "string") {
    const match = value.trim().match(/(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = isoDatePrefix(item);
      if (found) return found;
    }
  }
  return null;
}

export function classifyCrashesVsDocumentedDate(crashDates, documentedDate) {
  const dates = Array.isArray(crashDates) ? crashDates : [];
  let before = 0;
  let after = 0;
  let on = 0;
  let unknown = 0;
  for (const raw of dates) {
    const date = isoDatePrefix(raw);
    if (!date) {
      unknown += 1;
      continue;
    }
    if (date < documentedDate) before += 1;
    else if (date > documentedDate) after += 1;
    else on += 1;
  }
  const membership = before > 0 && after > 0
    ? "across"
    : after > 0 && before === 0
      ? "after"
      : before > 0 && after === 0
        ? "before"
        : "unknown";
  return { documentedDate, before, after, on, unknown, total: dates.length, membership };
}

export const DATE_VS_WINDOW_PROHIBITION = "Not effectiveness. Not “APS failed.” Not “DOT did nothing.” Not untreated.";

export const FIELD_REQUEST_ITEMS = [
  "Pedestrian, cyclist, and vehicle volumes (exposure)",
  "Turning movements",
  "Signal operations and timing",
  "Sight distance",
  "Field conditions and geometry",
  "Post-treatment window — whether enough time has passed to evaluate a documented change",
];

export function dateVsWindowRow(record, crashDates) {
  const documentedDate = isoDatePrefix(record?.publishedDateValues);
  if (!documentedDate) return null;
  const classified = classifyCrashesVsDocumentedDate(crashDates, documentedDate);
  const membershipWord = classified.membership === "unknown" ? "not established versus" : classified.membership;
  const humanLabel = record.humanLabel ?? "Published record";
  return {
    ...classified,
    humanLabel,
    dateMeaning: record.dateMeaning ?? null,
    claimClass: "documented_history",
    calculationClass: "calculation",
    prohibition: DATE_VS_WINDOW_PROHIBITION,
    statement: `${humanLabel} has a published date of ${documentedDate}${record.dateMeaning ? ` (${record.dateMeaning})` : ""}. Of ${classified.total} supporting crash records with a published crash_date, ${classified.after} fall after that date, ${classified.before} before, and ${classified.on} on that date. This is documented_history plus calculation window membership (${membershipWord} the published date). It is not an effectiveness finding.`,
  };
}

export function lockOnChipModel(args = {}) {
  const injuryCount = Number(args.injuryCount) || 0;
  const fatalCount = Number(args.fatalCount) || 0;
  const lens = args.lens === "fatal" ? "fatal" : "injury";
  return {
    injuryCount,
    fatalCount,
    roadUser: args.roadUser ?? "everyone",
    windowKey: args.windowKey ?? "36m",
    lens,
    activeCount: lens === "injury" ? injuryCount : fatalCount,
  };
}
