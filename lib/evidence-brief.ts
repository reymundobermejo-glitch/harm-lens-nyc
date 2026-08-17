import { dateVsWindowRow, FIELD_REQUEST_ITEMS as FIELD_REQUEST_FROM_CARRY } from "./packet-carry.mjs";
import { coverageFootnotesBlock } from "./p6-coverage-footnotes.mjs";

export { classifyCrashesVsDocumentedDate, isoDatePrefix, lockOnChipModel, resolvePacketSubject } from "./packet-carry.mjs";
export const FIELD_REQUEST_ITEMS = FIELD_REQUEST_FROM_CARRY;

export type BriefClaimClass =
  | "source_fact"
  | "assignment"
  | "calculation"
  | "documented_history"
  | "current_context"
  | "unknown"
  | "unsupported";

export type BriefSituateRecord = {
  family: string;
  humanLabel: string;
  statement: string;
  claimClass: string;
  publisher: string;
  sourceDatasetId: string;
  sourceDatasetName: string;
  sourceRecordId: string;
  sourceSnapshotId: string | null;
  sourceSnapshotSha256: string | null;
  matchVersion: string;
  matchClass: string;
  relationshipStatus: string;
  approachKey: string | null;
  segmentId: number | null;
  nodeId: number | null;
  publishedDateValues: string | string[] | null;
  dateMeaning: string | null;
};

export type BriefSituate = {
  documentedStreetChanges: BriefSituateRecord[];
  unknownEvidence: BriefSituateRecord[];
  permanentGaps: { domain: string; status: string; statement: string }[];
  approaches: {
    approachKey: string;
    segmentId: number;
    networkAndRules: BriefSituateRecord[];
    unknown: BriefSituateRecord[];
  }[];
};

export type EvidenceBrief = {
  briefVersion: "HL-EVIDENCE-BRIEF-DRAFT-v1";
  releaseStatus: "DRAFT";
  generatedAtUtc: string;
  place: {
    id: string;
    title: string;
    lionLabel: string;
    grain: "Intersection" | "Midblock segment";
    assignmentClass: string;
    geographyVersion: string;
  };
  methodLock: {
    harmLens: "Injury-involved" | "Fatal";
    roadUser: string;
    windowId: string;
    analysisStart: string;
    analysisEnd: string;
    assignmentVersion: string;
    predicateRegistry: string;
    objectVersion: string;
  };
  whyThisPlaceSurfaced: {
    claimClass: "calculation";
    statement: string;
    supports: string;
    doesNotSupport: string;
  };
  evidence: {
    claimClass: "calculation";
    equalityStatus: "PASS" | "FAIL";
    counts: { label: string; crashRecordCount: number; supportingCollisionIds: number[] }[];
    humanToll?: { label: string; peopleRecordedTotal: number; frequencyRemainsDefault: true; disclosure: string };
    persistence?: { version: string; statement: string; claimLimit: string };
    corridor?: { corridorId: string; label: string; crashRecordCount: number; supportingCollisionIds: number[]; claimLimit: string };
    windowCounts?: { windowId: string; crashRecordCount: number }[];
  };
  knownStreetContext: {
    status: "documented_and_unknown" | "documented" | "unknown";
    documentedYes: (BriefSituateRecord & { claimClassPreserved: string })[];
    publishedAtThisPlace: (BriefSituateRecord & { claimClassPreserved: string })[];
    checkedNoMatchingRecord: { family: string; statement: string; claimClass: "unknown"; approachKey?: string | null; segmentId?: number | null }[];
    notInPublicInventory: { family: string; statement: string; claimClass: "unknown" }[];
    unknown: { family: string; statement: string; claimClass: "unknown"; approachKey?: string | null; segmentId?: number | null }[];
  };
  documentedDateVsWindow: {
    claimClass: "documented_history";
    calculationClass: "calculation";
    rows: DocumentedDateVsWindowRow[];
  };
  dataCurrency: {
    claimClass: "source_fact";
    statement: string;
    sourceStatus: string;
    throughDate: string;
    coverageFootnotes: {
      claimClass: "source_fact";
      freezeVersion: string;
      probeUtc: string;
      heading: string;
      items: { id: string; statement: string; cannotSupport: string }[];
    };
  };
  limitations: { claimClass: "unsupported"; statements: string[] };
  recommendedNextAction: { claimClass: "unknown"; statement: string; investigate: string[] };
};

export type DocumentedDateVsWindowRow = {
  humanLabel: string;
  documentedDate: string;
  dateMeaning: string | null;
  before: number;
  after: number;
  on: number;
  unknown: number;
  total: number;
  membership: "before" | "after" | "across" | "unknown";
  statement: string;
  prohibition: string;
  claimClass: "documented_history";
  calculationClass: "calculation";
};

type ComposeArgs = {
  generatedAtUtc?: string;
  place: {
    id: string;
    title: string;
    lionLabel: string;
    placeType: "intersection_node" | "midblock_segment";
    assignmentClass: string;
    injuryCount: number;
    fatalCount: number;
    injurySupportingIds: number[];
    fatalSupportingIds: number[];
    equalityPass: boolean;
    toll?: { label: string; peopleRecordedTotal: number; disclosure: string };
    persistence?: { version: string; statement: string };
    corridor?: { corridorId: string; label: string; crashRecordCount: number; supportingCollisionIds: number[] };
    windowCounts?: { windowId: string; crashRecordCount: number }[];
  };
  supportingCrashDates?: string[];
  lens: "injury" | "fatal";
  method: {
    windowId: string;
    roadUser: string;
    analysisStart: string;
    analysisEnd: string;
    sourceStatus: string;
    assignmentVersion: string;
    predicateRegistry: string;
    objectVersion: string;
    geographyVersion: string;
  };
  situate: BriefSituate;
};

const LIMITATIONS = [
  "Recorded harm concentration is not the same as individual risk without exposure data such as volumes, VMT, or trips.",
  "These counts describe police-reported collision records, not people.",
  "The evidence does not establish cause.",
  "The evidence does not establish official priority.",
  "The evidence does not prescribe a treatment or establish treatment effectiveness.",
  "An unmatched source relationship does not mean untreated, no action, or no street feature.",
];

function recordKey(record: BriefSituateRecord) {
  return [record.family, record.sourceRecordId, record.approachKey ?? "", record.segmentId ?? "", record.matchClass].join("|");
}

function uniqueRecords(records: BriefSituateRecord[]) {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = recordKey(record);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueUnknowns(items: EvidenceBrief["knownStreetContext"]["unknown"]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.family}|${item.statement}|${item.approachKey ?? ""}|${item.segmentId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function documentedDateVsWindowRows(
  documentedYes: EvidenceBrief["knownStreetContext"]["documentedYes"],
  supportingCrashDates: readonly string[],
): DocumentedDateVsWindowRow[] {
  return documentedYes
    .map((record) => dateVsWindowRow(record, supportingCrashDates))
    .filter((row): row is DocumentedDateVsWindowRow => Boolean(row));
}

export function composeEvidenceBrief(args: ComposeArgs): EvidenceBrief {
  const activeCount = args.lens === "injury" ? args.place.injuryCount : args.place.fatalCount;
  const lensLabel = args.lens === "injury" ? "Injury-involved" : "Fatal";
  const grain = args.place.placeType === "intersection_node" ? "Intersection" : "Midblock segment";
  const documented = uniqueRecords([
    ...args.situate.documentedStreetChanges,
    ...args.situate.approaches.flatMap((approach) => approach.networkAndRules.filter((record) => (
      record.family !== "speed_limits" || (record as BriefSituateRecord & { speedClaimEligible?: boolean }).speedClaimEligible === true
    ))),
  ]).map((record) => ({ ...record, claimClassPreserved: record.claimClass }));
  const checkedNoMatchingRecord = uniqueUnknowns([
    ...args.situate.unknownEvidence.map((record) => ({
      family: record.family,
      statement: record.statement,
      claimClass: "unknown" as const,
      approachKey: record.approachKey,
      segmentId: record.segmentId,
    })),
    ...args.situate.approaches.flatMap((approach) => approach.unknown.map((record) => ({
      family: record.family,
      statement: record.statement,
      claimClass: "unknown" as const,
      approachKey: approach.approachKey,
      segmentId: approach.segmentId,
    }))),
  ]);
  const notInPublicInventory = args.situate.permanentGaps.map((gap) => ({
    family: gap.domain,
    statement: gap.statement,
    claimClass: "unknown" as const,
  }));
  const unknown = uniqueUnknowns([
    ...checkedNoMatchingRecord,
    ...notInPublicInventory,
  ]);
  const dateVsWindow = documentedDateVsWindowRows(documented, args.supportingCrashDates ?? []);

  return {
    briefVersion: "HL-EVIDENCE-BRIEF-DRAFT-v1",
    releaseStatus: "DRAFT",
    generatedAtUtc: args.generatedAtUtc ?? new Date().toISOString(),
    place: {
      id: args.place.id,
      title: args.place.title,
      lionLabel: args.place.lionLabel,
      grain,
      assignmentClass: args.place.assignmentClass,
      geographyVersion: args.method.geographyVersion,
    },
    methodLock: {
      harmLens: lensLabel,
      roadUser: args.method.roadUser,
      windowId: args.method.windowId,
      analysisStart: args.method.analysisStart,
      analysisEnd: args.method.analysisEnd,
      assignmentVersion: args.method.assignmentVersion,
      predicateRegistry: args.method.predicateRegistry,
      objectVersion: args.method.objectVersion,
    },
    whyThisPlaceSurfaced: {
      claimClass: "calculation",
      statement: `This ${grain.toLowerCase()} surfaced in the analytical order because it has ${activeCount} qualifying police-reported collision record${activeCount === 1 ? "" : "s"} under the active ${lensLabel.toLowerCase()} lens, ${args.method.roadUser} predicate, and ${args.method.windowId} period.`,
      supports: "Moving this place into a closer-look queue for field and engineering investigation under this analytical method.",
      doesNotSupport: "Cause, exposure-adjusted or personal risk, official priority, an engineering treatment, or untreated status from an unmatched source record.",
    },
    evidence: {
      claimClass: "calculation",
      equalityStatus: args.place.equalityPass ? "PASS" : "FAIL",
      counts: [
        { label: "Injury-involved crash records", crashRecordCount: args.place.injuryCount, supportingCollisionIds: [...args.place.injurySupportingIds] },
        { label: "Fatal crash records", crashRecordCount: args.place.fatalCount, supportingCollisionIds: [...args.place.fatalSupportingIds] },
      ],
      ...(args.place.toll ? { humanToll: { ...args.place.toll, frequencyRemainsDefault: true as const } } : {}),
      ...(args.place.persistence ? { persistence: { ...args.place.persistence, claimLimit: "Analytical 36m/48m sensitivity state; not stable, chronic, risk, hotspot, or official priority." } } : {}),
      ...(args.place.corridor ? { corridor: { ...args.place.corridor, claimLimit: "Analytical LION component; not an official NYC DOT corridor program layer." } } : {}),
      ...(args.place.windowCounts?.length ? { windowCounts: args.place.windowCounts.map((row) => ({ ...row })) } : {}),
    },
    knownStreetContext: {
      status: documented.length && unknown.length ? "documented_and_unknown" : documented.length ? "documented" : "unknown",
      documentedYes: documented,
      publishedAtThisPlace: documented,
      checkedNoMatchingRecord,
      notInPublicInventory,
      unknown: unknown.length ? unknown : [{ family: "governed_sources", statement: "No additional unknown relationship row was recorded in the loaded frozen Situate projection.", claimClass: "unknown" }],
    },
    documentedDateVsWindow: {
      claimClass: "documented_history",
      calculationClass: "calculation",
      rows: dateVsWindow,
    },
    dataCurrency: {
      claimClass: "source_fact",
      statement: `Collision records through ${args.method.analysisEnd}; source status: ${args.method.sourceStatus}. Recent periods may backfill or revise.`,
      sourceStatus: args.method.sourceStatus,
      throughDate: args.method.analysisEnd,
      coverageFootnotes: coverageFootnotesBlock(),
    },
    limitations: { claimClass: "unsupported", statements: [...LIMITATIONS] },
    recommendedNextAction: {
      claimClass: "unknown",
      statement: "Field and engineering investigation is warranted before drawing operational conclusions. This is an investigation step, not a treatment recommendation.",
      investigate: [...FIELD_REQUEST_ITEMS],
    },
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function rows(items: string[]) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

export function evidenceBriefHtml(brief: EvidenceBrief) {
  const published = brief.knownStreetContext.publishedAtThisPlace.length
    ? brief.knownStreetContext.publishedAtThisPlace.map((item) => `<article><strong>${escapeHtml(item.humanLabel)}</strong><p>${escapeHtml(item.statement)}</p><small>Claim: ${escapeHtml(item.claimClassPreserved)} · ${escapeHtml(item.sourceDatasetName)} · record ${escapeHtml(item.sourceRecordId)} · ${escapeHtml(item.matchVersion)}</small></article>`).join("")
    : "<p>No published record for this place appears in the loaded frozen Situate projection.</p>";
  const checked = brief.knownStreetContext.checkedNoMatchingRecord.length
    ? `<h3>Checked in a named table</h3><ul>${brief.knownStreetContext.checkedNoMatchingRecord.map((item) => `<li>${escapeHtml(item.statement)} <small>(${escapeHtml(item.family)})</small></li>`).join("")}</ul>`
    : "";
  const inventory = brief.knownStreetContext.notInPublicInventory.length
    ? `<h3>Not in a public place-level inventory</h3><ul>${brief.knownStreetContext.notInPublicInventory.map((item) => `<li>${escapeHtml(item.statement)} <small>(${escapeHtml(item.family)})</small></li>`).join("")}</ul>`
    : "";
  const optionalEvidence = [
    brief.evidence.humanToll ? `<article><strong>${escapeHtml(brief.evidence.humanToll.peopleRecordedTotal)} ${escapeHtml(brief.evidence.humanToll.label)}</strong><p>Shown beside crash frequency, never instead of it. ${escapeHtml(brief.evidence.humanToll.disclosure)}</p></article>` : "",
    brief.evidence.persistence ? `<article><strong>Persistence sensitivity</strong><p>${escapeHtml(brief.evidence.persistence.statement)}</p><small>${escapeHtml(brief.evidence.persistence.claimLimit)}</small></article>` : "",
    brief.evidence.corridor ? `<article><strong>${escapeHtml(brief.evidence.corridor.corridorId)}</strong><p>${escapeHtml(brief.evidence.corridor.label)} · ${brief.evidence.corridor.crashRecordCount} unique supporting crash records; ${brief.evidence.corridor.supportingCollisionIds.length} exact IDs.</p><small>${escapeHtml(brief.evidence.corridor.claimLimit)}</small></article>` : "",
    brief.evidence.windowCounts?.length ? `<article><strong>Released window counts</strong><p>${brief.evidence.windowCounts.map((row) => `${escapeHtml(row.windowId)}: ${row.crashRecordCount}`).join(" · ")} under the same Who and harm lens. Disclosure only; not a new rank.</p></article>` : "",
  ].join("");
  const dateVsWindow = brief.documentedDateVsWindow.rows.length
    ? brief.documentedDateVsWindow.rows.map((row) => `<article><strong>${escapeHtml(row.humanLabel)} · ${escapeHtml(row.documentedDate)}</strong><p>${escapeHtml(row.statement)}</p><small>Claim: documented_history + calculation · membership ${escapeHtml(row.membership)} · ${escapeHtml(row.prohibition)}</small></article>`).join("")
    : "<p>No published record date is bound to this supporting crash set.</p>";
  const coverage = brief.dataCurrency.coverageFootnotes;
  const coverageHtml = `<h3>${escapeHtml(coverage.heading)}</h3><ul>${coverage.items.map((item) => `<li><p>${escapeHtml(item.statement)}</p><small>${escapeHtml(item.cannotSupport)}</small></li>`).join("")}</ul><p class="meta">${escapeHtml(coverage.freezeVersion)} · probe ${escapeHtml(coverage.probeUtc)}</p>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>DRAFT Evidence Brief — ${escapeHtml(brief.place.title)}</title><style>body{font:15px/1.5 system-ui,sans-serif;color:#17211f;max-width:850px;margin:36px auto;padding:0 24px}header{border-bottom:3px solid #17211f;padding-bottom:18px}.draft{display:inline-block;background:#f2c94c;padding:5px 9px;font-weight:800;letter-spacing:.12em}h1{margin:.4rem 0}.meta{color:#52605d}section{margin:28px 0}h2{font-size:18px;border-bottom:1px solid #ccd5d2;padding-bottom:6px}article{border-left:3px solid #79918a;padding:4px 12px;margin:12px 0}small{color:#596763}.counts{display:flex;gap:14px}.count{border:1px solid #bdc9c5;padding:12px 16px;min-width:180px}.count b{display:block;font-size:28px}.limit{background:#f1f4f3;padding:14px}.next{border:2px solid #4d6a62;padding:14px}@media print{body{margin:0}.no-print{display:none}}</style></head><body><header><span class="draft">DRAFT</span><h1>Evidence Brief</h1><h2>${escapeHtml(brief.place.title)}</h2><p class="meta">${escapeHtml(brief.place.id)} · ${escapeHtml(brief.place.lionLabel)} · ${escapeHtml(brief.place.grain)} · ${escapeHtml(brief.methodLock.harmLens)} lens · ${escapeHtml(brief.methodLock.roadUser)}<br>${escapeHtml(brief.methodLock.analysisStart)}–${escapeHtml(brief.methodLock.analysisEnd)} · ${escapeHtml(brief.place.geographyVersion)}</p></header><section><h2>1. Why this place surfaced <small>[calculation]</small></h2><p>${escapeHtml(brief.whyThisPlaceSurfaced.statement)}</p><p><strong>Supports:</strong> ${escapeHtml(brief.whyThisPlaceSurfaced.supports)}</p><p><strong>Does not support:</strong> ${escapeHtml(brief.whyThisPlaceSurfaced.doesNotSupport)}</p></section><section><h2>2. Evidence <small>[calculation]</small></h2><div class="counts">${brief.evidence.counts.map((item) => `<div class="count"><b>${item.crashRecordCount}</b>${escapeHtml(item.label)}<small>Equality ${brief.evidence.equalityStatus}; ${item.supportingCollisionIds.length} supporting IDs</small></div>`).join("")}</div>${optionalEvidence}</section><section><h2>3. Street records at this place</h2><p>Published frozen rows — not Yes, No, or Plan.</p>${published}${checked}${inventory}</section><section><h2>4. Documented date vs window <small>[documented_history + calculation]</small></h2>${dateVsWindow}</section><section><h2>5. Data currency <small>[source fact]</small></h2><p>${escapeHtml(brief.dataCurrency.statement)}</p>${coverageHtml}</section><section class="limit"><h2>6. Limitations <small>[unsupported]</small></h2><ul>${rows(brief.limitations.statements)}</ul></section><section class="next"><h2>7. Recommended next action <small>[unknown / investigation]</small></h2><p>${escapeHtml(brief.recommendedNextAction.statement)}</p><ul>${rows(brief.recommendedNextAction.investigate)}</ul></section><footer><p><strong>${brief.releaseStatus}</strong> · ${escapeHtml(brief.briefVersion)} · generated ${escapeHtml(brief.generatedAtUtc)}</p><p class="meta">Method: ${escapeHtml(brief.methodLock.windowId)} · ${escapeHtml(brief.methodLock.roadUser)} · ${escapeHtml(brief.methodLock.assignmentVersion)} · ${escapeHtml(brief.methodLock.predicateRegistry)} · ${escapeHtml(brief.methodLock.objectVersion)}</p></footer></body></html>`;
}
