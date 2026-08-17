/**
 * Ask Legend toolkit v1.1 — closer-look jobs.
 * Imports v1 parse/run. Does not rebuild Why / 2023 / Prepare / refuse parsers.
 */

import {
  ASK_LEGEND_TASK_HONESTY,
  composeWhyPlace,
  invokeToolkitTool,
  parsePlannerJob as parsePlannerJobV1,
  readSessionBag,
  runPlannerJob as runPlannerJobV1,
} from "./toolkit.mjs";

export const ASK_LEGEND_TOOLKIT_V11 = "toolkit-v1.1";

export const WALK_THROUGH_STEPS = Object.freeze([
  { tab: "why", caption: "Counts — Hurt and Died, and which years have records." },
  { tab: "records", caption: "Crashes — the dated reports under this lock." },
  { tab: "situate", caption: "On the street — published frozen records, named-table checks, and what stays unknown." },
  { tab: "robustness", caption: "Hold up? — what this lock cannot establish." },
]);

export const MISSING_EVIDENCE_ITEMS = Object.freeze([
  "Pedestrian, cyclist, and vehicle volumes (exposure)",
  "Turning movements",
  "Signal operations and timing",
  "Sight distance",
  "Field conditions and geometry",
  "Post-treatment window — whether enough time has passed to evaluate a documented change",
]);

const INSPECT_TABS = new Set(["why", "records", "situate", "robustness", "packet"]);

function collapseJobKey(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase().replace(/[“”"']/g, "");
}

function needPlace(session) {
  if (session.selectedId) return null;
  return {
    ok: false,
    refused: true,
    tool: "parsePlannerJob",
    reason: "Choose a place on Explore first.",
    calls: [],
    job: "refuse",
  };
}

function jobOk(job, understood, calls, extra = {}) {
  return { ok: true, refused: false, job, understood, calls, ...extra };
}

/**
 * Hour buckets from published crash_time on supporting collision IDs.
 * source_fact only. Not cause. Not “dangerous at rush hour.”
 *
 * @param {readonly (number|string)[]} ids
 * @param {Record<string, { crashTime?: string | null }> | null | undefined} records
 */
export function bucketObservedHours(ids, records) {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  let unknown = 0;
  const list = Array.isArray(ids) ? ids : [];
  for (const id of list) {
    const time = records?.[String(id)]?.crashTime;
    if (typeof time !== "string" || !time.trim()) {
      unknown += 1;
      continue;
    }
    const hourText = time.split(":")[0];
    const hour = Number(hourText);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) unknown += 1;
    else hours[hour].count += 1;
  }
  return {
    claimClass: "source_fact",
    detector: "time_of_day",
    buckets: hours.filter((row) => row.count > 0),
    unknown,
    total: list.length,
    prohibition: "Observed crash_time on supporting IDs. Not cause. Not “dangerous at rush hour.”",
  };
}

export function walkThroughPlace(raw = {}, session = {}) {
  const placeId = raw?.placeId ?? session.selectedId;
  if (typeof placeId !== "string" || !placeId) {
    return { ok: false, refused: true, tool: "walkThroughPlace", reason: "Choose a place on Explore first.", calls: [] };
  }
  return {
    ok: true,
    tool: "walkThroughPlace",
    args: { placeId, steps: WALK_THROUGH_STEPS.map((step) => ({ ...step })) },
    effect: "Walk Counts → Crashes → On the street → Hold up?",
  };
}

export function challengeCase(raw = {}, session = {}) {
  const placeId = raw?.placeId ?? session.selectedId;
  if (typeof placeId !== "string" || !placeId) {
    return { ok: false, refused: true, tool: "challengeCase", reason: "Choose a place on Explore first.", calls: [] };
  }
  const why = composeWhyPlace({
    placeId,
    lens: raw.lens ?? session.lens,
    injuryCount: raw.injuryCount,
    fatalCount: raw.fatalCount,
  }, { ...session, selectedId: placeId });
  if (!why.ok) return why;
  const documented = Number(raw.documentedYesCount) > 0;
  const unknownStreet = !documented;
  const freshness = session.sourceStatus
    ? `Source status ${session.sourceStatus}; recent periods may backfill.`
    : "Freshness: recent periods may backfill.";
  return {
    ok: true,
    tool: "challengeCase",
    args: {
      placeId,
      supports: why.args.supports,
      weakens: `${why.args.concentrationNotRisk} ${freshness}${unknownStreet ? " Street context from Situate is unknown unless a documented Yes is loaded." : ""}`,
      unknowns: "Volumes, turning movements, signal operations, sight distance, and whether enough time has passed after a documented street change.",
      strongest: Number.isFinite(raw.injuryCount)
        ? `This place has ${raw.injuryCount} qualifying injury-involved crash records under the current lock. That supports a closer look, not official priority or a treatment.`
        : "Qualifying crash records under the current lock support a closer look, not official priority or a treatment.",
    },
    effect: "Four-line challenge from Why + Situate + freshness",
  };
}

export function listMissingEvidence(raw = {}, session = {}) {
  const placeId = raw?.placeId ?? session.selectedId;
  if (typeof placeId !== "string" || !placeId) {
    return { ok: false, refused: true, tool: "listMissingEvidence", reason: "Choose a place on Explore first.", calls: [] };
  }
  return {
    ok: true,
    tool: "listMissingEvidence",
    args: {
      placeId,
      claimClass: "unknown",
      items: [...MISSING_EVIDENCE_ITEMS],
      never: "Never untreated. No APS is not “they did nothing.”",
    },
    effect: "List field and data gaps, not treatments",
  };
}

export function observedHours(raw = {}, session = {}) {
  const placeId = raw?.placeId ?? session.selectedId;
  if (typeof placeId !== "string" || !placeId) {
    return { ok: false, refused: true, tool: "observedHours", reason: "Choose a place on Explore first.", calls: [] };
  }
  const hours = bucketObservedHours(raw.supportingIds ?? [], raw.crashWhenRecords);
  return {
    ok: true,
    tool: "observedHours",
    args: { placeId, ...hours },
    effect: "Bucket published crash_time on supporting IDs",
  };
}

export function invokeCloserLookTool(tool, args, ctx = {}) {
  const session = readSessionBag(ctx.session ?? {});
  switch (tool) {
    case "walkThroughPlace":
      return walkThroughPlace(args, session);
    case "challengeCase":
      return challengeCase(args, session);
    case "listMissingEvidence":
      return listMissingEvidence(args, session);
    case "observedHours":
      return observedHours(args, session);
    default:
      return invokeToolkitTool(tool, args, ctx);
  }
}

function closerLookSession(state = {}) {
  const bag = readSessionBag(state);
  const inspectTab = INSPECT_TABS.has(state.tab) ? state.tab : INSPECT_TABS.has(state.inspectTab) ? state.inspectTab : null;
  return { ...bag, inspectTab };
}

/**
 * v1.1 jobs only. Returns null so v1 can handle Why / 2023 / Prepare / refuse / unknown.
 *
 * @param {string} utterance
 * @param {object} [sessionState]
 * @param {object} [ctx]
 */
export function parseCloserLookJob(utterance, sessionState = {}, ctx = {}) {
  const key = collapseJobKey(utterance);
  if (!key) return null;
  const session = closerLookSession(sessionState);
  const placeArgs = {
    placeId: session.selectedId,
    lens: session.lens,
    injuryCount: ctx.injuryCount,
    fatalCount: ctx.fatalCount,
    documentedYesCount: ctx.documentedYesCount,
    supportingIds: ctx.supportingIds,
    crashWhenRecords: ctx.crashWhenRecords,
  };

  if (/walk me through this place/.test(key) || /^walk me through\b/.test(key)) {
    const missing = needPlace(session);
    if (missing) return missing;
    return jobOk("investigate", "Walk through Counts, Crashes, On the street, then Hold up?", [
      invokeCloserLookTool("walkThroughPlace", placeArgs, { session }),
    ], { deliverable: "walk", walk: WALK_THROUGH_STEPS });
  }

  if (/poke holes/.test(key) || /help me make the case/.test(key) || /challenge my case/.test(key)) {
    const missing = needPlace(session);
    if (missing) return missing;
    const challenge = invokeCloserLookTool("challengeCase", placeArgs, { session });
    return jobOk("challenge", "Four-line challenge: supports, weakens, unknowns, strongest defensible sentence", [
      invokeToolkitTool("openInspect", { tab: "why" }),
      challenge,
    ], { deliverable: "challenge", challenge: challenge.args });
  }

  if (/^what am i missing\??$/.test(key) || /what am i missing/.test(key)) {
    const missing = needPlace(session);
    if (missing) return missing;
    const listed = invokeCloserLookTool("listMissingEvidence", placeArgs, { session });
    return jobOk("missing", "Name field and data gaps required for a stronger claim", [
      invokeToolkitTool("openInspect", { tab: "why" }),
      listed,
    ], { deliverable: "missing", missing: listed.args });
  }

  if (/when during the day are these records/.test(key) || /when during the day/.test(key)) {
    const missing = needPlace(session);
    if (missing) return missing;
    const hours = invokeCloserLookTool("observedHours", placeArgs, { session });
    return jobOk("pattern", "Show observed crash_time hour buckets on supporting IDs", [
      invokeToolkitTool("openInspect", { tab: "records" }),
      hours,
    ], { deliverable: "hours", hours: hours.args });
  }

  return null;
}

export function parsePlannerJob(utterance, sessionState = {}, ctx = {}) {
  return parseCloserLookJob(utterance, sessionState, ctx) ?? parsePlannerJobV1(utterance, sessionState, ctx);
}

export function runPlannerJob(utterance, sessionState = {}, ctx = {}) {
  const closer = parseCloserLookJob(utterance, sessionState, ctx);
  if (!closer) return runPlannerJobV1(utterance, sessionState, ctx);
  const session = readSessionBag(sessionState);
  if (!closer.ok) {
    return {
      ok: false,
      refused: true,
      job: closer.job ?? "refuse",
      reason: closer.reason,
      prohibition: closer.prohibition ?? null,
      understood: null,
      tools: [],
      toolNames: [],
      dataThrough: session.analysisEnd,
      honesty: ASK_LEGEND_TASK_HONESTY,
    };
  }
  const tools = (closer.calls ?? []).filter(Boolean);
  if (tools.some((call) => !call?.ok)) {
    const failed = tools.find((call) => !call?.ok);
    return {
      ok: false,
      refused: true,
      job: "refuse",
      reason: failed?.reason ?? "Tool validation failed",
      prohibition: null,
      understood: null,
      tools: [],
      toolNames: [],
      dataThrough: readSessionBag(sessionState).analysisEnd,
      honesty: ASK_LEGEND_TASK_HONESTY,
    };
  }
  return {
    ok: true,
    refused: false,
    job: closer.job,
    understood: closer.understood,
    reason: null,
    prohibition: null,
    tools,
    toolNames: tools.map((call) => call.tool),
    keepCamera: Boolean(closer.keepCamera),
    deliverable: closer.deliverable ?? null,
    challenge: closer.challenge ?? null,
    missing: closer.missing ?? null,
    hours: closer.hours ?? null,
    walk: closer.walk ?? null,
    dataThrough: session.analysisEnd,
    sourceStatus: session.sourceStatus,
    honesty: ASK_LEGEND_TASK_HONESTY,
    trace: [
      closer.understood,
      `Tools: ${tools.map((call) => call.tool).join(", ")}`,
      session.analysisEnd ? `Records through ${session.analysisEnd}${session.sourceStatus ? ` · ${session.sourceStatus}` : ""}` : "Records through the accepted freeze",
    ].join(" · "),
  };
}
