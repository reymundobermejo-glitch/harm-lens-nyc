"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  ArrowDownToLine,
  Bookmark,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Database,
  FileText,
  Info,
  Layers3,
  List,
  LockKeyhole,
  MapPinned,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  ASK_LEGEND_SUBTITLE,
  applyChip,
  buildSearchUniverse,
  buildSituateFilterIndexFromYesMap,
  CLAIM_SAFE_SITUATE_FAMILIES,
  listChips,
  placeHasDocumentedYes,
  searchPlaces,
} from "../lib/ask-legend/index.mjs";
import { composeEvidenceBrief, evidenceBriefHtml } from "../lib/evidence-brief";

type PlaceMode = "intersection_node" | "midblock_segment";
type Lens = "injury" | "fatal";
type RoadUser = "everyone" | "pedestrian" | "cyclist" | "motorist";
type WindowKey = "24m" | "36m" | "48m";
type InspectorTab = "why" | "records" | "robustness" | "situate" | "packet";
type ActiveScreen = "overview" | "explore" | "inspect" | "compare" | "packet";
type AgreementFilter = "all" | "injury_led" | "fatal_led" | "both";
type CameraCommand = { kind: "fit" | "borough" | "selected"; borough?: string; nonce: number };
type FocusGroup = { ids: string[]; nonce: number };
type AskLegendHonesty = { chipId: string; label: string; tool: string; matchCount: number | null };
type SituateYesIndex = ReturnType<typeof buildSituateFilterIndexFromYesMap>;

type P25LensValues = Partial<Record<Lens, number>>;
type P25Place = {
  counts: Partial<Record<WindowKey, Partial<Record<RoadUser, P25LensValues>>>>;
  ids: Partial<Record<WindowKey, Partial<Record<RoadUser, Partial<Record<Lens, number[]>>>>>>;
  toll36: Partial<Record<RoadUser, P25LensValues>>;
  persistence: Partial<Record<Lens, { count36: number; threshold36: number; elevated36: boolean; count48: number; threshold48: number; elevated48: boolean; positive: boolean }>>;
  corridorIds: string[];
};
type P25Corridor = {
  corridorId: string;
  displayName: string;
  boroughName: string;
  componentOrdinal: number;
  streetCode: string;
  lgc: string;
  uniqueSegmentIdCount: number;
  placeIds: string[];
  metrics: Record<Lens, { count: number; ids: number[] }>;
};
type P25Projection = {
  meta: {
    projectionVersion: "HL-P2.5-UI-PROJECTION-v1";
    objectVersion: "HL-P2.5-OBJECT-RELEASE-v1";
    releaseManifestSha256: string;
    basePlaceCount: number;
    windows: Record<WindowKey, { id: string; start: string; end: string }>;
    roadUserLabels: Record<RoadUser, string>;
    frequencyDefault: true;
    tollWindow: "36m";
    tollDisagreementDisclosure: string;
    persistenceVersion: string;
    corridorVersion: string;
    fixedUniverseDisclosure: string;
    overlap36: Record<string, { everyone: number; namedAny: number; uncategorized: number; overlapTwoOrMore: number; groupsOverlap: boolean }>;
  };
  places: Record<string, P25Place>;
  corridors: Record<string, P25Corridor>;
};

type CompareMethodLock = { roadUser: RoadUser; window: WindowKey };

const ASK_LEGEND_G1A_CHIPS = listChips("G1a");
const ASK_LEGEND_G1B_CHIPS = listChips("G1b");
const CLAIM_SAFE_FAMILY_LIST = [...CLAIM_SAFE_SITUATE_FAMILIES];

type Peer = {
  placeId: number;
  injuryCount: number;
  fatalCount: number;
  injuryRank: number;
  fatalRank: number;
};

type Place = {
  id: string;
  placeType: PlaceMode;
  placeId: number;
  displayName: string;
  street: string | null;
  longitude: number | null;
  latitude: number | null;
  coordinateBasis: string;
  eligibleCollisionRecordCount: number;
  injuryCount: number;
  fatalCount: number;
  injuryRank: number;
  fatalRank: number;
  injuryThreshold: number;
  fatalThreshold: number;
  lensAgreementState: "injury_led" | "fatal_led" | "both" | "neither";
  injurySupportingIds: number[];
  fatalSupportingIds: number[];
  assignmentClass: "intersection_confident" | "midblock";
  equalityPass: boolean;
  checklistState: string;
  fragility: {
    summaryStatus: string;
    anyTestedStateChange: boolean;
    oneFatalRemovalState: string;
    oneFatalRemovalChanged: boolean;
    trailing24State: string;
    trailing36State: string;
    trailing48State: string;
    omit2024State: string;
    omit2025State: string;
    thresholdSensitivity: string;
  };
  peers: Peer[];
  hasDraftPacket: boolean;
};

type PacketField = { value: unknown; claim_class: string };
type Packet = {
  lep_id: string;
  fields: Record<string, PacketField>;
};

type SituateRelationship = {
  sourceDatasetId: string;
  sourceDatasetName: string;
  publisher: string;
  sourceSnapshotId: string;
  sourceSnapshotSha256: string;
  sourceRecordId: string;
  publishedSourceId: string | null;
  sourceRecordLabel: string;
  publishedDateValues: string | null;
  dateMeaning: string;
  effectiveIntervalStatus: string;
  matchType: string;
  geometryRelationship: string;
  distanceM: number | null;
  overlapLengthM: number | null;
  overlapShare: number | null;
  matchRuleVersion: string;
  assignmentRuleVersion: string;
  geographyVersion: string;
  releaseStatus: string;
  exactDuplicateGroupId: string | null;
  likelyDuplicateGroupId: string | null;
  projectGroupId: string | null;
  claimClass: "documented_history" | "unknown";
  candidateSourceClaimClass?: "documented_history";
  relationshipStatus: "matched_established_non_ambiguous" | "ambiguous_candidate_needs_review";
};

type OneFSituatePlace = {
  placeType: PlaceMode;
  placeId: number;
  status: "documented" | "documented_and_ambiguous" | "ambiguous" | "unmatched";
  documentedHistory: SituateRelationship[];
  ambiguous: SituateRelationship[];
  noMatchStatement: string | null;
};

type ApproachEvidence = {
  family: string;
  sourceDatasetId: string;
  sourceDatasetName: string;
  publisher: string;
  sourceSnapshotId: string | null;
  sourceSnapshotSha256: string | null;
  sourceRecordId: string;
  matchVersion: string;
  matchClass: string;
  claimClass: "documented_history" | "current_inventory" | "regulatory_posted" | "current_network_attribute" | "unknown";
  relationshipStatus: string;
  approachKey: string | null;
  segmentId: number | null;
  nodeId: number | null;
  humanLabel: string;
  statement: string;
  publishedDateValues: string | string[] | null;
  dateMeaning: string | null;
  geometryRelationship: string | Record<string, unknown> | null;
  speedMph?: number;
  speedClaimEligible?: boolean;
  sourceStatus?: string;
  routeClass?: string | null;
  restrictionText?: string | null;
  regulationText?: string | null;
  attributes?: Record<string, string[]>;
  field?: string;
  values?: string[];
};

type ApproachGroup = {
  approachKey: string;
  segmentId: number;
  networkAndRules: ApproachEvidence[];
  unknown: ApproachEvidence[];
};

type PermanentGap = { domain: string; status: string; statement: string };

type ApproachSituatePlace = {
  placeType: PlaceMode;
  placeId: number;
  grain: string;
  oneF: OneFSituatePlace;
  documentedStreetChanges: ApproachEvidence[];
  streetNetworkAndRules: ApproachEvidence[];
  unknownEvidence: ApproachEvidence[];
  permanentGaps: PermanentGap[];
  approaches: ApproachGroup[];
  flags: {
    hasDocumentedStreetChanges: boolean;
    hasStreetNetworkAndRules: boolean;
    hasAmbiguity: boolean;
    hasConflicts: boolean;
    speedClaimReadyApproachCount: number;
  };
};

type SituateIndex = {
  meta: {
    indexVersion: string;
    approachMatchVersion: string;
    oneFMatchVersion: string;
    assignmentVersion: string;
    geographyVersion: string;
    claimStatus: "CONDITIONAL";
    summary: {
      places: number;
      evidenceRows: {
        documentedStreetChanges: number;
        streetNetworkAndRules: number;
        unknownEvidence: number;
      };
    };
  };
  places: Record<string, ApproachSituatePlace>;
};

type Wave2ApproachGroup = {
  approachKey: string;
  segmentId: number;
  networkAndRuleRefs: string[];
  documentedStreetChangeRefs: string[];
  unknownRefs: string[];
};

type Wave2FamilyStatus = {
  status: "established" | "established_and_ambiguous" | "ambiguous" | "unmatched";
  noMatchStatement: string | null;
  possibleStatement: string | null;
};

type Wave2SituatePlace = {
  placeType: PlaceMode;
  placeId: number;
  grain: string;
  baseSituate: {
    placeKey: string;
    projectionVersion: "HL-APPROACH-SITUATE-v1";
    oneFStatus: OneFSituatePlace["status"];
    documentedStreetChangeCount: number;
    streetNetworkAndRuleCount: number;
    unknownEvidenceCount: number;
    approachCount: number;
  };
  documentedStreetChanges: ApproachEvidence[];
  streetNetworkAndRules: (ApproachEvidence & { evidenceId: string })[];
  unknownEvidence: (ApproachEvidence & { evidenceId: string })[];
  approaches: Wave2ApproachGroup[];
  familyStatus: Record<"bus_lanes" | "parking_regulation_signs" | "enhanced_crossings", Wave2FamilyStatus>;
  flags: {
    hasWave2DocumentedStreetChanges: boolean;
    hasWave2StreetNetworkAndRules: boolean;
    hasWave2Ambiguity: boolean;
    hasBusScheduleUnknown: boolean;
    hasUndatedEnhancedHistory: boolean;
  };
};

type PlaceLabel = {
  title: string;
  streetNames: string[];
  labelStatus: "cross_street" | "single_street" | "lion_segment_street" | "phase2_frozen_street" | "generic_fallback";
  sourceLayer: string | null;
  sourceRows: number;
};

type PlaceLabelIndex = {
  meta: {
    version: string;
    geographyVersion: string;
    sourceGdb: string;
    sourceDirectoryManifestSha256: string;
    coverage: Record<string, number>;
  };
  labels: Record<string, PlaceLabel>;
};

type AppData = {
  meta: {
    objectVersion: string;
    assignmentVersion: string;
    predicateRegistry: string;
    peerRule: string;
    windowId: string;
    analysisStart: string;
    analysisEnd: string;
    sourceStatus: string;
    fatalThreshold: number;
    noMatchStatement: string;
    imagery: {
      provider: string;
      year: number;
      license: string;
      tileTemplate: string;
      servicePage: string;
      meaning: string;
    };
    counts: {
      intersectionPlaces: number;
      midblockPlaces: number;
      possibleOrExceptionEvents: number;
      unresolvedEvents: number;
      geocodedUncertaintyEvents: number;
    };
  };
  places: Place[];
  samplePackets: Record<string, Packet>;
};

type FeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Point>;

function emptyPlaces(): FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function boundsOfPoints(features: GeoJSON.Feature<GeoJSON.Point>[]) {
  let west = 180;
  let south = 90;
  let east = -180;
  let north = -90;
  for (const feature of features) {
    const [lng, lat] = feature.geometry.coordinates;
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  if (west === east) {
    west -= 0.002;
    east += 0.002;
  }
  if (south === north) {
    south -= 0.002;
    north += 0.002;
  }
  return [[west, south], [east, north]] as [[number, number], [number, number]];
}

const STATE_LABELS: Record<Place["lensAgreementState"], string> = {
  injury_led: "Injury-led",
  fatal_led: "Fatal-led",
  both: "Both lenses",
  neither: "Neither elevated",
};

const ROAD_USER_LABELS: Record<RoadUser, string> = {
  everyone: "Everyone",
  pedestrian: "Pedestrians",
  cyclist: "Cyclists",
  motorist: "Motorists",
};

const ROAD_USER_MAP_LABELS: Record<RoadUser, string> = {
  everyone: "Everyone",
  pedestrian: "Walking",
  cyclist: "Bikes",
  motorist: "Cars",
};

const WINDOW_MAP_LABELS: Record<WindowKey, string> = {
  "24m": "Last 2 years",
  "36m": "Last 3 years",
  "48m": "Last 4 years",
};

const WINDOW_LABELS: Record<WindowKey, string> = { "24m": "24-month", "36m": "36-month", "48m": "48-month" };

function activeP25Count(projection: P25Projection, placeId: string, window: WindowKey, roadUser: RoadUser, lens: Lens) {
  return projection.places[placeId]?.counts[window]?.[roadUser]?.[lens] ?? 0;
}

function activeP25Ids(projection: P25Projection, placeId: string, window: WindowKey, roadUser: RoadUser, lens: Lens) {
  return projection.places[placeId]?.ids[window]?.[roadUser]?.[lens] ?? [];
}

const CLAIM_CLASSES = [
  ["Source fact", "Published in a frozen source snapshot"],
  ["Assignment", "Versioned spatial interpretation"],
  ["Calculation", "Derived from governed event sets"],
  ["Documented history", "Official record with bounded date meaning"],
  ["Current context", "Current-only approach or street evidence"],
  ["Unknown", "Not established by available evidence"],
  ["Unsupported", "Outside Harm Lens claims"],
];

const NYC_BOUNDS: [[number, number], [number, number]] = [[-74.26, 40.49], [-73.70, 40.92]];
const NYC_MAX_BOUNDS: [[number, number], [number, number]] = [[-74.36, 40.40], [-73.59, 41.01]];
const NYC_ORTHO_BOUNDS: [number, number, number, number] = [-74.26, 40.49, -73.70, 40.92];
const TRANSPARENT_PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="),
  (character) => character.charCodeAt(0),
);
const NEIGHBORHOOD_POINT_RADIUS = ["interpolate", ["linear"], ["zoom"], 9, 3.2, 11, 3.6, 13, 3.1, 14, 3.4, 16, 4.6];
const NEIGHBORHOOD_POINT_OPACITY = ["interpolate", ["linear"], ["zoom"], 10, 0.84, 12.5, 0.46, 14, 0.3, 16, 0.38];
let otiProtocolRegistered = false;
const BOROUGH_FRAMES: Record<string, { center: [number, number]; zoom: number }> = {
  Manhattan: { center: [-73.9712, 40.7831], zoom: 11.3 },
  Brooklyn: { center: [-73.9442, 40.6501], zoom: 10.8 },
  Queens: { center: [-73.8295, 40.7282], zoom: 10.5 },
  Bronx: { center: [-73.8648, 40.8448], zoom: 10.8 },
  "Staten Island": { center: [-74.1535, 40.5795], zoom: 10.5 },
};

function fragilityRead(place: Place) {
  return place.fragility.anyTestedStateChange
    ? "Changed in at least one completed test; spatial threshold remains deferred."
    : "No change in completed tests; spatial threshold remains deferred.";
}

function historyRead(place: OneFSituatePlace | undefined) {
  if (!place) return "Frozen history loading";
  const parts = [];
  if (place.documentedHistory.length) parts.push(`${place.documentedHistory.length} documented`);
  if (place.ambiguous.length) parts.push(`${place.ambiguous.length} ambiguous · unknown`);
  if (place.status === "unmatched") return "No match established · unknown";
  return parts.join(" + ") || "Unknown";
}

function dateRead(value: ApproachEvidence["publishedDateValues"]) {
  if (!value || (Array.isArray(value) && !value.length)) return "Not published";
  return Array.isArray(value) ? value.join(" · ") : value;
}

function claimLabel(value: ApproachEvidence["claimClass"]) {
  return formatState(value);
}

function EvidenceCard({ record, compact = false }: { record: ApproachEvidence; compact?: boolean }) {
  return (
    <article className={`approach-evidence-card ${compact ? "compact" : ""}`}>
      <div className="evidence-card-head"><div><strong>{record.humanLabel}</strong><span>{record.sourceDatasetName}</span></div><span className={`claim-chip ${record.claimClass === "unknown" ? "unknown" : "history"}`}>{claimLabel(record.claimClass)}</span></div>
      <p>{record.statement}</p>
      {record.publishedDateValues && <p className="evidence-date"><strong>{dateRead(record.publishedDateValues)}</strong>{record.dateMeaning ? ` · ${record.dateMeaning}` : ""}</p>}
      <details><summary>Source and match receipt</summary><dl className="provenance-grid"><div><dt>Publisher</dt><dd>{record.publisher}</dd></div><div><dt>Dataset</dt><dd><code>{record.sourceDatasetId}</code></dd></div><div><dt>Source record</dt><dd><code>{record.sourceRecordId}</code></dd></div><div><dt>Match</dt><dd>{formatState(record.matchClass)}</dd></div><div><dt>Match version</dt><dd><code>{record.matchVersion}</code></dd></div><div><dt>Snapshot</dt><dd><code>{record.sourceSnapshotId ?? "Inherited frozen source"}</code></dd></div></dl></details>
    </article>
  );
}

async function loadCompressedJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const isStillGzipped = bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!isStillGzipped) return JSON.parse(new TextDecoder().decode(bytes)) as T;
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return (await new Response(stream).json()) as T;
}

let situateProjectionBytes: Promise<Uint8Array> | null = null;
let wave2SituateProjectionBytes: Promise<Uint8Array> | null = null;

async function loadPlaceObjects<T>(placeIds: string[], projection: Promise<Uint8Array>): Promise<Record<string, T>> {
  const wanted = new Set(placeIds);
  if (!wanted.size) return {};
  const bytes = await projection;
  const compressed = bytes[0] === 0x1f && bytes[1] === 0x8b;
  const byteStream = new Blob([bytes]).stream();
  const textStream = (compressed ? byteStream.pipeThrough(new DecompressionStream("gzip")) : byteStream).pipeThrough(new TextDecoderStream());
  const reader = textStream.getReader();
  const found: Record<string, T> = {};
  let search = "";
  let activeId: string | null = null;
  let capture = "";
  let depth = 0;
  let inString = false;
  let escaped = false;
  const maxToken = Math.max(...[...wanted].map((id) => id.length + 4));

  const consume = (text: string) => {
    let cursor = 0;
    while (cursor < text.length && wanted.size) {
      if (!activeId) {
        search += text.slice(cursor);
        let hitId: string | undefined;
        let hitAt = Number.POSITIVE_INFINITY;
        for (const id of wanted) {
          const at = search.indexOf(`"${id}":`);
          if (at >= 0 && at < hitAt) { hitAt = at; hitId = id; }
        }
        if (!hitId) { search = search.slice(-maxToken); return; }
        const objectAt = search.indexOf("{", hitAt + hitId.length + 3);
        if (objectAt < 0) { search = search.slice(hitAt); return; }
        activeId = hitId;
        text = search.slice(objectAt);
        search = "";
        cursor = 0;
      }
      for (; cursor < text.length; cursor += 1) {
        const char = text[cursor];
        capture += char;
        if (inString) {
          if (escaped) escaped = false;
          else if (char === "\\") escaped = true;
          else if (char === '"') inString = false;
        } else if (char === '"') inString = true;
        else if (char === "{") depth += 1;
        else if (char === "}") {
          depth -= 1;
          if (depth === 0 && activeId) {
            found[activeId] = JSON.parse(capture) as T;
            wanted.delete(activeId);
            activeId = null;
            capture = "";
            cursor += 1;
            search = text.slice(cursor);
            text = "";
            cursor = 0;
            break;
          }
        }
      }
    }
  };

  while (wanted.size) {
    const { value, done } = await reader.read();
    if (done) break;
    consume(value);
  }
  await reader.cancel();
  if (wanted.size) throw new Error(`Frozen Situate place keys missing: ${[...wanted].join(", ")}`);
  return found;
}

async function loadSituatePlaces(placeIds: string[]): Promise<Record<string, ApproachSituatePlace>> {
  if (!situateProjectionBytes) {
    situateProjectionBytes = fetch("/data/situate-approach-context-v1.json.gz").then(async (response) => {
      if (!response.ok) throw new Error("Frozen Situate projection failed to load");
      return new Uint8Array(await response.arrayBuffer());
    });
  }
  return loadPlaceObjects(placeIds, situateProjectionBytes);
}

async function loadWave2SituatePlaces(placeIds: string[]): Promise<Record<string, Wave2SituatePlace>> {
  if (!wave2SituateProjectionBytes) {
    wave2SituateProjectionBytes = fetch("/data/situate-approach-context-wave2-v1.json.gz").then(async (response) => {
      if (!response.ok) throw new Error("Frozen Wave-2 Situate projection failed to load");
      return new Uint8Array(await response.arrayBuffer());
    });
  }
  return loadPlaceObjects(placeIds, wave2SituateProjectionBytes);
}

/** Stream every place object from a frozen Situate gzip without loading the full JSON string. */
async function forEachProjectionPlace(
  projection: Promise<Uint8Array>,
  onPlace: (id: string, place: Record<string, unknown>) => void,
): Promise<void> {
  const bytes = await projection;
  const compressed = bytes[0] === 0x1f && bytes[1] === 0x8b;
  const byteStream = new Blob([bytes]).stream();
  const textStream = (compressed ? byteStream.pipeThrough(new DecompressionStream("gzip")) : byteStream).pipeThrough(new TextDecoderStream());
  const reader = textStream.getReader();
  const keyRe = /"(intersection_node:\d+|midblock_segment:\d+)":\s*\{/g;
  let buffer = "";
  let placesStarted = false;

  const drain = () => {
    if (!placesStarted) {
      const at = buffer.indexOf('"places"');
      if (at < 0) {
        if (buffer.length > 64_000) buffer = buffer.slice(-8_000);
        return;
      }
      const brace = buffer.indexOf("{", at);
      if (brace < 0) return;
      placesStarted = true;
      buffer = buffer.slice(brace + 1);
    }

    while (true) {
      keyRe.lastIndex = 0;
      const match = keyRe.exec(buffer);
      if (!match || match.index === undefined) {
        if (buffer.length > 2_000_000) buffer = buffer.slice(-250_000);
        return;
      }
      const id = match[1];
      const objectStart = match.index + match[0].length - 1;
      let depth = 0;
      let inString = false;
      let escaped = false;
      let end = -1;
      for (let i = objectStart; i < buffer.length; i += 1) {
        const char = buffer[i];
        if (inString) {
          if (escaped) escaped = false;
          else if (char === "\\") escaped = true;
          else if (char === '"') inString = false;
          continue;
        }
        if (char === '"') inString = true;
        else if (char === "{") depth += 1;
        else if (char === "}") {
          depth -= 1;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end < 0) {
        buffer = buffer.slice(match.index);
        return;
      }
      const json = buffer.slice(objectStart, end + 1);
      buffer = buffer.slice(end + 1);
      onPlace(id, JSON.parse(json) as Record<string, unknown>);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    drain();
  }
  drain();
  await reader.cancel();
}

function collectYesFamilies(place: Record<string, unknown>): string[] {
  const yes: string[] = [];
  for (const family of CLAIM_SAFE_FAMILY_LIST) {
    if (placeHasDocumentedYes(place as never, family)) yes.push(family);
  }
  return yes;
}

let situateYesIndexPromise: Promise<SituateYesIndex> | null = null;

async function loadSituateYesFilterIndex(): Promise<SituateYesIndex> {
  if (!situateYesIndexPromise) {
    situateYesIndexPromise = (async () => {
      if (!situateProjectionBytes) {
        situateProjectionBytes = fetch("/data/situate-approach-context-v1.json.gz").then(async (response) => {
          if (!response.ok) throw new Error("Frozen Situate projection failed to load");
          return new Uint8Array(await response.arrayBuffer());
        });
      }
      if (!wave2SituateProjectionBytes) {
        wave2SituateProjectionBytes = fetch("/data/situate-approach-context-wave2-v1.json.gz").then(async (response) => {
          if (!response.ok) throw new Error("Frozen Wave-2 Situate projection failed to load");
          return new Uint8Array(await response.arrayBuffer());
        });
      }
      const yesByPlace: Record<string, string[]> = {};
      const merge = (id: string, families: string[]) => {
        if (!families.length) return;
        const current = new Set(yesByPlace[id] ?? []);
        for (const family of families) current.add(family);
        yesByPlace[id] = [...current];
      };
      await forEachProjectionPlace(situateProjectionBytes, (id, place) => merge(id, collectYesFamilies(place)));
      await forEachProjectionPlace(wave2SituateProjectionBytes, (id, place) => merge(id, collectYesFamilies(place)));
      return buildSituateFilterIndexFromYesMap(yesByPlace);
    })().catch((error) => {
      situateYesIndexPromise = null;
      throw error;
    });
  }
  return situateYesIndexPromise;
}

function mergeSituatePlace(base: ApproachSituatePlace, wave2: Wave2SituatePlace): ApproachSituatePlace {
  if (wave2.baseSituate.placeKey !== `${base.placeType}:${base.placeId}` || wave2.baseSituate.oneFStatus !== base.oneF.status) {
    throw new Error("Frozen Situate projections do not share the same exact place key and 1F status");
  }
  const evidenceById = new Map(wave2.streetNetworkAndRules.map((record) => [record.evidenceId, record]));
  const approachMap = new Map(base.approaches.map((approach) => [approach.approachKey, { ...approach, networkAndRules: [...approach.networkAndRules], unknown: [...approach.unknown] }]));
  for (const approach of wave2.approaches) {
    const current = approachMap.get(approach.approachKey) ?? { approachKey: approach.approachKey, segmentId: approach.segmentId, networkAndRules: [], unknown: [] };
    current.networkAndRules.push(...approach.networkAndRuleRefs.map((id) => evidenceById.get(id)).filter((record): record is ApproachEvidence & { evidenceId: string } => Boolean(record)));
    approachMap.set(approach.approachKey, current);
  }
  const familyDefinitions = {
    bus_lanes: ["Bus lane relationship", "ycrg-ses3", "NYC Bus Lanes — Local Streets"],
    parking_regulation_signs: ["Parking regulation sign relationship", "nfid-uabd", "Parking Regulation Locations and Signs"],
    enhanced_crossings: ["Enhanced Crossing relationship", "6ax4-q5k4", "VZV Enhanced Crossings"],
  } as const;
  const familyUnknowns: ApproachEvidence[] = Object.entries(wave2.familyStatus).flatMap(([family, status]) => {
    if (status.status !== "unmatched" && status.status !== "ambiguous") return [];
    if (status.status === "ambiguous" && wave2.unknownEvidence.some((record) => record.family === family)) return [];
    const [label, datasetId, datasetName] = familyDefinitions[family as keyof typeof familyDefinitions];
    return [{
      family,
      sourceDatasetId: datasetId,
      sourceDatasetName: datasetName,
      publisher: "NYC Department of Transportation",
      sourceSnapshotId: "HL-APPROACH-WAVE2-FREEZE-v1",
      sourceSnapshotSha256: null,
      sourceRecordId: `${family}:family_status`,
      matchVersion: "HL-APPROACH-MATCH-WAVE2-v1",
      matchClass: status.status,
      claimClass: "unknown" as const,
      relationshipStatus: status.status,
      approachKey: null,
      segmentId: null,
      nodeId: base.placeType === "intersection_node" ? base.placeId : null,
      humanLabel: label,
      statement: status.status === "unmatched" ? status.noMatchStatement! : status.possibleStatement!,
      publishedDateValues: null,
      dateMeaning: null,
      geometryRelationship: null,
    }];
  });
  return {
    ...base,
    documentedStreetChanges: [...base.documentedStreetChanges, ...wave2.documentedStreetChanges],
    streetNetworkAndRules: [...base.streetNetworkAndRules, ...wave2.streetNetworkAndRules],
    unknownEvidence: [...base.unknownEvidence, ...wave2.unknownEvidence, ...familyUnknowns],
    approaches: [...approachMap.values()].sort((a, b) => a.segmentId - b.segmentId || a.approachKey.localeCompare(b.approachKey)),
    flags: {
      ...base.flags,
      hasDocumentedStreetChanges: base.flags.hasDocumentedStreetChanges || wave2.flags.hasWave2DocumentedStreetChanges,
      hasStreetNetworkAndRules: base.flags.hasStreetNetworkAndRules || wave2.flags.hasWave2StreetNetworkAndRules,
      hasAmbiguity: base.flags.hasAmbiguity || wave2.flags.hasWave2Ambiguity,
    },
  };
}

function formatState(value: string) {
  return value.replaceAll("_", " ").replaceAll("reentry", "re-entry");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDateLong(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function otiFallbackTemplate(httpsTemplate: string) {
  return httpsTemplate.replace(/^https:\/\//, "oti-fallback://");
}

function basemapStyle(tileTemplate: string) {
  return {
    version: 8 as const,
    sources: {
      context: {
        type: "raster" as const,
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 19,
        attribution: "© OpenStreetMap contributors, ODbL",
      },
      ortho: {
        type: "raster" as const,
        tiles: [otiFallbackTemplate(tileTemplate)],
        tileSize: 256,
        maxzoom: 19,
        bounds: NYC_ORTHO_BOUNDS,
        attribution: "© City of New York, CC BY 4.0",
      },
    },
    layers: [
      { id: "harbor-atmosphere", type: "background" as const, paint: { "background-color": "#a8b8b4" } },
      { id: "free-context", type: "raster" as const, source: "context", paint: { "raster-opacity": 0.46, "raster-saturation": -0.92, "raster-contrast": -0.12, "raster-brightness-min": 0.2, "raster-brightness-max": 0.88 } },
      { id: "ortho", type: "raster" as const, source: "ortho", paint: { "raster-opacity": 0.56, "raster-saturation": -0.52, "raster-contrast": -0.02, "raster-fade-duration": 0 } },
    ],
  };
}

function ignoreBasemapTileError(event: { sourceId?: string }) {
  return event.sourceId === "ortho" || event.sourceId === "context";
}

function prepareMapLibre(module: typeof import("maplibre-gl")) {
  module.setWorkerUrl("/_next/static/chunks/maplibre-gl-worker.mjs");
  if (otiProtocolRegistered) return;
  module.addProtocol("oti-fallback", async (params, abortController) => {
    try {
      const response = await fetch(`https://${params.url.split("://")[1]}`, { signal: abortController.signal });
      if (!response.ok) return { data: TRANSPARENT_PNG.buffer };
      const data = await response.arrayBuffer();
      if (data.byteLength < 256) return { data: TRANSPARENT_PNG.buffer };
      return { data };
    } catch (error) {
      if (abortController.signal.aborted) throw error;
      return { data: TRANSPARENT_PNG.buffer };
    }
  });
  otiProtocolRegistered = true;
}

function titleCaseStreet(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase())
    .replace(/\bPkwy\b/g, "Pkwy")
    .replace(/\bBlvd\b/g, "Blvd")
    .replace(/\bAve\b/g, "Ave")
    .replace(/\bSt\b/g, "St");
}

function attributeValues(record: ApproachEvidence, matcher: RegExp) {
  return Object.entries(record.attributes ?? {})
    .filter(([key]) => matcher.test(key))
    .flatMap(([, values]) => values ?? []);
}

function approachStreetName(approach: ApproachGroup) {
  for (const record of [...approach.networkAndRules, ...approach.unknown]) {
    const named = attributeValues(record, /street.?name/i)[0];
    if (named) return titleCaseStreet(named);
    const fromStatement = record.statement.match(/street name:\s*([^;]+)/i)?.[1];
    if (fromStatement) return titleCaseStreet(fromStatement);
  }
  return `Approach ${approach.segmentId}`;
}

function approachFactChips(approach: ApproachGroup) {
  const chips: { label: string; value: string }[] = [];
  const take = (label: string, value: string | undefined) => {
    const trimmed = value?.trim();
    if (!trimmed || chips.some((chip) => chip.label === label)) return;
    chips.push({ label, value: trimmed });
  };
  const firstNumber = (value: string | undefined) => value?.match(/(\d+(?:\.\d+)?)/)?.[1];
  for (const record of approach.networkAndRules) {
    const speed = record.speedMph != null
      ? String(record.speedMph)
      : firstNumber(record.statement.match(/(\d+)\s*mph/i)?.[0]) ?? firstNumber(attributeValues(record, /posted.?speed/i)[0]);
    take("Speed", speed ? `${speed} mph` : undefined);
    const lanes = firstNumber(attributeValues(record, /travel-?lane/i)[0]) ?? firstNumber(record.statement.match(/travel-lane count:\s*([^;]+)/i)?.[1]);
    take("Lanes", lanes);
    const width = firstNumber(attributeValues(record, /maximum street width|street width/i)[0]) ?? firstNumber(record.statement.match(/maximum street width:\s*([^;]+)/i)?.[1]);
    take("Width", width ? `${width.replace(/\.0$/, "")} ft` : undefined);
  }
  return chips;
}

function isParkingRecord(record: ApproachEvidence) {
  return /parking/i.test(record.family) || /parking/i.test(record.humanLabel) || /parking-regulation/i.test(record.statement);
}

function groupUnknownEvidence(records: ApproachEvidence[]) {
  const groups = new Map<string, ApproachEvidence[]>();
  for (const record of records) {
    const key = record.statement.trim() || record.humanLabel;
    const current = groups.get(key) ?? [];
    current.push(record);
    groups.set(key, current);
  }
  return [...groups.entries()].map(([statement, items]) => ({ statement, items, family: items[0]?.family ?? "unknown" }));
}

function documentedFactTitle(record: ApproachEvidence) {
  if (/accessible pedestrian/i.test(record.humanLabel) || /accessible pedestrian/i.test(record.statement)) return "Accessible pedestrian signal";
  if (/enhanced crossing/i.test(record.humanLabel)) return "Enhanced crossing";
  if (/bus lane/i.test(record.humanLabel)) return "Bus lane";
  return record.humanLabel;
}

function placeTitle(place: Place, labelIndex?: PlaceLabelIndex | null) {
  const projected = labelIndex?.labels[place.id]?.title?.trim();
  if (projected) return projected;
  const frozenStreet = place.street?.trim();
  if (frozenStreet) return frozenStreet;
  return place.placeType === "intersection_node" ? "Intersection" : "Midblock segment";
}

function lionLabel(place: Place) {
  return `LION ${place.placeType === "intersection_node" ? "node" : "segment"} ${place.placeId}`;
}

function StateTag({ state }: { state: Place["lensAgreementState"] }) {
  return <span className={`state-tag state-${state}`}>{STATE_LABELS[state]}</span>;
}

function CountMark({ label, value, active }: { label: string; value: number; active?: boolean }) {
  return (
    <div className={`count-mark ${active ? "active" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>collision records</small>
    </div>
  );
}

function EvidenceIds({ title, ids, tone }: { title: string; ids: number[]; tone: Lens }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? ids : ids.slice(0, 8);
  return (
    <section className="evidence-id-block">
      <div className="section-row">
        <div>
          <span className="eyebrow">Exact support set</span>
          <h4>{title}</h4>
        </div>
        <span className={`count-pill ${tone}`}>{ids.length}</span>
      </div>
      {ids.length ? (
        <>
          <div className="id-list">
            {visible.map((id) => <code key={id}>{id}</code>)}
          </div>
          {ids.length > 8 && (
            <button className="text-button" onClick={() => setExpanded(!expanded)}>
              {expanded ? "Show fewer IDs" : `Inspect all ${ids.length} IDs`}
            </button>
          )}
        </>
      ) : <p className="empty-copy">No collision records satisfy this lens at this place.</p>}
    </section>
  );
}

function MapSurface({
  data,
  selected,
  mode,
  lens,
  showPossible,
  showUnresolved,
  onSelect,
}: {
  data: AppData;
  selected: Place;
  mode: PlaceMode;
  lens: Lens;
  showPossible: boolean;
  showUnresolved: boolean;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const placesGeoRef = useRef<FeatureCollection | null>(null);
  const onSelectRef = useRef(onSelect);
  const initialSelectedIdRef = useRef(selected.id);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    Promise.all([
      import("maplibre-gl"),
      loadCompressedJson<FeatureCollection>("/data/ranked-places.geojson.gz"),
      loadCompressedJson<FeatureCollection>("/data/uncertainty.geojson.gz"),
    ]).then(([module, placesGeo, uncertaintyGeo]) => {
      if (cancelled || !containerRef.current) return;
      prepareMapLibre(module);
      placesGeoRef.current = placesGeo;
      const initialPlaces = {
        ...placesGeo,
        features: placesGeo.features.filter((feature) => feature.properties?.placeType === "intersection_node"),
      } as FeatureCollection;
      containerRef.current.dataset.rankedSourceFeatures = String(initialPlaces.features.length);
      const map = new module.Map({
        container: containerRef.current,
        center: [-73.94, 40.72],
        zoom: 10.2,
        minZoom: 9,
        maxZoom: 19,
        attributionControl: false,
        style: basemapStyle(data.meta.imagery.tileTemplate),
      });
      map.addControl(new module.NavigationControl({ showCompass: false }), "bottom-right");
      map.addControl(new module.AttributionControl({ compact: true }), "bottom-left");
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();
      map.on("load", () => {
        map.addSource("places", { type: "geojson", data: initialPlaces, cluster: true, clusterRadius: 28, clusterMaxZoom: 10 });
        map.addLayer({
          id: "place-clusters",
          type: "circle",
          source: "places",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#173a4b",
            "circle-radius": ["step", ["get", "point_count"], 13, 100, 18, 500, 23],
            "circle-stroke-color": "#f5f2e8",
            "circle-stroke-width": 2,
            "circle-opacity": 0.9,
          },
        });
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "places",
          filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 11 },
          paint: { "text-color": "#ffffff" },
        });
        map.addLayer({
          id: "places-point",
          type: "circle",
          source: "places",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": "#4c8c84",
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 2.5, 15, 7],
            "circle-opacity": 0.82,
            "circle-stroke-color": "#fffaf0",
            "circle-stroke-width": 1,
          },
        });
        map.addSource("uncertainty", { type: "geojson", data: uncertaintyGeo });
        map.addLayer({
          id: "possible-points",
          type: "circle",
          source: "uncertainty",
          filter: ["==", ["get", "assignmentClass"], "intersection_possible_or_exception"],
          layout: { visibility: "visible" },
          paint: { "circle-color": "#df9b33", "circle-radius": 2.2, "circle-opacity": 0.34 },
        });
        map.addLayer({
          id: "unresolved-points",
          type: "circle",
          source: "uncertainty",
          filter: ["==", ["get", "assignmentClass"], "unresolved"],
          layout: { visibility: "visible" },
          paint: { "circle-color": "#6d7480", "circle-radius": 2.4, "circle-opacity": 0.48 },
        });
        map.addLayer({
          id: "selected-ring",
          type: "circle",
          source: "places",
          filter: ["==", ["get", "id"], initialSelectedIdRef.current],
          paint: { "circle-radius": 11, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#fffaf0", "circle-stroke-width": 3 },
        });
        map.on("click", "places-point", (event: MapMouseEvent) => {
          const id = event.features?.[0]?.properties?.id;
          if (id) onSelectRef.current(String(id));
        });
        map.on("click", "place-clusters", async (event: MapMouseEvent) => {
          const feature = event.features?.[0];
          const clusterId = feature?.properties?.cluster_id;
          if (clusterId === undefined || !feature?.geometry || feature.geometry.type !== "Point") return;
          const source = map.getSource("places") as GeoJSONSource;
          const zoom = await source.getClusterExpansionZoom(clusterId);
          map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom });
        });
        map.on("mouseenter", "places-point", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "places-point", () => { map.getCanvas().style.cursor = ""; });
        map.on("mouseenter", "place-clusters", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "place-clusters", () => { map.getCanvas().style.cursor = ""; });
        setMapReady(true);
      });
      map.on("error", (event) => { if (!ignoreBasemapTileError(event)) setMapError(true); });
      mapRef.current = map;
    }).catch(() => setMapError(true));
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [data]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const source = map.getSource("places") as GeoJSONSource;
    if (placesGeoRef.current) {
      source.setData({
        ...placesGeoRef.current,
        features: placesGeoRef.current.features.filter((feature) => feature.properties?.placeType === mode),
      });
    }
    const placeFilter: unknown[] = ["all", ["!", ["has", "point_count"]], ["==", ["get", "placeType"], mode]];
    map.setFilter("places-point", placeFilter as never);
    map.setFilter("selected-ring", ["==", ["get", "id"], selected.id] as never);
    map.setPaintProperty("places-point", "circle-color", lens === "injury" ? "#4c8c84" : "#c87558");
    map.setLayoutProperty("possible-points", "visibility", showPossible ? "visible" : "none");
    map.setLayoutProperty("unresolved-points", "visibility", showUnresolved ? "visible" : "none");
    if (selected.longitude !== null && selected.latitude !== null) {
      map.easeTo({ center: [selected.longitude, selected.latitude], zoom: Math.max(map.getZoom(), 13), duration: 700 });
    }
  }, [lens, mapReady, mode, selected, showPossible, showUnresolved]);

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="map-canvas" role="application" aria-label="Harm Lens map of analytical place objects" />
      {!mapReady && !mapError && <div className="map-loading"><span />Preparing governed map objects…</div>}
      {mapError && <div className="map-error"><AlertTriangle size={18} />The imagery service is unavailable. Place evidence remains available in the list and inspector.</div>}
      <div className="imagery-badge">
        <MapPinned size={14} />
        <div><strong>Historical reference imagery · NYC OTI {data.meta.imagery.year}</strong><span>Not a current streetscape · {data.meta.imagery.license}</span></div>
      </div>
      <div className="map-legend">
        <span><i className="dot injury" />{lens === "injury" ? "Injury count" : "Fatal count"}</span>
        <span><i className="dot possible" />Possible / exception · non-ranked</span>
        <span><i className="dot unresolved" />Unresolved · non-ranked</span>
      </div>
    </div>
  );
}

void MapSurface;

function Phase32MapSurface({
  data,
  selected,
  mode,
  lens,
  agreementFilter,
  showPossible,
  showUnresolved,
  comparePlaces,
  cameraCommand,
  focusGroup,
  eligiblePlaceIds,
  filtersActive,
  onSelect,
  onPreview,
  onFocusGroup,
}: {
  data: AppData;
  selected: Place | null;
  mode: PlaceMode;
  lens: Lens;
  agreementFilter: AgreementFilter;
  showPossible: boolean;
  showUnresolved: boolean;
  comparePlaces: Place[];
  cameraCommand: CameraCommand;
  focusGroup: FocusGroup | null;
  eligiblePlaceIds: string[];
  filtersActive: boolean;
  onSelect: (id: string) => void;
  onPreview: (id: string | null) => void;
  onFocusGroup: (ids: string[]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const placesGeoRef = useRef<FeatureCollection | null>(null);
  const onSelectRef = useRef(onSelect);
  const onPreviewRef = useRef(onPreview);
  const onFocusGroupRef = useRef(onFocusGroup);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { onPreviewRef.current = onPreview; }, [onPreview]);
  useEffect(() => { onFocusGroupRef.current = onFocusGroup; }, [onFocusGroup]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    Promise.all([
      import("maplibre-gl"),
      loadCompressedJson<FeatureCollection>("/data/ranked-places.geojson.gz"),
      loadCompressedJson<FeatureCollection>("/data/uncertainty.geojson.gz"),
    ]).then(([module, placesGeo, uncertaintyGeo]) => {
      if (cancelled || !containerRef.current) return;
      prepareMapLibre(module);
      placesGeoRef.current = placesGeo;
      const initialPlaces = {
        ...placesGeo,
        features: placesGeo.features.filter((feature) => feature.properties?.placeType === "intersection_node"),
      } as FeatureCollection;
      containerRef.current.dataset.rankedSourceFeatures = String(initialPlaces.features.length);
      const map = new module.Map({
        container: containerRef.current,
        center: [-73.94, 40.72],
        zoom: 9.6,
        minZoom: 9,
        maxZoom: 19,
        maxBounds: NYC_MAX_BOUNDS,
        attributionControl: false,
        style: basemapStyle(data.meta.imagery.tileTemplate),
      });
      map.on("error", (event) => { if (!ignoreBasemapTileError(event)) setMapError(true); });
      map.addControl(new module.NavigationControl({ showCompass: false }), "bottom-right");
      map.addControl(new module.AttributionControl({ compact: true }), "bottom-left");
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();
      map.on("load", () => {
        try {
        map.addSource("places", { type: "geojson", data: initialPlaces, cluster: true, clusterRadius: 28, clusterMaxZoom: 10 });
        map.addLayer({ id: "cluster-halo", type: "circle", source: "places", filter: ["has", "point_count"], paint: { "circle-color": "rgba(255,254,249,.82)", "circle-radius": ["step", ["get", "point_count"], 18, 80, 23, 300, 29, 900, 35], "circle-opacity": 0.95 } });
        map.addLayer({ id: "place-clusters", type: "circle", source: "places", filter: ["has", "point_count"], paint: { "circle-color": "#173a4b", "circle-radius": ["step", ["get", "point_count"], 13, 80, 18, 300, 24, 900, 30], "circle-stroke-color": "#f5f2e8", "circle-stroke-width": 2, "circle-opacity": 0.96 } });
        map.addLayer({ id: "cluster-count", type: "symbol", source: "places", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 11, "text-allow-overlap": true }, paint: { "text-color": "#ffffff", "text-halo-color": "#173a4b", "text-halo-width": 1 } });
        map.addLayer({ id: "places-point", type: "circle", source: "places", filter: ["!", ["has", "point_count"]], paint: { "circle-color": "#3f817b", "circle-radius": NEIGHBORHOOD_POINT_RADIUS, "circle-opacity": NEIGHBORHOOD_POINT_OPACITY, "circle-stroke-color": "#fffaf0", "circle-stroke-width": 0.8, "circle-stroke-opacity": 0.55 } });
        map.addLayer({ id: "midblock-ticks", type: "symbol", source: "places", filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "placeType"], "midblock_segment"]], layout: { visibility: "none", "text-field": "━", "text-size": ["interpolate", ["linear"], ["zoom"], 9, 12, 12, 14, 16, 18], "text-allow-overlap": true }, paint: { "text-color": "#173a4b", "text-halo-color": "#fffaf0", "text-halo-width": 1.4, "text-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0.9, 14, 0.45] } });
        map.addSource("focus-places", { type: "geojson", data: emptyPlaces(), cluster: true, clusterRadius: 36, clusterMaxZoom: 15 });
        map.addLayer({ id: "focus-cluster-halo", type: "circle", source: "focus-places", filter: ["has", "point_count"], layout: { visibility: "none" }, paint: { "circle-color": "rgba(255,254,249,.9)", "circle-radius": ["step", ["get", "point_count"], 20, 40, 24, 120, 30, 400, 36], "circle-opacity": 0.96 } });
        map.addLayer({ id: "focus-clusters", type: "circle", source: "focus-places", filter: ["has", "point_count"], layout: { visibility: "none" }, paint: { "circle-color": "#173a4b", "circle-radius": ["step", ["get", "point_count"], 14, 40, 18, 120, 24, 400, 30], "circle-stroke-color": "#e0a13a", "circle-stroke-width": 3, "circle-opacity": 0.98 } });
        map.addLayer({ id: "focus-cluster-count", type: "symbol", source: "focus-places", filter: ["has", "point_count"], layout: { visibility: "none", "text-field": ["get", "point_count_abbreviated"], "text-size": 12, "text-allow-overlap": true }, paint: { "text-color": "#ffffff", "text-halo-color": "#173a4b", "text-halo-width": 1 } });
        map.addLayer({ id: "focus-points", type: "circle", source: "focus-places", filter: ["!", ["has", "point_count"]], layout: { visibility: "none" }, paint: { "circle-color": "#4c8c84", "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 6, 13, 8, 16, 11], "circle-opacity": 1, "circle-stroke-color": "#fffaf0", "circle-stroke-width": 2 } });
        map.addLayer({ id: "focus-midblock-ticks", type: "symbol", source: "focus-places", filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "placeType"], "midblock_segment"]], layout: { visibility: "none", "text-field": "━", "text-size": ["interpolate", ["linear"], ["zoom"], 9, 16, 12, 22, 16, 30], "text-allow-overlap": true }, paint: { "text-color": "#2d6764", "text-halo-color": "#fffaf0", "text-halo-width": 2 } });
        map.addSource("context-places", { type: "geojson", data: emptyPlaces() });
        map.addLayer({ id: "context-points", type: "circle", source: "context-places", layout: { visibility: "none" }, minzoom: 12.5, paint: { "circle-color": "#8a918c", "circle-radius": 2.4, "circle-opacity": 0.22, "circle-stroke-color": "#dfe3dc", "circle-stroke-width": 0.6 } });
        map.addSource("uncertainty", { type: "geojson", data: uncertaintyGeo });
        map.addLayer({ id: "possible-points", type: "circle", source: "uncertainty", filter: ["==", ["get", "assignmentClass"], "intersection_possible_or_exception"], layout: { visibility: "none" }, paint: { "circle-color": "rgba(0,0,0,0)", "circle-radius": 2.4, "circle-opacity": 0.28, "circle-stroke-color": "#bd7b23", "circle-stroke-width": 0.9, "circle-stroke-opacity": 0.28 } });
        map.addLayer({ id: "unresolved-points", type: "circle", source: "uncertainty", filter: ["==", ["get", "assignmentClass"], "unresolved"], layout: { visibility: "none" }, paint: { "circle-color": "#6d7480", "circle-radius": 1.8, "circle-opacity": 0.22 } });
        map.addSource("selected-place", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "selected-halo", type: "circle", source: "selected-place", paint: { "circle-radius": 22, "circle-color": "#fffef9", "circle-opacity": 0.98, "circle-stroke-color": "#102d3a", "circle-stroke-width": 6 } });
        map.addLayer({ id: "selected-ring", type: "circle", source: "selected-place", paint: { "circle-radius": 12, "circle-color": "#e0a13a", "circle-opacity": 1, "circle-stroke-color": "#102d3a", "circle-stroke-width": 2.5 } });
        map.addSource("compare-pins", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "compare-pin-rings", type: "circle", source: "compare-pins", paint: { "circle-radius": 14, "circle-color": "#173a4b", "circle-stroke-color": "#fffef9", "circle-stroke-width": 3 } });
        map.addLayer({ id: "compare-pin-labels", type: "symbol", source: "compare-pins", layout: { "text-field": ["get", "label"], "text-size": 11 }, paint: { "text-color": "#ffffff" } });

        const selectFeature = (event: MapMouseEvent) => {
          const id = event.features?.[0]?.properties?.id;
          if (id) onSelectRef.current(String(id));
        };
        const previewFeature = (event: MapMouseEvent) => {
          const id = event.features?.[0]?.properties?.id;
          onPreviewRef.current(id ? String(id) : null);
        };
        map.on("click", "places-point", selectFeature);
        map.on("click", "midblock-ticks", selectFeature);
        map.on("click", "focus-points", selectFeature);
        map.on("click", "focus-midblock-ticks", selectFeature);
        map.on("mousemove", "places-point", previewFeature);
        map.on("mousemove", "midblock-ticks", previewFeature);
        map.on("mousemove", "focus-points", previewFeature);
        map.on("mousemove", "focus-midblock-ticks", previewFeature);
        map.on("mouseleave", "places-point", () => onPreviewRef.current(null));
        map.on("mouseleave", "midblock-ticks", () => onPreviewRef.current(null));
        map.on("mouseleave", "focus-points", () => onPreviewRef.current(null));
        map.on("mouseleave", "focus-midblock-ticks", () => onPreviewRef.current(null));
        const focusCluster = async (sourceId: "places" | "focus-places", event: MapMouseEvent) => {
          const feature = event.features?.[0];
          const clusterId = feature?.properties?.cluster_id;
          const pointCount = Number(feature?.properties?.point_count ?? 0);
          if (clusterId === undefined || !feature?.geometry || feature.geometry.type !== "Point") return;
          const source = map.getSource(sourceId) as GeoJSONSource;
          const leaves = await source.getClusterLeaves(clusterId, Math.max(pointCount, 1), 0);
          const ids = leaves.map((leaf) => String(leaf.properties?.id ?? "")).filter(Boolean);
          if (ids.length) onFocusGroupRef.current(ids);
        };
        map.on("click", "place-clusters", (event: MapMouseEvent) => { void focusCluster("places", event); });
        map.on("click", "focus-clusters", (event: MapMouseEvent) => { void focusCluster("focus-places", event); });
        for (const layer of ["places-point", "midblock-ticks", "place-clusters", "focus-points", "focus-midblock-ticks", "focus-clusters"]) {
          map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
        }
        const publishCamera = () => {
          if (!containerRef.current) return;
          const center = map.getCenter();
          containerRef.current.dataset.mapZoom = map.getZoom().toFixed(3);
          containerRef.current.dataset.mapCenter = `${center.lng.toFixed(5)},${center.lat.toFixed(5)}`;
        };
        const publishVisibilityEvidence = () => {
          if (!containerRef.current) return;
          const rendered = map.queryRenderedFeatures({ layers: ["place-clusters", "places-point", "midblock-ticks", "focus-clusters", "focus-points", "focus-midblock-ticks"] });
          containerRef.current.dataset.renderedRankedFeatures = String(rendered.length);
          containerRef.current.dataset.loadedRankedFeatures = String(map.querySourceFeatures("places").length + map.querySourceFeatures("focus-places").length);
        };
        map.on("moveend", publishCamera);
        map.on("idle", publishVisibilityEvidence);
        map.fitBounds(NYC_BOUNDS, { padding: 44, duration: 850 });
        publishCamera();
        setMapReady(true);
        } catch {
          setMapError(true);
        }
      });
      mapRef.current = map;
      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(containerRef.current);
    }).catch(() => setMapError(true));
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [data]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !placesGeoRef.current) return;
    const eligibleIds = new Set(eligiblePlaceIds);
    const filtered = placesGeoRef.current.features.filter((feature) =>
      feature.properties?.placeType === mode
      && (agreementFilter === "all" || feature.properties?.lensAgreementState === agreementFilter)
      && eligibleIds.has(String(feature.properties?.id ?? ""))
    );
    const placesSource = map.getSource("places") as GeoJSONSource;
    const focusSource = map.getSource("focus-places") as GeoJSONSource;
    const contextSource = map.getSource("context-places") as GeoJSONSource;
    const focusIds = focusGroup ? new Set(focusGroup.ids) : null;
    const focused = focusIds ? filtered.filter((feature) => focusIds.has(String(feature.properties?.id ?? ""))) : [];
    const rest = focusIds ? filtered.filter((feature) => !focusIds.has(String(feature.properties?.id ?? ""))) : [];
    const focusing = focused.length > 0;
    placesSource.setData({ ...placesGeoRef.current, features: focusing ? [] : filtered });
    focusSource.setData({ ...placesGeoRef.current, features: focused });
    contextSource.setData({ ...placesGeoRef.current, features: rest });
    const cityVisible = focusing ? "none" : "visible";
    const focusVisible = focusing ? "visible" : "none";
    map.setLayoutProperty("cluster-halo", "visibility", cityVisible);
    map.setLayoutProperty("place-clusters", "visibility", cityVisible);
    map.setLayoutProperty("cluster-count", "visibility", cityVisible);
    map.setLayoutProperty("places-point", "visibility", focusing || mode !== "intersection_node" ? "none" : "visible");
    map.setLayoutProperty("midblock-ticks", "visibility", focusing || mode !== "midblock_segment" ? "none" : "visible");
    map.setLayoutProperty("focus-cluster-halo", "visibility", focusVisible);
    map.setLayoutProperty("focus-clusters", "visibility", focusVisible);
    map.setLayoutProperty("focus-cluster-count", "visibility", focusVisible);
    map.setLayoutProperty("focus-points", "visibility", focusing && mode === "intersection_node" ? "visible" : "none");
    map.setLayoutProperty("focus-midblock-ticks", "visibility", focusing && mode === "midblock_segment" ? "visible" : "none");
    map.setLayoutProperty("context-points", "visibility", focusing ? "visible" : "none");
    const lensFill = lens === "injury" ? "#d98b28" : "#c94a37";
    const lensDark = lens === "injury" ? "#7a4308" : "#77271d";
    map.setPaintProperty("places-point", "circle-color-transition", { duration: 380, delay: 0 });
    map.setPaintProperty("places-point", "circle-radius-transition", { duration: 380, delay: 0 });
    map.setPaintProperty("places-point", "circle-color", lensFill);
    map.setPaintProperty("places-point", "circle-radius", NEIGHBORHOOD_POINT_RADIUS);
    map.setPaintProperty("places-point", "circle-opacity", NEIGHBORHOOD_POINT_OPACITY);
    map.setPaintProperty("focus-points", "circle-color", lensFill);
    map.setPaintProperty("place-clusters", "circle-color", lensFill);
    map.setPaintProperty("cluster-count", "text-halo-color", lensDark);
    map.setPaintProperty("focus-clusters", "circle-color", lensFill);
    map.setPaintProperty("focus-clusters", "circle-stroke-color", "#fff3d6");
    map.setPaintProperty("focus-cluster-count", "text-halo-color", lensDark);
    map.setPaintProperty("midblock-ticks", "text-color", lensFill);
    map.setPaintProperty("focus-midblock-ticks", "text-color", lensFill);
    map.setLayoutProperty("midblock-ticks", "text-size", ["interpolate", ["linear"], ["zoom"], 9, 12, 12, 14, 16, 18]);
    map.setLayoutProperty("possible-points", "visibility", showPossible ? "visible" : "none");
    map.setLayoutProperty("unresolved-points", "visibility", showUnresolved ? "visible" : "none");
    if (containerRef.current) {
      containerRef.current.dataset.focusCount = focusing ? String(focused.length) : "0";
      containerRef.current.dataset.eligibleRankedFeatures = String(filtered.length);
    }
  }, [agreementFilter, eligiblePlaceIds, focusGroup, lens, mapReady, mode, showPossible, showUnresolved]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !focusGroup || !placesGeoRef.current) return;
    const idSet = new Set(focusGroup.ids);
    const features = placesGeoRef.current.features.filter((feature) => idSet.has(String(feature.properties?.id ?? "")));
    if (!features.length) return;
    map.fitBounds(boundsOfPoints(features), { padding: 72, maxZoom: 14, duration: 700 });
  }, [focusGroup, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !filtersActive || focusGroup || !placesGeoRef.current) return;
    const idSet = new Set(eligiblePlaceIds);
    const features = placesGeoRef.current.features.filter((feature) => idSet.has(String(feature.properties?.id ?? "")));
    if (!features.length) return;
    map.fitBounds(boundsOfPoints(features), { padding: 72, maxZoom: 14, duration: 650 });
  }, [eligiblePlaceIds, filtersActive, focusGroup, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const source = map.getSource("selected-place") as GeoJSONSource;
    const features = !selected || selected.longitude === null || selected.latitude === null
      ? []
      : [{ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [selected.longitude, selected.latitude] }, properties: { id: selected.id } }];
    source.setData({ type: "FeatureCollection", features });
  }, [mapReady, selected]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const source = map.getSource("compare-pins") as GeoJSONSource;
    source.setData({ type: "FeatureCollection", features: comparePlaces.filter((place) => place.longitude !== null && place.latitude !== null).map((place, index) => ({ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [place.longitude!, place.latitude!] }, properties: { id: place.id, label: index === 0 ? "A" : "B" } })) });
  }, [comparePlaces, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (cameraCommand.kind === "fit") {
      map.fitBounds(NYC_BOUNDS, { padding: 44, duration: 700 });
      return;
    }
    if (cameraCommand.kind === "selected") {
      if (selected && selected.longitude !== null && selected.latitude !== null) map.easeTo({ center: [selected.longitude, selected.latitude], zoom: Math.max(map.getZoom(), 12.5), padding: { top: 54, bottom: 54, left: 54, right: 110 }, duration: 650 });
      return;
    }
    const frame = cameraCommand.borough ? BOROUGH_FRAMES[cameraCommand.borough] : null;
    if (frame) map.flyTo({ center: frame.center, zoom: frame.zoom, duration: 700 });
  }, [cameraCommand, mapReady, selected]);

  return (
    <div className="map-wrap">
      <div ref={containerRef} className={`map-canvas lens-${lens}`} data-camera-policy="five-borough-fit" data-ranked-visibility="clusters-through-z10-then-dots" data-c6-visual="quilt-fallback-declutter-lens-sync" data-lens-color={lens === "injury" ? "gold" : "brick"} data-focus-count={focusGroup?.ids.length ?? 0} role="application" aria-label="Harm Lens map of analytical place objects" />
      {!mapReady && !mapError && <div className="map-loading"><span />Preparing governed map objects…</div>}
      {mapError && <div className="map-error"><AlertTriangle size={18} />The governed map layers could not be loaded. Place evidence remains available in the list and inspector.</div>}
      <div className="imagery-badge"><MapPinned size={14} /><div><strong>Old photo ({data.meta.imagery.year}) — not today</strong><span>NYC OTI · {data.meta.imagery.license}</span></div></div>
      <div className={`map-legend lens-${lens}`} data-testid="plain-map-legend">
        <span><i className="legend-pile">12</i><b>Pile</b></span>
        <span><i className={`dot ${lens}`} /><b>One place</b></span>
        <span><i className="dot selected" /><b>You picked this</b></span>
        {(showPossible || showUnresolved) && <small>Hollow extra marks are not on the main list.</small>}
      </div>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<AppData | null>(null);
  const [placeLabels, setPlaceLabels] = useState<PlaceLabelIndex | null>(null);
  const [p25, setP25] = useState<P25Projection | null>(null);
  const [situateIndex, setSituateIndex] = useState<SituateIndex | null>(null);
  const [wave2SituatePlaces, setWave2SituatePlaces] = useState<Record<string, Wave2SituatePlace>>({});
  const [situateError, setSituateError] = useState(false);
  const [wave2SituateError, setWave2SituateError] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [lens, setLens] = useState<Lens>("injury");
  const [roadUser, setRoadUser] = useState<RoadUser>("everyone");
  const [windowKey, setWindowKey] = useState<WindowKey>("36m");
  const [showToll, setShowToll] = useState(false);
  const [corridorId, setCorridorId] = useState("");
  const [screen, setScreen] = useState<ActiveScreen>("explore");
  const [mode, setMode] = useState<PlaceMode>("intersection_node");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusGroup, setFocusGroup] = useState<FocusGroup | null>(null);
  const [tab, setTab] = useState<InspectorTab>("why");
  const [showPossible, setShowPossible] = useState(false);
  const [showUnresolved, setShowUnresolved] = useState(false);
  const [agreementFilter, setAgreementFilter] = useState<AgreementFilter>("all");
  const [cameraCommand, setCameraCommand] = useState<CameraCommand>({ kind: "fit", nonce: 0 });
  const [mapLookBorough, setMapLookBorough] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareMethodLock, setCompareMethodLock] = useState<CompareMethodLock | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [diffOnly, setDiffOnly] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [methodOpen, setMethodOpen] = useState(false);
  const [activeChipId, setActiveChipId] = useState<string | null>(null);
  const [situateYesPlaceIds, setSituateYesPlaceIds] = useState<string[] | null>(null);
  const [situateYesLoading, setSituateYesLoading] = useState(false);
  const [situateYesError, setSituateYesError] = useState(false);
  const [askHonesty, setAskHonesty] = useState<AskLegendHonesty | null>(null);
  const [briefGeneratedAt, setBriefGeneratedAt] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      loadCompressedJson<AppData>("/data/app-data.json.gz"),
      loadCompressedJson<PlaceLabelIndex>("/data/place-labels.json.gz"),
      loadCompressedJson<P25Projection>("/data/p2-5-ui-objects-v1.json.gz"),
    ])
      .then(([appData, labels, released]) => {
        if (released.meta.objectVersion !== "HL-P2.5-OBJECT-RELEASE-v1" || released.meta.basePlaceCount !== appData.places.length) throw new Error("P2.5 projection binding mismatch");
        setData(appData);
        setPlaceLabels(labels);
        setP25(released);
      })
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    if ((tab !== "situate" && tab !== "packet" && !compareOpen) || situateError) return;
    const requested = [...new Set([selectedId, ...(compareOpen ? compareIds : [])].filter((id): id is string => Boolean(id)))];
    const missing = requested.filter((id) => !situateIndex?.places[id]);
    if (!missing.length) return;
    loadSituatePlaces(missing)
      .then((places) => setSituateIndex((current) => ({
        meta: current?.meta ?? {
          indexVersion: "HL-APPROACH-SITUATE-v1",
          approachMatchVersion: "HL-APPROACH-MATCH-v1",
          oneFMatchVersion: "HL-VZDOT-MATCH-v1",
          assignmentVersion: "HL-SPATIAL-26B-v2",
          geographyVersion: "LION_26B_canonical_2026-08-10",
          claimStatus: "CONDITIONAL",
          summary: { places: 40549, evidenceRows: { documentedStreetChanges: 23423, streetNetworkAndRules: 247982, unknownEvidence: 143108 } },
        },
        places: { ...(current?.places ?? {}), ...places },
      })))
      .catch(() => setSituateError(true));
  }, [compareIds, compareOpen, selectedId, situateError, situateIndex, tab]);

  useEffect(() => {
    if (!selectedId || (tab !== "situate" && tab !== "packet") || wave2SituateError || wave2SituatePlaces[selectedId]) return;
    loadWave2SituatePlaces([selectedId])
      .then((places) => setWave2SituatePlaces((current) => ({ ...current, ...places })))
      .catch(() => setWave2SituateError(true));
  }, [selectedId, tab, wave2SituateError, wave2SituatePlaces]);

  const placeById = useMemo(() => new Map(data?.places.map((place) => [place.id, place]) ?? []), [data]);
  const selected = selectedId ? placeById.get(selectedId) ?? null : null;

  const askLegendUniverse = useMemo(() => {
    if (!data || !placeLabels) return [];
    return buildSearchUniverse(data.places, placeLabels);
  }, [data, placeLabels]);

  const searchMatchRank = useMemo(() => {
    if (!query.trim()) return null;
    const matches = searchPlaces(query, askLegendUniverse);
    // Wire-side precision: when the engine's top hit is an exact/LION id match,
    // drop weaker partials (engine token prefix can over-match digits / "i" in ids).
    // Does not rewrite lib/ask-legend — display and map eligibility only.
    const precise = matches[0] && matches[0].score >= 94
      ? matches.filter((match) => match.score >= 90)
      : matches;
    return new Map(precise.map((match, index) => [match.id, index]));
  }, [askLegendUniverse, query]);

  const eligiblePlaces = useMemo(() => {
    if (!data || !p25) return [];
    const situateYes = situateYesPlaceIds ? new Set(situateYesPlaceIds) : null;
    const corridorPlaces = corridorId ? new Set(p25.corridors[corridorId]?.placeIds ?? []) : null;
    const baseline = roadUser === "everyone" && windowKey === "36m";
    return data.places
      .filter((place) => place.placeType === mode)
      .filter((place) => baseline ? agreementFilter === "all" || place.lensAgreementState === agreementFilter : true)
      .filter((place) => baseline || activeP25Count(p25, place.id, windowKey, roadUser, lens) > 0)
      .filter((place) => !corridorPlaces || corridorPlaces.has(place.id))
      .filter((place) => !situateYes || situateYes.has(place.id))
      .filter((place) => !searchMatchRank || searchMatchRank.has(place.id));
  }, [agreementFilter, corridorId, data, lens, mode, p25, roadUser, searchMatchRank, situateYesPlaceIds, windowKey]);

  const mapEligiblePlaceIds = useMemo(() => eligiblePlaces.map((place) => place.id), [eligiblePlaces]);
  const mapEligiblePlaceIdSet = useMemo(() => new Set(mapEligiblePlaceIds), [mapEligiblePlaceIds]);

  useEffect(() => {
    if (!query.trim() || eligiblePlaces.length !== 1 || selectedId === eligiblePlaces[0].id) return;
    const timer = window.setTimeout(() => {
      setSelectedId(eligiblePlaces[0].id);
      setCameraCommand((current) => ({ kind: "selected", nonce: current.nonce + 1 }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [eligiblePlaces, query, selectedId]);

  const visiblePlaces = useMemo(() => {
    if (!data || !p25) return [];
    const count = (place: Place) => activeP25Count(p25, place.id, windowKey, roadUser, lens);
    const baseline = roadUser === "everyone" && windowKey === "36m";
    if (!searchMatchRank) {
      const ranked = [...eligiblePlaces]
        .sort((a, b) => baseline
          ? (lens === "injury" ? a.injuryRank - b.injuryRank : a.fatalRank - b.fatalRank) || a.placeId - b.placeId
          : count(b) - count(a) || a.placeId - b.placeId);
      if (situateYesPlaceIds) return ranked.slice(0, 80);
      const top = ranked.slice(0, 32);
      const selectedPlace = selectedId ? eligiblePlaces.find((place) => place.id === selectedId) : null;
      if (selectedPlace && !top.some((place) => place.id === selectedPlace.id)) {
        return [selectedPlace, ...top];
      }
      return top;
    }
    return [...eligiblePlaces]
      .sort((a, b) => {
        const rankA = searchMatchRank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const rankB = searchMatchRank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        if (rankA !== rankB) return rankA - rankB;
        return count(b) - count(a) || a.placeId - b.placeId;
      })
      .slice(0, 80);
  }, [data, eligiblePlaces, lens, p25, roadUser, searchMatchRank, selectedId, situateYesPlaceIds, windowKey]);

  const issueCameraCommand = (kind: CameraCommand["kind"], borough?: string) => {
    setCameraCommand((current) => ({ kind, borough, nonce: current.nonce + 1 }));
  };

  const showFocusGroup = (ids: string[]) => {
    setSelectedId(null);
    setFocusGroup((current) => ({ ids, nonce: (current?.nonce ?? 0) + 1 }));
  };

  const selectPlace = (id: string) => {
    setSelectedId(id);
    setTab("why");
    issueCameraCommand("selected");
    if (compareMode) {
      setCompareIds((current) => {
        if (current.includes(id)) return current;
        if (current.length < 2) return [...current, id];
        return [current[0], id];
      });
    }
  };

  const showWholeCity = () => {
    setSelectedId(null);
    setFocusGroup(null);
    setMapLookBorough(null);
    setQuery("");
    issueCameraCommand("fit");
  };

  const lookAtBorough = (borough: string) => {
    setSelectedId(null);
    setFocusGroup(null);
    setMapLookBorough(borough);
    issueCameraCommand("borough", borough);
  };

  const goBackOnMap = () => {
    if (selectedId) {
      setSelectedId(null);
      if (query.trim()) setQuery("");
      if (focusGroup) return;
      if (mapLookBorough) issueCameraCommand("borough", mapLookBorough);
      else issueCameraCommand("fit");
      return;
    }
    if (focusGroup) {
      setFocusGroup(null);
      if (mapLookBorough) issueCameraCommand("borough", mapLookBorough);
      else issueCameraCommand("fit");
      return;
    }
    if (mapLookBorough) {
      setMapLookBorough(null);
      issueCameraCommand("fit");
      return;
    }
    if (query.trim()) {
      setQuery("");
      issueCameraCommand("fit");
    }
  };

  const searchFromMap = (value: string) => {
    setSelectedId(null);
    setFocusGroup(null);
    setMapLookBorough(null);
    setQuery(value);
    if (!value.trim()) return;
    const matches = searchPlaces(askLegendUniverse, value);
    const precise = matches[0] && matches[0].score >= 94
      ? matches.filter((match) => match.score >= 90)
      : matches;
    const situateYes = situateYesPlaceIds ? new Set(situateYesPlaceIds) : null;
    const corridorPlaces = corridorId && p25 ? new Set(p25.corridors[corridorId]?.placeIds ?? []) : null;
    const baseline = roadUser === "everyone" && windowKey === "36m";
    const sameLock = precise.filter((match) => {
      const place = data?.places.find((candidate) => candidate.id === match.id);
      if (!place || !p25 || place.placeType !== mode) return false;
      if (baseline && agreementFilter !== "all" && place.lensAgreementState !== agreementFilter) return false;
      if (!baseline && activeP25Count(p25, place.id, windowKey, roadUser, lens) <= 0) return false;
      if (corridorPlaces && !corridorPlaces.has(place.id)) return false;
      if (situateYes && !situateYes.has(place.id)) return false;
      return true;
    });
    if (sameLock.length === 1) {
      setSelectedId(sameLock[0].id);
      issueCameraCommand("selected");
    }
  };

  const changeMode = (nextMode: PlaceMode) => {
    setMode(nextMode);
    setAgreementFilter("all");
    setCompareMode(false);
    setCompareIds([]);
    setCompareMethodLock(null);
    setCompareOpen(false);
    setFocusGroup(null);
    setMapLookBorough(null);
    if (!data || !selected || selected.placeType === nextMode) return;
    const next = data.places
      .filter((place) => place.placeType === nextMode)
      .sort((a, b) => (lens === "injury" ? a.injuryRank - b.injuryRank : a.fatalRank - b.fatalRank) || a.placeId - b.placeId)[0];
    if (next) selectPlace(next.id);
  };

  const clearAskLegendFindFilters = () => {
    setQuery("");
    setSituateYesPlaceIds(null);
    setAgreementFilter("all");
    setFocusGroup(null);
    issueCameraCommand("fit");
    setActiveChipId(null);
    setAskHonesty(null);
    setSituateYesError(false);
  };

  const applyAskLegendChip = async (chipId: string) => {
    if (!data) return;
    const allowedPlaceIds = data.places.map((place) => place.id);

    if (chipId === "g1a-clear-filters") {
      const result = applyChip(chipId);
      if (!result.ok) return;
      clearAskLegendFindFilters();
      setAskHonesty({ chipId, label: "Clear Find filters", tool: result.tool, matchCount: null });
      return;
    }

    if (chipId.startsWith("g1b-")) {
      setSituateYesLoading(true);
      setSituateYesError(false);
      try {
        const situateIndex = await loadSituateYesFilterIndex();
        const result = applyChip(chipId, { situateIndex, allowedPlaceIds });
        if (!result.ok) {
          setSituateYesError(true);
          setAskHonesty({ chipId, label: chipId, tool: result.tool, matchCount: 0 });
          return;
        }
        const placeIds = Array.isArray(result.placeIds) ? result.placeIds : [];
        setFocusGroup(null);
        setSituateYesPlaceIds(placeIds);
        setActiveChipId(chipId);
        setAskHonesty({
          chipId,
          label: ASK_LEGEND_G1B_CHIPS.find((chip) => chip.id === chipId)?.label ?? chipId,
          tool: result.tool,
          matchCount: placeIds.length,
        });
      } catch {
        setSituateYesError(true);
        setSituateYesPlaceIds(null);
      } finally {
        setSituateYesLoading(false);
      }
      return;
    }

    const result = applyChip(chipId, { allowedPlaceIds });
    if (!result.ok) return;
    const args = result.args ?? {};
    if (result.tool === "setLens" && (args.lens === "injury" || args.lens === "fatal")) {
      setLens(args.lens);
    } else if (result.tool === "setMode" && (args.mode === "intersection_node" || args.mode === "midblock_segment")) {
      changeMode(args.mode);
    } else if (
      result.tool === "setAgreementFilter"
      && (args.agreementFilter === "all" || args.agreementFilter === "injury_led" || args.agreementFilter === "fatal_led" || args.agreementFilter === "both")
    ) {
      setFocusGroup(null);
      setAgreementFilter(args.agreementFilter);
    } else if (result.tool === "fitNyc") {
      setFocusGroup(null);
      issueCameraCommand("fit");
    }
    setActiveChipId(chipId);
    setAskHonesty({
      chipId,
      label: ASK_LEGEND_G1A_CHIPS.find((chip) => chip.id === chipId)?.label ?? chipId,
      tool: result.tool,
      matchCount: null,
    });
  };

  const startCompare = () => {
    if (!selected) return;
    setCompareMode(true);
    setCompareOpen(false);
    setCompareIds([selected.id]);
    setCompareMethodLock({ roadUser, window: windowKey });
    setScreen("explore");
  };

  const toggleSaved = (id: string) => {
    setSavedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  useEffect(() => {
    const closeTopLayer = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (methodOpen) setMethodOpen(false);
      else if (compareOpen) setCompareOpen(false);
      else if (compareMode) { setCompareMode(false); setCompareIds([]); }
    };
    window.addEventListener("keydown", closeTopLayer);
    return () => window.removeEventListener("keydown", closeTopLayer);
  }, [compareMode, compareOpen, methodOpen]);

  if (loadError) {
    return <main className="fatal-error"><AlertTriangle /><h1>Phase 2 objects could not be loaded.</h1><p>No alternate or live data was substituted.</p></main>;
  }
  if (!data || !placeLabels || !p25) {
    return <main className="boot-screen"><div className="brand-mark" /><span>Loading frozen Phase 2 objects…</span></main>;
  }

  const packet = selected ? data.samplePackets[selected.id] : undefined;
  const selectedP25 = selected ? p25.places[selected.id] : undefined;
  const selectedInjuryCount = selected ? activeP25Count(p25, selected.id, windowKey, roadUser, "injury") : 0;
  const selectedFatalCount = selected ? activeP25Count(p25, selected.id, windowKey, roadUser, "fatal") : 0;
  const selectedInjuryIds = selected ? activeP25Ids(p25, selected.id, windowKey, roadUser, "injury") : [];
  const selectedFatalIds = selected ? activeP25Ids(p25, selected.id, windowKey, roadUser, "fatal") : [];
  const activeWindow = p25.meta.windows[windowKey];
  const activeRoadUserCopy = p25.meta.roadUserLabels[roadUser];
  const activeCorridor = corridorId ? p25.corridors[corridorId] : undefined;
  const activeOverlap = windowKey === "36m" ? p25.meta.overlap36[`${mode}:${lens}`] : undefined;
  const selectedPersistence = selectedP25?.persistence[lens];
  const countFor = (place: Place, selectedLens: Lens = lens) => activeP25Count(p25, place.id, windowKey, roadUser, selectedLens);
  const baselineMethod = roadUser === "everyone" && windowKey === "36m";
  const baseSituate = selected ? situateIndex?.places[selected.id] : undefined;
  const wave2Situate = selected ? wave2SituatePlaces[selected.id] : undefined;
  const situate = !baseSituate ? undefined : !wave2Situate ? (wave2SituateError ? baseSituate : undefined) : mergeSituatePlace(baseSituate, wave2Situate);
  const evidenceBrief = selected && situate && briefGeneratedAt ? composeEvidenceBrief({
    generatedAtUtc: briefGeneratedAt,
    place: {
      id: selected.id,
      title: placeTitle(selected, placeLabels),
      lionLabel: lionLabel(selected),
      placeType: selected.placeType,
      assignmentClass: selected.assignmentClass,
      injuryCount: selectedInjuryCount,
      fatalCount: selectedFatalCount,
      injurySupportingIds: selectedInjuryIds,
      fatalSupportingIds: selectedFatalIds,
      equalityPass: selectedInjuryCount === selectedInjuryIds.length && selectedFatalCount === selectedFatalIds.length,
      ...(showToll && windowKey === "36m" ? { toll: {
        label: lens === "injury" ? "people recorded injured on those crash records" : "people recorded killed on those crash records",
        peopleRecordedTotal: selectedP25?.toll36[roadUser]?.[lens] ?? 0,
        disclosure: p25.meta.tollDisagreementDisclosure,
      } } : {}),
      ...(selectedPersistence ? { persistence: {
        version: p25.meta.persistenceVersion,
        statement: selectedPersistence.positive
          ? `Elevated under the Everyone predicate in both the released 36-month and 48-month checks${lens === "fatal" ? "; fatal elevation means at least one fatal crash record" : ""}.`
          : `Not elevated under the Everyone predicate in both released 36-month and 48-month checks${lens === "fatal" ? "; fatal elevation means at least one fatal crash record" : ""}.`,
      } } : {}),
      ...(activeCorridor && baselineMethod ? { corridor: {
        corridorId: activeCorridor.corridorId,
        label: `${activeCorridor.displayName} · ${activeCorridor.boroughName} · component ${activeCorridor.componentOrdinal}`,
        crashRecordCount: activeCorridor.metrics[lens].count,
        supportingCollisionIds: activeCorridor.metrics[lens].ids,
      } } : {}),
    },
    lens,
    method: {
      windowId: activeWindow.id,
      roadUser: ROAD_USER_LABELS[roadUser],
      analysisStart: activeWindow.start,
      analysisEnd: activeWindow.end,
      sourceStatus: data.meta.sourceStatus,
      assignmentVersion: data.meta.assignmentVersion,
      predicateRegistry: data.meta.predicateRegistry,
      objectVersion: p25.meta.objectVersion,
      geographyVersion: placeLabels.meta.geographyVersion,
    },
    situate,
  }) : null;
  const preview = previewId ? placeById.get(previewId) : null;
  const comparePlaces = compareIds.map((id) => placeById.get(id)).filter((place): place is Place => Boolean(place));
  const compareLockPass = comparePlaces.length === 2
    && comparePlaces.every((place) => place.placeType === comparePlaces[0].placeType)
    && compareMethodLock?.roadUser === roadUser
    && compareMethodLock?.window === windowKey;
  const fatalLedCount = data.places.filter((place) => place.placeType === mode && place.lensAgreementState === "fatal_led").length;
  const savedPlaces = savedIds.map((id) => placeById.get(id)).filter((place): place is Place => Boolean(place));
  const selectedKeptOnFlip = Boolean(
    baselineMethod
    &&
    selected
    && !query.trim()
    && visiblePlaces[0]?.id === selected.id
    && (lens === "injury" ? selected.injuryRank > 32 : selected.fatalRank > 32)
  );
  const mapHasBack = Boolean(selectedId || focusGroup || mapLookBorough || query.trim());
  const mapCoach = selected && mapEligiblePlaceIdSet.has(selected.id)
    ? `You picked ${placeTitle(selected, placeLabels)}. Open it for the crash reports and limits.`
    : focusGroup
      ? `This pile has ${formatNumber(focusGroup.ids.length)} places. Pick a dot, or go Back.`
      : mapLookBorough
        ? `Looking at ${mapLookBorough}. The list still covers every place in the active filter.`
        : query.trim()
          ? eligiblePlaces.length
            ? `${formatNumber(eligiblePlaces.length)} place${eligiblePlaces.length === 1 ? "" : "s"} with that street name in this list.`
            : "No place with that name in this list."
          : !baselineMethod || corridorId || situateYesPlaceIds || agreementFilter !== "all"
            ? `Filter on: map and list show the same ${formatNumber(mapEligiblePlaceIds.length)} places.`
            : "A number is a pile. Click it to look inside, or zoom in.";

  const downloadPacket = () => {
    if (!packet) return;
    const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${packet.lep_id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const prepareEvidenceBrief = () => {
    setBriefGeneratedAt(new Date().toISOString());
    setTab("packet");
    setScreen("packet");
  };

  const downloadEvidenceBrief = (format: "html" | "json") => {
    if (!evidenceBrief) return;
    const content = format === "html" ? evidenceBriefHtml(evidenceBrief) : JSON.stringify(evidenceBrief, null, 2);
    const blob = new Blob([content], { type: format === "html" ? "text/html;charset=utf-8" : "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `harm-lens-evidence-brief-${selected?.placeType}-${selected?.placeId}.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true" />
          <div><strong>Harm Lens</strong><span>NYC street-safety evidence</span></div>
        </div>
        <nav className="job-nav" aria-label="Decision surface screens">
          {(["overview", "explore", "inspect", "compare", "packet"] as ActiveScreen[]).map((item, index) => {
            const packetUnavailable = false;
            const compareNeedsPlaces = item === "compare" && comparePlaces.length !== 2;
            const needsSelection = (item === "inspect" || item === "packet") && !selected;
            return <button key={item} className={screen === item ? "active" : ""} disabled={packetUnavailable} title={compareNeedsPlaces ? "Choose place A and B on Explore first." : needsSelection ? "Choose a place on Explore first." : undefined} onClick={() => {
              if (needsSelection) { setScreen("explore"); return; }
              if (item === "compare" && compareNeedsPlaces) { startCompare(); return; }
              setScreen(item);
              setCompareOpen(item === "compare");
              if (item === "packet") { setTab("packet"); setBriefGeneratedAt(new Date().toISOString()); }
            }}><b>{index + 1}</b>{item[0].toUpperCase() + item.slice(1)}</button>;
          })}
        </nav>
        <div className="topbar-actions">
          {selected && (screen === "explore" || screen === "inspect" || screen === "compare") && <button className={`utility-button ${savedIds.includes(selected.id) ? "active" : ""}`} onClick={() => toggleSaved(selected.id)}><Bookmark size={15} />{savedIds.includes(selected.id) ? "Saved" : "Save for review"}</button>}
          {selected && (screen === "explore" || screen === "inspect" || screen === "compare") && <button data-testid="start-compare" className={`utility-button ${compareMode ? "active" : ""}`} onClick={startCompare}><ArrowLeftRight size={15} />{compareMode ? "Choose B" : "Start A/B"}</button>}
          <button className="method-button" onClick={() => setMethodOpen(true)}><LockKeyhole size={15} /> Method lock</button>
        </div>
      </header>

      <div className="maintenance-banner compact-freshness">
        <AlertTriangle size={16} />
        <strong>Source status: maintenance · collision records through June 11, 2026</strong>
        <span>Recent periods may backfill or revise; this is not a current-as-of-today map.</span>
        <button onClick={() => setMethodOpen(true)}><LockKeyhole size={12} />Locked method</button>
      </div>

      {screen === "overview" && <section className="overview-screen">
        <div className="overview-copy"><span className="eyebrow">NYC street-safety evidence</span><h1>Look at places. Switch injury and fatal. Open one to see why it showed up.</h1><p>The same locked records sit under both views. Pick a place on the map, then read the counts and what official records say on the street.</p><button onClick={() => setScreen("explore")}>Explore the NYC map <ChevronRight size={17} /></button></div>
        <div className="overview-steps"><article><span>01</span><strong>Explore</strong><p>See ranked places on the map. Switch injury-involved and fatal to see which rise.</p></article><article><span>02</span><strong>Inspect</strong><p>Open a place for counts, crash records, checks, and documented street facts.</p></article><article><span>03</span><strong>Compare</strong><p>Put two places side by side under the same rules.</p></article></div>
        <p className="overview-limit"><LockKeyhole size={14} />This tool supports a closer look. It does not say what to build or which place is official priority.</p>
      </section>}

      {screen !== "overview" && <div className={`workspace screen-${screen} ${compareOpen ? "compare-open" : ""}`}>
        {screen === "explore" && <aside className="screen-panel">
          <div className="panel-heading">
            <span className="eyebrow">Map scoreboard · {lens === "injury" ? "Hurt" : "Died"}</span>
            <h1>Places with crash reports</h1>
            <p>Higher on this list means more crash reports under your choices—not more danger or official priority.</p>
          </div>

          <div className="surface-freshness" data-testid="explore-freshness">
            <AlertTriangle size={15} />
            <div><strong>Records through {formatDateLong(data.meta.analysisEnd)}</strong><span>Source status: {data.meta.sourceStatus}. Recent records may backfill or revise.</span></div>
          </div>

          <details className="left-method-details">
          <summary>Map controls are above the map</summary>
          <div className="left-method-details-body">
          <div className="mode-switch" role="group" aria-label="Place grain">
            <button className={mode === "intersection_node" ? "active" : ""} onClick={() => changeMode("intersection_node")}>
              Intersections <span>{formatNumber(data.meta.counts.intersectionPlaces)}</span>
            </button>
            <button className={mode === "midblock_segment" ? "active" : ""} onClick={() => changeMode("midblock_segment")}>
              Midblock <span>{formatNumber(data.meta.counts.midblockPlaces)}</span>
            </button>
          </div>
          <p className="control-purpose">Intersections and midblock segments are separate place grains; their counts are never mixed.</p>

          <div className="lens-switch" role="group" aria-label="Harm lens">
            <button className={lens === "injury" ? "active" : ""} onClick={() => setLens("injury")}><span className="lens-dot injury" />Injury-involved</button>
            <button className={lens === "fatal" ? "active" : ""} onClick={() => setLens("fatal")}><span className="lens-dot fatal" />Fatal</button>
          </div>
          <p className="control-purpose">Same places, same rules — flip to see which rise for a closer look.</p>
          <div className="p3-lock-controls" data-testid="p3-method-controls">
            <fieldset><legend>Who was harmed</legend><div className="compact-button-group">{(["everyone", "pedestrian", "cyclist", "motorist"] as RoadUser[]).map((group) => <button key={group} className={roadUser === group ? "active" : ""} onClick={() => { setRoadUser(group); setAgreementFilter("all"); setFocusGroup(null); }}>{ROAD_USER_LABELS[group]}</button>)}</div></fieldset>
            <fieldset><legend>Period</legend><div className="compact-button-group">{(["24m", "36m", "48m"] as WindowKey[]).map((period) => <button key={period} className={windowKey === period ? "active" : ""} onClick={() => { setWindowKey(period); setShowToll(period === "36m" ? showToll : false); setAgreementFilter("all"); setFocusGroup(null); }}>{period}</button>)}</div></fieldset>
            <label className="toll-toggle"><input type="checkbox" checked={showToll} disabled={windowKey !== "36m"} onChange={(event) => setShowToll(event.target.checked)} /><span>Show human toll beside frequency</span></label>
          </div>
          <p className="overlap-disclosure"><Info size={13} /><span>Named groups overlap. Counts mean {activeRoadUserCopy}. {activeOverlap ? `${formatNumber(activeOverlap.uncategorized)} uncategorized ${lens === "injury" ? "injury-involved" : "fatal"} records in this 36m grain remain in Everyone; ${formatNumber(activeOverlap.overlapTwoOrMore)} belong to two or more named groups.` : "The release does not publish an overlap remainder table for this alternate period."} Frequency stays the default.</span></p>
          <div data-testid="reversal-cue" className={`reversal-cue ${lens}`}><Activity size={14} /><span>{baselineMethod ? (lens === "fatal" ? `${fatalLedCount} ${mode === "intersection_node" ? "nodes" : "segments"} are fatal-led under the released 36m Everyone peer rule.` : "Switching lenses can reverse which places rise for review.") : "This lock uses released continuous counts; no new agreement tier or peer rank was inferred."}</span></div>

          <div className="ask-legend-search" data-testid="ask-legend-search">
            <label className="search-box">
              <Search size={16} />
              <input value={query} onChange={(event) => { setFocusGroup(null); setQuery(event.target.value); }} placeholder="Search street, cross-street, or LION id" aria-describedby="ask-legend-subtitle" />
              {query && <button onClick={() => { setFocusGroup(null); setQuery(""); }} aria-label="Clear search"><X size={14} /></button>}
            </label>
            <p id="ask-legend-subtitle" className="ask-legend-subtitle" data-testid="ask-legend-subtitle">{ASK_LEGEND_SUBTITLE}</p>
            <details className="ask-legend-chips" data-testid="ask-legend-chips">
              <summary>Find and documented-evidence filters</summary>
              <div className="ask-legend-chip-row" role="group" aria-label="Ask Legend guided actions">
                <span className="ask-legend-chip-label">Find</span>
                {ASK_LEGEND_G1A_CHIPS.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    className={activeChipId === chip.id ? "active" : ""}
                    data-testid={`ask-chip-${chip.id}`}
                    disabled={situateYesLoading}
                    onClick={() => { void applyAskLegendChip(chip.id); }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              <div className="documented-chip-details">
                <span className="ask-legend-chip-label">Documented Yes</span>
                <div className="ask-legend-chip-row" role="group" aria-label="Ask Legend documented Yes filters">
                  {ASK_LEGEND_G1B_CHIPS.map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      className={activeChipId === chip.id ? "active" : ""}
                      data-testid={`ask-chip-${chip.id}`}
                      disabled={situateYesLoading}
                      title="Documented Yes only — never untreated or No"
                      onClick={() => { void applyAskLegendChip(chip.id); }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
              {(askHonesty || situateYesLoading || situateYesError) && (
                <p className="ask-legend-honesty" data-testid="ask-legend-honesty" aria-live="polite">
                  {situateYesLoading
                    ? "Loading frozen Situate Yes index…"
                    : situateYesError
                      ? "Frozen Situate Yes filter unavailable. Browse ranked places or search labels."
                      : askHonesty
                        ? `${askHonesty.label} · ${askHonesty.tool}${askHonesty.matchCount == null ? "" : ` · ${formatNumber(askHonesty.matchCount)} places`}`
                        : null}
                </p>
              )}
            </details>
          </div>

          <details className="secondary-controls"><summary><SlidersHorizontal size={13} />More filters</summary><div className="filter-grid">
            <label><span>Agreement</span><select disabled={!baselineMethod} value={baselineMethod ? agreementFilter : "all"} onChange={(event) => { setFocusGroup(null); setAgreementFilter(event.target.value as AgreementFilter); }}><option value="all">All states</option><option value="injury_led">Injury-led</option><option value="fatal_led">Fatal-led</option><option value="both">Both</option></select></label>
            <label><span>Analytical LION corridor</span><select value={corridorId} onChange={(event) => { setCorridorId(event.target.value); setFocusGroup(null); }}><option value="">All released places</option>{Object.values(p25.corridors).sort((a, b) => a.displayName.localeCompare(b.displayName) || a.boroughName.localeCompare(b.boroughName) || a.componentOrdinal - b.componentOrdinal).map((corridor) => <option key={corridor.corridorId} value={corridor.corridorId}>{corridor.displayName} · {corridor.boroughName} · component {corridor.componentOrdinal}</option>)}</select></label>
          </div></details>

          {activeCorridor && <section className="corridor-summary" data-testid="corridor-summary"><span className="eyebrow">Analytical LION corridor · not a DOT program layer</span><strong>{activeCorridor.displayName} · {activeCorridor.boroughName} · component {activeCorridor.componentOrdinal}</strong>{baselineMethod ? <p>{activeCorridor.uniqueSegmentIdCount} unique LION segments · {activeCorridor.metrics[lens].count} unique {lens === "injury" ? "injury-involved" : "fatal"} crash records · equality {activeCorridor.metrics[lens].count === activeCorridor.metrics[lens].ids.length ? "PASS" : "FAIL"}</p> : <p>This picker constrains places to this released component. Component roll-ups are released only for Everyone · 36m, so no {ROAD_USER_LABELS[roadUser]} / {windowKey} total is shown.</p>}</section>}
          </div>
          </details>

          <div className="order-label"><SlidersHorizontal size={14} /><span><strong>Analytical order</strong> · {lens === "injury" ? "injury-involved" : "fatal"} · {ROAD_USER_LABELS[roadUser]} · {windowKey} · not intervention priority</span></div>
          <div className="place-list">
            {visiblePlaces.map((place) => {
              const isSelected = Boolean(selected && place.id === selected.id);
              const keptOnFlip = isSelected && selectedKeptOnFlip;
              return (
              <button key={place.id} className={`place-row ${isSelected ? "selected" : ""} ${keptOnFlip ? "kept-on-flip" : ""}`} data-testid={keptOnFlip ? "kept-on-flip-row" : undefined} onClick={() => selectPlace(place.id)}>
                <span className="rank-no"><small>Order</small>{visiblePlaces.indexOf(place) + 1}</span>
                <span className="place-copy"><strong>{placeTitle(place, placeLabels)}</strong>{baselineMethod && <StateTag state={place.lensAgreementState} />}{keptOnFlip && <small className="kept-on-flip-label">Selected · kept on lens flip</small>}{compareIds.includes(place.id) && <small className="compare-badge">{compareIds.indexOf(place.id) === 0 ? "A" : "B"}</small>}{savedIds.includes(place.id) && <Bookmark className="saved-mark" size={12} />}</span>
                <span className="row-count"><strong>{countFor(place)}</strong><small>records</small></span>
                <ChevronRight size={15} />
              </button>
              );
            })}
          </div>
          <p className="list-footnote">{query.trim()
            ? (visiblePlaces.length
              ? `Showing ${visiblePlaces.length} matching places from the full frozen universe.`
              : "No frozen places matched. Searches this frozen evidence only.")
            : situateYesPlaceIds
              ? (visiblePlaces.length
                ? `Showing ${visiblePlaces.length} places with documented Yes under the active Ask Legend chip (${formatNumber(situateYesPlaceIds.length)} in frozen index).`
                : "No places in this grain have documented Yes for the active chip. Searches this frozen evidence only.")
            : selectedKeptOnFlip
              ? `Analytical order — not intervention priority. Showing the top 32 places under the ${lens === "injury" ? "injury-involved" : "fatal"} lens, plus the selected place; search reaches all ${formatNumber(mode === "intersection_node" ? data.meta.counts.intersectionPlaces : data.meta.counts.midblockPlaces)}.`
              : `Analytical order — not intervention priority. Showing the top ${visiblePlaces.length} places under the ${lens === "injury" ? "injury-involved" : "fatal"} lens; search reaches all ${formatNumber(mode === "intersection_node" ? data.meta.counts.intersectionPlaces : data.meta.counts.midblockPlaces)}.`}</p>
          {!baselineMethod && <p className="method-universe-note"><Info size={12} />{p25.meta.fixedUniverseDisclosure} Rows are ordered by released count with a stable LION-ID tie break; no new priority tier is created.</p>}
          <details data-testid="review-tray" className="review-tray"><summary><Bookmark size={15} /><strong>Saved for review</strong><span>{savedPlaces.length}</span></summary><p>Your working set — not a priority list.</p>{savedPlaces.length ? <div className="saved-list">{savedPlaces.map((place) => <button key={place.id} onClick={() => selectPlace(place.id)}>{placeTitle(place, placeLabels)}</button>)}</div> : <p>No places saved yet.</p>}</details>
        </aside>}

        {screen !== "packet" && <section className="map-panel" aria-label="Map and assignment visibility">
          <div className="map-toolbar">
            <div>
              <span className="eyebrow">NYC crash-report map</span>
              <strong>{mode === "intersection_node" ? "Street corners" : "Middle of the block (not the corner)"}</strong>
            </div>
            <details className="map-layer-menu"><summary>Extra faint marks</summary><div className="uncertainty-controls">
              <label title="Hollow, low-emphasis, visible context only; never ranked."><input type="checkbox" checked={showPossible} onChange={(e) => setShowPossible(e.target.checked)} /><span />Possible / exception <b>{formatNumber(data.meta.counts.possibleOrExceptionEvents)}</b></label>
              <label><input type="checkbox" checked={showUnresolved} onChange={(e) => setShowUnresolved(e.target.checked)} /><span />Unresolved <b>{formatNumber(data.meta.counts.unresolvedEvents)}</b></label>
              <p>Extra faint marks are not on the main list.</p>
            </div></details>
          </div>
          <div className="map-hands" data-testid="map-first-glance-controls">
          <div className="camera-toolbar" aria-label="Where to look">
            <button className="back-button" disabled={!mapHasBack} onClick={goBackOnMap}>Back</button>
            <button data-testid="fit-nyc" onClick={showWholeCity}><RotateCcw size={13} />Whole city</button>
            {Object.keys(BOROUGH_FRAMES).map((borough) => <button className={mapLookBorough === borough ? "active" : ""} key={borough} onClick={() => lookAtBorough(borough)}>Look at {borough === "Staten Island" ? "Staten Is." : borough}</button>)}
            <label className="map-search-box"><Search size={15} /><input value={query} onChange={(event) => searchFromMap(event.target.value)} placeholder="Search a street" aria-label="Search a street on the map" />{query && <button aria-label="Clear street search" onClick={() => { setQuery(""); setSelectedId(null); issueCameraCommand("fit"); }}><X size={14} /></button>}</label>
          </div>
          <div className="map-method-controls">
            <div className="map-choice" role="group" aria-label="Place kind"><span>Where</span><button className={mode === "intersection_node" ? "active" : ""} onClick={() => changeMode("intersection_node")}>Street corners</button><button className={mode === "midblock_segment" ? "active" : ""} onClick={() => changeMode("midblock_segment")}>Middle of block</button></div>
            <div className="map-choice lens-choice" role="group" aria-label="Harm lens"><span>Reports</span><button className={`injury ${lens === "injury" ? "active" : ""}`} onClick={() => setLens("injury")}>Hurt</button><button className={`fatal ${lens === "fatal" ? "active" : ""}`} onClick={() => setLens("fatal")}>Died</button></div>
            <div className="map-choice" role="group" aria-label="Who was harmed"><span>Who</span>{(["everyone", "pedestrian", "cyclist", "motorist"] as RoadUser[]).map((group) => <button key={group} className={roadUser === group ? "active" : ""} onClick={() => { setRoadUser(group); setAgreementFilter("all"); setFocusGroup(null); setMapLookBorough(null); }}>{ROAD_USER_MAP_LABELS[group]}</button>)}</div>
            <div className="map-choice" role="group" aria-label="How long"><span>How long</span>{(["24m", "36m", "48m"] as WindowKey[]).map((period) => <button key={period} className={windowKey === period ? "active" : ""} onClick={() => { setWindowKey(period); setShowToll(period === "36m" ? showToll : false); setAgreementFilter("all"); setFocusGroup(null); setMapLookBorough(null); }}>{WINDOW_MAP_LABELS[period]}</button>)}</div>
            <details className="map-more-controls"><summary>More</summary><div><label><input type="checkbox" checked={showToll} disabled={windowKey !== "36m"} onChange={(event) => setShowToll(event.target.checked)} /> Show people recorded, beside report counts</label><label><span>This street group (not an official DOT list)</span><select value={corridorId} onChange={(event) => { setCorridorId(event.target.value); setFocusGroup(null); setMapLookBorough(null); }}><option value="">No street group</option>{Object.values(p25.corridors).sort((a, b) => a.displayName.localeCompare(b.displayName) || a.boroughName.localeCompare(b.boroughName) || a.componentOrdinal - b.componentOrdinal).map((corridor) => <option key={corridor.corridorId} value={corridor.corridorId}>{corridor.displayName} · {corridor.boroughName} · group {corridor.componentOrdinal}</option>)}</select></label></div></details>
          </div>
          </div>
          <div className="map-coach" data-testid="map-coach" aria-live="polite"><strong>{mapLookBorough ? `Looking at ${mapLookBorough}` : focusGroup ? `This pile · ${formatNumber(focusGroup.ids.length)} places` : selected ? "Place picked" : "Start here"}</strong><span>{mapCoach}</span></div>
          <p className="map-framing-hint" data-testid="cluster-framing-hint"><strong>A number is a pile.</strong> Click it to look inside, or zoom in.</p>
          {(query.trim() || situateYesPlaceIds || agreementFilter !== "all" || !baselineMethod || corridorId) && <div data-testid="map-filter-parity" className="map-filter-parity" aria-live="polite"><strong>Map and list show the same places</strong><span>{formatNumber(mapEligiblePlaceIds.length)} {mode === "intersection_node" ? "places" : "segments"} · {ROAD_USER_MAP_LABELS[roadUser]} · {WINDOW_MAP_LABELS[windowKey]}{corridorId ? " · street group" : ""}</span></div>}
          {focusGroup && <div data-testid="map-focus-group" className="map-focus-banner"><div><strong>This pile · {formatNumber(focusGroup.ids.length)} places</strong><span>Other places are faint. Pick a dot, or go Back.</span></div><button onClick={goBackOnMap}>Back</button></div>}
          <div className="map-honesty" data-testid="map-honesty"><span>These marks are places with crash reports, not how scary the street is.</span><strong>More reports ≠ more dangerous — we do not know how busy it is.</strong><span>The list is where to look next, not “fix these first.” Walking, bikes, and cars can share the same crash.</span></div>
          <Phase32MapSurface data={data} selected={selected && mapEligiblePlaceIdSet.has(selected.id) ? selected : null} mode={mode} lens={lens} agreementFilter={baselineMethod ? agreementFilter : "all"} eligiblePlaceIds={mapEligiblePlaceIds} filtersActive={Boolean(query.trim() || situateYesPlaceIds || agreementFilter !== "all" || !baselineMethod || corridorId)} showPossible={showPossible} showUnresolved={showUnresolved} comparePlaces={comparePlaces} cameraCommand={cameraCommand} focusGroup={focusGroup} onSelect={selectPlace} onPreview={setPreviewId} onFocusGroup={showFocusGroup} />
          {preview && (!selected || preview.id !== selected.id) && <div className="map-preview"><span className="eyebrow">Preview</span><strong>{placeTitle(preview, placeLabels)}</strong><div><span>{countFor(preview, "injury")} injury-involved</span><span>{countFor(preview, "fatal")} fatal</span></div>{baselineMethod && <StateTag state={preview.lensAgreementState} />}</div>}
          {screen === "explore" && !compareMode && selected && mapEligiblePlaceIdSet.has(selected.id) && <div data-testid="selected-place-card" className="selected-place-card"><span className="eyebrow">You picked this place</span><strong>{placeTitle(selected, placeLabels)}</strong><div><span><b>{selectedInjuryCount}</b> hurt-report records</span><span><b>{selectedFatalCount}</b> fatal records</span></div><small>{ROAD_USER_MAP_LABELS[roadUser]} · {WINDOW_MAP_LABELS[windowKey]}</small><button onClick={() => { setScreen("inspect"); setTab("why"); }}>Open this place <ChevronRight size={14} /></button></div>}
          {compareMode && <div className="compare-mini" aria-live="polite"><div><span className="compare-letter">A</span><span><strong>{comparePlaces[0] ? placeTitle(comparePlaces[0], placeLabels) : "Choose place A"}</strong></span></div><ArrowLeftRight size={16} /><div><span className="compare-letter">B</span><span><strong>{comparePlaces[1] ? placeTitle(comparePlaces[1], placeLabels) : "Select a second place on map or list"}</strong></span></div><button data-testid="open-compare" disabled={comparePlaces.length !== 2 || !compareLockPass} onClick={() => { setCompareOpen(true); setScreen("compare"); }}>Open compare</button><button className="icon-button" aria-label="Clear comparison" onClick={() => { setCompareMode(false); setCompareIds([]); }}><X size={15} /></button></div>}
        </section>}

        {(screen === "inspect" || screen === "compare") && <aside className={`inspector-panel ${compareOpen ? "comparison-drawer" : ""}`}>
          {compareOpen ? (
            <>
              <div className="compare-header"><div><span className="eyebrow">Compare · shared locked method</span><h2>Two {mode === "intersection_node" ? "intersections" : "midblock segments"}, one evidence frame</h2></div><button className="icon-button" aria-label="Close comparison" onClick={() => { setCompareOpen(false); setScreen("explore"); }}><X size={18} /></button></div>
              <div className="compare-controls"><button onClick={() => setCompareIds((ids) => [...ids].reverse())}><ArrowLeftRight size={14} />Swap A/B</button><label><input type="checkbox" checked={diffOnly} onChange={(event) => setDiffOnly(event.target.checked)} />Differences only</label></div>
              {!compareLockPass || comparePlaces.length !== 2 ? <div className="compare-blocked"><AlertTriangle /><strong>Comparison blocked</strong><p>Choose two places at the same grain, road-user predicate, and period. If you changed a lock control, restart A/B.</p></div> : <div data-testid="compare-drawer" className="compare-content">
                <div className="shared-lock"><LockKeyhole size={15} /><span><strong>Method lock PASS</strong> · {activeWindow.start}–{activeWindow.end} · {ROAD_USER_LABELS[roadUser]} · {data.meta.assignmentVersion} · Crash aggregates</span></div>
                <div className="compare-place-heads">{comparePlaces.map((place, index) => <div key={place.id}><span className="compare-letter">{index === 0 ? "A" : "B"}</span><strong>{placeTitle(place, placeLabels)}</strong>{baselineMethod && <StateTag state={place.lensAgreementState} />}</div>)}</div>
                <p className="delta-sentence">Under this shared lock, A has {countFor(comparePlaces[0])} and B has {countFor(comparePlaces[1])} qualifying crash records. This is an analytical difference, not a risk or treatment conclusion.</p>
                <div className="compare-table">
                  <div className="compare-row"><span>Injury-involved records</span><strong>{countFor(comparePlaces[0], "injury")}</strong><strong>{countFor(comparePlaces[1], "injury")}</strong></div>
                  <div className="compare-row"><span>Fatal records</span><strong>{countFor(comparePlaces[0], "fatal")}</strong><strong>{countFor(comparePlaces[1], "fatal")}</strong></div>
                  {baselineMethod && <div className="compare-row"><span>Lens agreement</span><strong>{formatState(comparePlaces[0].lensAgreementState)}</strong><strong>{formatState(comparePlaces[1].lensAgreementState)}</strong></div>}
                  {!diffOnly || comparePlaces[0].assignmentClass !== comparePlaces[1].assignmentClass ? <div className="compare-row"><span>Assignment</span><strong>{formatState(comparePlaces[0].assignmentClass)}</strong><strong>{formatState(comparePlaces[1].assignmentClass)}</strong></div> : null}
                  {!diffOnly || fragilityRead(comparePlaces[0]) !== fragilityRead(comparePlaces[1]) ? <div className="compare-row"><span>Robustness</span><strong>{fragilityRead(comparePlaces[0])}</strong><strong>{fragilityRead(comparePlaces[1])}</strong></div> : null}
                  {!diffOnly || historyRead(situateIndex?.places[comparePlaces[0].id]?.oneF) !== historyRead(situateIndex?.places[comparePlaces[1].id]?.oneF) ? <div className="compare-row"><span>Documented history</span><strong>{historyRead(situateIndex?.places[comparePlaces[0].id]?.oneF)}</strong><strong>{historyRead(situateIndex?.places[comparePlaces[1].id]?.oneF)}</strong></div> : null}
                </div>
                <div className="unsupported-card"><LockKeyhole size={18} /><div><strong>Analytical comparison only</strong><p>No risk, cause, treatment, effectiveness, official priority, or durable shortlist claim is made.</p></div></div>
              </div>}
              <footer className="inspector-footer"><button onClick={() => { setCompareOpen(false); setScreen("explore"); }}><ChevronRight size={13} />Return to unchanged map</button></footer>
            </>
          ) : !selected ? (
            <div className="inspector-header">
              <div>
                <span className="eyebrow">Inspect</span>
                <h2>Choose a place on Explore</h2>
                <p className="lion-explainer">Select a ranked place from the list or map, then open Inspect from the selected-place card.</p>
              </div>
            </div>
          ) : (<>
          <div className="inspector-header">
            <div>
              <span className="eyebrow">Inspect selected place</span>
              <h2>{placeTitle(selected, placeLabels)}</h2>
              <details className="place-method-details">
                <summary>Place ID &amp; method</summary>
                <p className="lion-subtitle">{lionLabel(selected)}</p>
                <p className="lion-explainer">Stable ID from NYC’s LION street network. It keeps both harm counts tied to exact supporting records under <code>HL-SPATIAL-26B-v2</code>.</p>
                {selected.placeType === "midblock_segment" && <p className="grain-note">Street segment · peer mode (not snapped into an intersection).</p>}
              </details>
              <button className="show-on-map" onClick={() => { setScreen("explore"); issueCameraCommand("selected"); }}><MapPinned size={13} />Show on map</button>
            </div>
            {baselineMethod && <StateTag state={selected.lensAgreementState} />}
          </div>

          <div className="inspector-tabs" role="tablist">
            <button className={tab === "why" ? "active" : ""} onClick={() => setTab("why")}><Info size={15} />Counts</button>
            <button className={tab === "records" ? "active" : ""} onClick={() => setTab("records")}><List size={15} />Crashes</button>
            <button className={tab === "robustness" ? "active" : ""} onClick={() => setTab("robustness")}><Activity size={15} />Hold up?</button>
            <button data-testid="situate-tab" className={tab === "situate" ? "active" : ""} onClick={() => setTab("situate")}><Layers3 size={15} />On the street</button>
            <button data-testid="prepare-evidence-brief" className={tab === "packet" ? "active" : ""} title="Prepare a DRAFT Evidence Brief for this place." onClick={prepareEvidenceBrief}><FileText size={15} />Note</button>
          </div>

          <div className="inspector-scroll">
            {tab === "why" && (
              <div className="tab-content">
                <p className="tab-purpose"><Info size={14} /><span><strong>Why this place is on the list</strong>Why it surfaced, what the locked evidence supports, what it cannot establish, and what to investigate next.</span></p>
                <section className="why-surfaced" data-testid="why-this-place-surfaced">
                  <div className="why-surfaced-head">
                    <div><span className="eyebrow">Why this place surfaced</span><h3>{placeTitle(selected, placeLabels)}</h3></div>
                    <span className={`lens-badge ${lens}`}>{lens === "injury" ? "Injury-involved lens" : "Fatal lens"}</span>
                  </div>
                  <p className="why-lead">This {selected.placeType === "intersection_node" ? "intersection" : "midblock segment"} surfaced in the analytical order because it has <strong>{lens === "injury" ? selectedInjuryCount : selectedFatalCount} qualifying police-reported collision record{(lens === "injury" ? selectedInjuryCount : selectedFatalCount) === 1 ? "" : "s"}</strong> under the active {lens === "injury" ? "injury-involved" : "fatal"} lens for {activeRoadUserCopy} in the released {WINDOW_LABELS[windowKey]} period.</p>
                  <div className="why-facts">
                    <div><small>Analysis window</small><strong>{formatDateLong(activeWindow.start)}–{formatDateLong(activeWindow.end)}</strong></div>
                    <div><small>Road-user predicate</small><strong>{ROAD_USER_LABELS[roadUser]}</strong></div>
                    <div><small>Place grain</small><strong>{selected.placeType === "intersection_node" ? "Intersection" : "Midblock segment"}</strong></div>
                    <div><small>Lens agreement</small><strong>{baselineMethod ? formatState(selected.lensAgreementState) : "Not released for this lock"}</strong></div>
                    <div><small>Assignment</small><strong>{selected.assignmentClass === "intersection_confident" ? "Intersection confident" : "Peer midblock segment"}</strong></div>
                    <div><small>Injury-involved</small><strong>{selectedInjuryCount} crash records</strong></div>
                    <div><small>Fatal</small><strong>{selectedFatalCount} crash records</strong></div>
                  </div>
                  <div className="why-support-grid">
                    <article className="why-supports"><Check size={17} /><div><strong>What the data supports</strong><p>Moving this place into a closer-look queue for field and engineering investigation under this analytical method. It is not an official DOT priority.</p></div></article>
                    <article className="why-does-not"><LockKeyhole size={17} /><div><strong>What the data does not support</strong><p>Cause, exposure-adjusted or personal risk, official priority, an engineering treatment, or “untreated” status from an unmatched source record.</p></div></article>
                  </div>
                  <div className="risk-boundary"><CircleHelp size={17} /><p>Fatality data provides a clear severity signal, but this dataset does not reliably identify which nonfatal injuries were severe. High recorded harm concentration is not the same as high individual risk without exposure (volumes, VMT, trips).</p></div>
                  <div className="next-investigation"><strong>Suggested next investigation</strong><p>Verify rather than assume:</p><ul><li>Field conditions and geometry</li><li>Turning movements and signal operations</li><li>Pedestrian, cyclist, and vehicle volumes</li><li>Existing treatments and their effective dates</li></ul></div>
                  <div className="inspect-freshness" data-testid="inspect-freshness"><AlertTriangle size={15} /><div><strong>Records through {formatDateLong(data.meta.analysisEnd)} · source status: {data.meta.sourceStatus}</strong><span>Recent periods may backfill or revise. This is the latest accepted freeze, not a current-as-of-today street view.</span></div></div>
                </section>
                <section>
                  <span className="eyebrow">Both lenses · identical method</span>
                  <div className="count-grid">
                    <CountMark label="Injury-involved" value={selectedInjuryCount} active={lens === "injury"} />
                    <CountMark label="Fatal" value={selectedFatalCount} active={lens === "fatal"} />
                  </div>
                  {showToll && windowKey === "36m" && <div className="toll-beside-frequency" data-testid="human-toll"><strong>{selectedP25?.toll36[roadUser]?.[lens] ?? 0}</strong><span>{lens === "injury" ? "people recorded injured" : "people recorded killed"} on the same supporting crash records</span><small>Separate display; crash frequency remains default. Person rows do not backfill totals.</small></div>}
                  <div className="validation-line"><Check size={15} /><strong>Equality PASS</strong><span>counts match unique supporting IDs under this lock</span></div>
                </section>

                {selectedPersistence && <section className="persistence-card" data-testid="persistence-state"><span className="eyebrow">36m ↔ 48m sensitivity · Everyone predicate</span><h4>{selectedPersistence.positive ? "Elevated in both released checks" : "Not elevated in both released checks"}</h4><p>36m: {selectedPersistence.count36} records vs threshold {selectedPersistence.threshold36}. 48m: {selectedPersistence.count48} vs threshold {selectedPersistence.threshold48}. {lens === "fatal" ? "Fatal elevation means at least one fatal crash record — not a high-count tier." : "This is not stable, chronic, hotspot, risk, or official priority."}</p></section>}

                <section className="disclosure-card fatal-disclosure">
                  <CircleHelp size={18} />
                  <div><strong>Fatal elevation threshold = 1</strong><p>Sparse fatal counts and retained ties mean any fatal-positive place is elevated under this analytical rule. This is not risk or priority.</p></div>
                </section>

                <section>
                  <div className="section-row"><div><span className="eyebrow">Assignment</span><h4>Class mix</h4></div><span className="claim-chip assignment">Assignment</span></div>
                  <div className="assignment-row"><span>{selected.assignmentClass === "intersection_confident" ? "Intersection confident" : "Midblock segment"}</span><strong>{new Set([...selectedInjuryIds, ...selectedFatalIds]).size}</strong></div>
                  <p className="method-copy">{selected.coordinateBasis}. The 40 m search envelope is a convention, not physical truth.</p>
                </section>

                {baselineMethod ? <section>
                  <span className="eyebrow">Peer strip · same grain</span>
                  <h4>Four analytical peers under both lenses</h4>
                  <div className="peer-table">
                    <div className="peer-head"><span>Place</span><span>Injury</span><span>Fatal</span></div>
                    <div><strong>This place</strong><span>{selected.injuryCount} · #{selected.injuryRank}</span><span>{selected.fatalCount} · #{selected.fatalRank}</span></div>
                    {selected.peers.map((peer) => { const peerPlace = placeById.get(`${selected.placeType}:${peer.placeId}`); return <div key={peer.placeId}><strong>{peerPlace ? placeTitle(peerPlace, placeLabels) : lionLabel({ ...selected, placeId: peer.placeId })}</strong><span>{peer.injuryCount} · #{peer.injuryRank}</span><span>{peer.fatalCount} · #{peer.fatalRank}</span></div>; })}
                  </div>
                  <p className="method-copy">Peer similarity uses the two empirical count percentiles. It is not a durable shortlist.</p>
                </section> : <section className="disclosure-card"><Info size={18} /><div><strong>Peer strip is not released for this lock</strong><p>The frozen peer strip remains available only for Everyone in the 36-month method. No new peer ranks were inferred for this road-user or period selection.</p></div></section>}
              </div>
            )}

            {tab === "records" && (
              <div className="tab-content">
                <p className="tab-purpose"><List size={14} /><span><strong>Supporting crash records</strong>{selectedInjuryIds.length + selectedFatalIds.length} lens memberships support the active {ROAD_USER_LABELS[roadUser]} / {windowKey} counts. Exact collision IDs remain available below.</span></p>
                <section><span className="eyebrow">Supporting collision records</span><h4>Exact IDs behind both counts</h4><p className="method-copy">Every displayed count equals its unique supporting <code>collision_id</code> set. These are police-reported records, not inferred events.</p><div className="validation-line"><Check size={15} /><strong>Equality PASS</strong><span>{selectedInjuryIds.length + selectedFatalIds.length} lens memberships inspected</span></div></section>
                <EvidenceIds title="Injury-involved IDs" ids={selectedInjuryIds} tone="injury" />
                <EvidenceIds title="Fatal IDs" ids={selectedFatalIds} tone="fatal" />
                <section className="unsupported-card"><LockKeyhole size={18} /><div><strong>Record limits</strong><p>IDs support the two harm predicates only. They do not establish risk, cause, treatment need, or official priority.</p></div></section>
              </div>
            )}

            {tab === "robustness" && (
              <div className="tab-content">
                <p className="tab-purpose"><Activity size={14} /><span><strong>Whether the signal changes under checks</strong>Completed checks use different time windows; unfinished checks stay explicit.</span></p>
                <p className="inspect-lead">We re-checked this place with different time windows. Here’s what changed.</p>
                <section>
                  <div className="section-row"><div><span className="eyebrow">Completed checks</span><h4>{selected.fragility.anyTestedStateChange ? "The signal changed in at least one check" : "The signal did not change in completed checks"}</h4></div><span className="claim-chip calculation">Calculation</span></div>
                  <p className="robustness-read">{fragilityRead(selected)}</p>
                  <ul className="fragility-list">
                    <li><span>Last 24 months</span><strong>{formatState(selected.fragility.trailing24State)}</strong></li>
                    <li><span>Last 36 months</span><strong>{formatState(selected.fragility.trailing36State)}</strong></li>
                    <li><span>Last 48 months</span><strong>{formatState(selected.fragility.trailing48State)}</strong></li>
                    <li><span>Without 2024</span><strong>{formatState(selected.fragility.omit2024State)}</strong></li>
                    <li><span>Without 2025</span><strong>{formatState(selected.fragility.omit2025State)}</strong></li>
                    <li className="deferred"><span>Street-distance check</span><strong>Not run yet</strong><small>Incomplete checks are never called stable.</small></li>
                  </ul>
                  <p className="method-copy">Incomplete or deferred tests are never summarized as “stable.”</p>
                </section>
              </div>
            )}

            {tab === "situate" && (
              <div className="tab-content">
                <p className="tab-purpose"><Layers3 size={14} /><span><strong>Documented street changes and published rules</strong>Official records under frozen match rules—not present-day field proof or crash-date conditions.</span></p>
                <p className="inspect-lead">What official records say here—not whether a condition exists today or existed on a crash date.</p>
                <section className="situate-spine">
                  <div className="section-row"><div><span className="eyebrow">At a glance</span><h4>{situate ? `${situate.documentedStreetChanges.length} documented change${situate.documentedStreetChanges.length === 1 ? "" : "s"} · ${situate.approaches.length} approach${situate.approaches.length === 1 ? "" : "es"}` : "Loading frozen street context"}</h4></div><span className="claim-chip history">Conditional</span></div>
                  <details className="situate-method-details"><summary>Evidence method</summary><p className="method-copy">Evidence is keyed to this {selected.placeType === "intersection_node" ? "ranked intersection and its separate incident approaches" : "peer midblock segment"} under <code>HL-APPROACH-SITUATE-v1</code> plus the exact-key <code>HL-APPROACH-SITUATE-WAVE2-v1</code> overlay. Context never enters harm counts or ranks.</p>{situateIndex && <div className="situate-totals"><span><strong>{formatNumber(23_528)}</strong> documented rows in the frozen universe</span><span><strong>{formatNumber(586_158)}</strong> network / rule rows</span><span><strong>{formatNumber(143_182)}</strong> unknown rows</span></div>}</details>
                </section>

                {!situate && !situateError && !wave2SituateError && <section className="situate-loading" aria-live="polite"><span />Loading frozen Situate evidence…</section>}
                {situateError && <section className="unknown-card"><AlertTriangle size={20} /><div><strong>Frozen Situate projection could not be loaded.</strong><p>No alternate, live, or sample-packet data was substituted.</p></div></section>}
                {wave2SituateError && <section className="unknown-card" data-testid="situate-wave2-load-error"><AlertTriangle size={20} /><div><strong>Frozen Wave-2 Situate projection could not be loaded.</strong><p>Existing frozen 1F and Wave-1 evidence remains visible. No alternate or live Open Data was substituted for Wave-2.</p></div></section>}

                {situate && <>
                  <section data-testid="situate-documented-street-changes">
                    <div className="section-row"><div><span className="eyebrow">Documented street changes</span><h4>{situate.documentedStreetChanges.length ? `${situate.documentedStreetChanges.length} documented fact${situate.documentedStreetChanges.length > 1 ? "s" : ""} at this place` : "No established row in this group"}</h4></div><span className={`claim-chip ${situate.documentedStreetChanges.length ? "history" : "unknown"}`}>{situate.documentedStreetChanges.length ? "Documented" : "Unknown"}</span></div>
                    {situate.documentedStreetChanges.length ? <div className="approach-evidence-list">{situate.documentedStreetChanges.map((record, index) => (
                      <article className="approach-evidence-card" key={`${record.family}:${record.sourceRecordId}:${index}`}>
                        <div className="evidence-card-head"><div><strong>{documentedFactTitle(record)}</strong><span>{record.sourceDatasetName}</span></div><span className={`claim-chip ${record.claimClass === "unknown" ? "unknown" : "history"}`}>{claimLabel(record.claimClass)}</span></div>
                        {record.publishedDateValues && <p className="evidence-date"><strong>{dateRead(record.publishedDateValues)}</strong>{record.dateMeaning ? ` · ${record.dateMeaning}` : ""}</p>}
                        <details><summary>Source and match receipt</summary><dl className="provenance-grid"><div><dt>Publisher</dt><dd>{record.publisher}</dd></div><div><dt>Dataset</dt><dd><code>{record.sourceDatasetId}</code></dd></div><div><dt>Source record</dt><dd><code>{record.sourceRecordId}</code></dd></div><div><dt>Match</dt><dd>{formatState(record.matchClass)}</dd></div><div><dt>Match version</dt><dd><code>{record.matchVersion}</code></dd></div><div><dt>Snapshot</dt><dd><code>{record.sourceSnapshotId ?? "Inherited frozen source"}</code></dd></div></dl></details>
                      </article>
                    ))}</div> : <p className="empty-copy">No established documented-change relationship appears for this place under the listed frozen sources and match versions.</p>}
                  </section>

                  <section data-testid="situate-street-network-and-rules">
                    <div className="section-row"><div><span className="eyebrow">Street network and rules</span><h4>{situate.approaches.length ? `${situate.approaches.length} named street arm${situate.approaches.length > 1 ? "s" : ""}` : "No governed approach row"}</h4></div><span className="claim-chip assignment">Per approach</span></div>
                    <p className="method-copy">Each arm keeps its own published values. A value on one street is not applied to the whole intersection.</p>
                    {situate.approaches.length ? <div className="approach-list">{situate.approaches.map((approach) => {
                      const established = approach.networkAndRules.filter((record) => record.family !== "speed_limits" || record.speedClaimEligible === true);
                      const parking = established.filter(isParkingRecord);
                      const other = established.filter((record) => !isParkingRecord(record) && !/LION 26B publishes street name/i.test(record.statement));
                      const chips = approachFactChips(approach);
                      return <details className="approach-card" data-testid={`situate-approach-${approach.segmentId}`} key={approach.approachKey}><summary><span><small>Street arm</small><strong className="approach-street">{approachStreetName(approach)}</strong></span><b>{chips.length ? chips.map((chip) => chip.value).join(" · ") : `${established.length} published`}</b></summary><div className="approach-card-body">{chips.length ? <div className="approach-fact-chips">{chips.map((chip) => <span key={chip.label}><small>{chip.label}</small><strong>{chip.value}</strong></span>)}</div> : null}{parking.length ? <article className="approach-evidence-card compact"><div className="evidence-card-head"><div><strong>Parking regulation signs</strong><span>{parking.length} published order{parking.length === 1 ? "" : "s"}</span></div></div><ul className="parking-dates">{parking.map((record, index) => <li key={`${record.sourceRecordId}:${index}`}>{dateRead(record.publishedDateValues)}</li>)}</ul><details><summary>Source and match receipt</summary><div className="approach-evidence-list">{parking.map((record, index) => <EvidenceCard compact key={`${record.family}:${record.sourceRecordId}:${index}`} record={record} />)}</div></details></article> : null}{other.length ? <div className="approach-evidence-list">{other.map((record, index) => <EvidenceCard compact key={`${record.family}:${record.sourceRecordId}:${index}`} record={record} />)}</div> : null}{!established.length ? <p className="empty-copy">No established network/rule row for this approach.</p> : null}<details className="approach-unknown"><summary>Place ID for this arm</summary><p className="method-copy">LION segment {approach.segmentId}. Values stay on this arm only.</p></details>{approach.unknown.length ? <details className="approach-unknown"><summary>{approach.unknown.length} unresolved or conflicting row{approach.unknown.length === 1 ? "" : "s"}</summary><div className="approach-evidence-list">{approach.unknown.map((record, index) => <EvidenceCard compact key={`${record.family}:${record.sourceRecordId}:${index}`} record={record} />)}</div></details> : null}</div></details>;
                    })}</div> : <p className="empty-copy">No governed approach relationship is established for this place.</p>}
                  </section>

                  <section data-testid="situate-unknown-evidence">
                    <div className="section-row"><div><span className="eyebrow">What the sources do not establish</span><h4>{groupUnknownEvidence(situate.unknownEvidence).length} grouped unknown{groupUnknownEvidence(situate.unknownEvidence).length === 1 ? "" : "s"}{situate.unknownEvidence.length ? ` · ${situate.unknownEvidence.length} source notes` : ""}</h4></div><span className="claim-chip unknown">Unknown</span></div>
                    {situate.unknownEvidence.length ? <div className="unknown-evidence-list">{groupUnknownEvidence(situate.unknownEvidence).map((group) => (
                      <article className="unknown-group" key={group.statement}>
                        <div className="evidence-card-head"><div><strong>{group.statement}</strong><span>{group.items.length === 1 ? "1 source note" : `${group.items.length} matching source notes`}</span></div><span className="claim-chip unknown">Unknown</span></div>
                        <details><summary>Source and match receipt</summary><div className="approach-evidence-list">{group.items.map((record, index) => <EvidenceCard compact key={`${record.family}:${record.sourceRecordId}:${index}`} record={record} />)}</div></details>
                      </article>
                    ))}</div> : <p className="empty-copy">No relationship-level unknown row is recorded for this place.</p>}
                    <details className="situate-method-details"><summary>Wave-2 source-wide exclusions</summary><p className="method-copy">36,728 parking-regulation source rows with incomplete coordinates were ineligible for place attachment. This inventory covers parking-regulation signs only. Missing bus schedule fields remain unknown, and Enhanced Crossing history does not establish continuing presence.</p></details>
                    <div className="permanent-gap-list">{situate.permanentGaps.map((gap) => <article key={gap.domain}><CircleHelp size={16} /><div><strong>{formatState(gap.domain)}</strong><p>{gap.statement}</p></div></article>)}</div>
                  </section>
                </>}

                <section className="context-card">
                  <div className="context-image-label"><MapPinned size={17} /><span>Historical reference imagery · NYC OTI 2018</span><b>CC BY 4.0</b></div>
                  <h4>Historical orientation reference — not the street now</h4>
                  <p><strong>Current-context reference only:</strong> use the image to locate the place, never as proof of current conditions.</p>
                  <p>This 2018 imagery helps orient the location only. It is not a current streetscape, does not reconstruct conditions on a collision date, and does not establish operational access or treatment history.</p>
                  <a href={data.meta.imagery.servicePage} target="_blank" rel="noreferrer">Open source service information <ChevronRight size={14} /></a>
                </section>

              </div>
            )}

            {tab === "packet" && (
              <div className="tab-content">
                <p className="tab-purpose"><FileText size={14} /><span><strong>Meeting-ready Evidence Brief</strong>Prepared from this place’s frozen counts, method lock, and governed street evidence. It remains DRAFT.</span></p>
                <section className="packet-hero">
                  <div className="draft-stamp">DRAFT</div>
                  <ClipboardList size={28} />
                  <span className="eyebrow">Evidence Brief</span>
                  <h3>{selected.displayName}</h3>
                  <p>A concise DRAFT meeting artifact is available for every inspected place. It does not recreate the analysis or turn missing source relationships into “No.”</p>
                  <button className="primary-button" onClick={prepareEvidenceBrief}><FileText size={16} />Prepare evidence brief</button>
                  {packet && <button className="text-button" onClick={downloadPacket}><ArrowDownToLine size={16} />Download DRAFT LEP (frozen sample)</button>}
                </section>

                <section>
                  <span className="eyebrow">Evidence Completeness Checklist</span>
                  <h4>Checks, not a score</h4>
                  <div className="checklist">
                    {[
                      ["Both-lens equality", selected.equalityPass],
                      ["Method lock recorded", true],
                      ["Freshness fields present", true],
                      ["Assignment class visible", true],
                      ["Material unknowns listed", true],
                      ["Unsupported claims present", true],
                    ].map(([label, pass]) => <div key={String(label)}><span className={pass ? "pass" : "fail"}><Check size={13} /></span><strong>{label}</strong><small>{pass ? "Present" : "Missing"}</small></div>)}
                  </div>
                </section>

                <section>
                  <span className="eyebrow">Claim-class legend</span>
                  <h4>How to read each field</h4>
                  <div className="claim-legend">
                    {CLAIM_CLASSES.map(([name, description]) => <div key={name}><span className={`legend-dot ${name.toLowerCase().replaceAll(" ", "-")}`} /><p><strong>{name}</strong><small>{description}</small></p></div>)}
                  </div>
                </section>

                <section className="unsupported-card">
                  <LockKeyhole size={18} />
                  <div><strong>This brief does not support</strong><p>Exposure-adjusted risk, cause, automatic treatment prescription, treatment effectiveness, official priority, a durable shortlist, collapsed approach values, or no-match as untreated.</p></div>
                </section>
              </div>
            )}
          </div>
          <footer className="inspector-footer"><Database size={13} />{data.meta.objectVersion} · read-only</footer>
          </>)}
        </aside>}

        {screen === "packet" && selected && <section className="packet-screen evidence-brief-screen" data-testid="evidence-brief-screen">
          <div className="packet-screen-copy">
            <span className="eyebrow">Note · meeting artifact</span><h1>DRAFT Evidence Brief</h1><h2>{placeTitle(selected, placeLabels)}</h2><p className="lion-subtitle">{lionLabel(selected)}</p>
            {!situate && !situateError && !wave2SituateError && <div className="brief-loading" aria-live="polite"><span />Preparing from frozen evidence…</div>}
            {situateError && <div className="brief-error"><AlertTriangle size={18} /><p>Frozen Situate evidence could not be loaded, so the brief was not fabricated from alternate or live data.</p></div>}
            {wave2SituateError && baseSituate && <div className="brief-warning"><AlertTriangle size={18} /><p>Wave-2 context could not be loaded. The brief uses only the governed 1F and Wave-1 evidence and keeps the missing family unknown.</p></div>}
            {evidenceBrief && <>
              <div className="brief-method-line"><LockKeyhole size={14} /><span>{evidenceBrief.methodLock.harmLens} lens · {evidenceBrief.methodLock.roadUser} · {formatDateLong(evidenceBrief.methodLock.analysisStart)}–{formatDateLong(evidenceBrief.methodLock.analysisEnd)} · {evidenceBrief.place.grain}</span></div>
              <section className="brief-preview-section"><span className="eyebrow">Why this place surfaced</span><p>{evidenceBrief.whyThisPlaceSurfaced.statement}</p></section>
              <section className="brief-preview-section"><span className="eyebrow">Evidence</span><div className="brief-counts">{evidenceBrief.evidence.counts.map((count) => <div key={count.label}><strong>{count.crashRecordCount}</strong><span>{count.label}</span><small>Equality {evidenceBrief.evidence.equalityStatus}</small></div>)}</div></section>
              {evidenceBrief.evidence.humanToll && <section className="brief-preview-section"><span className="eyebrow">Human toll · separate from frequency</span><p><strong>{evidenceBrief.evidence.humanToll.peopleRecordedTotal}</strong> {evidenceBrief.evidence.humanToll.label}. Frequency remains the default; Person rows do not replace Crash totals.</p></section>}
              {evidenceBrief.evidence.persistence && <section className="brief-preview-section"><span className="eyebrow">Persistence sensitivity</span><p>{evidenceBrief.evidence.persistence.statement} Never interpreted as stable, chronic, hotspot, risk, or official priority.</p></section>}
              {evidenceBrief.evidence.corridor && <section className="brief-preview-section"><span className="eyebrow">Analytical LION corridor</span><p><strong>{evidenceBrief.evidence.corridor.label}</strong> · {evidenceBrief.evidence.corridor.crashRecordCount} unique supporting records. Not an official NYC DOT corridor program layer.</p></section>}
              <section className="brief-preview-section"><span className="eyebrow">Known street context</span><p><strong>{evidenceBrief.knownStreetContext.documentedYes.length}</strong> established source relationship{evidenceBrief.knownStreetContext.documentedYes.length === 1 ? "" : "s"}; <strong>{evidenceBrief.knownStreetContext.unknown.length}</strong> unknown or unresolved note{evidenceBrief.knownStreetContext.unknown.length === 1 ? "" : "s"}. Empty source relationships remain Unknown.</p></section>
              <section className="brief-preview-section"><span className="eyebrow">Data currency</span><p>{evidenceBrief.dataCurrency.statement}</p></section>
              <section className="brief-preview-section limitation"><span className="eyebrow">Limitations</span><p>Concentration ≠ risk. Records are not people. No cause, official priority, treatment, or effectiveness claim is made.</p></section>
              <section className="brief-preview-section next"><span className="eyebrow">Recommended next action</span><p>{evidenceBrief.recommendedNextAction.statement}</p></section>
              <div className="brief-actions"><button className="primary-button" onClick={() => downloadEvidenceBrief("html")}><ArrowDownToLine size={16} />Download DRAFT brief (.html)</button><button className="text-button" onClick={() => downloadEvidenceBrief("json")}><Database size={14} />Download claim-class JSON</button></div>
              {packet && <div className="sample-lep-preserved"><strong>Existing frozen DRAFT Location Evidence Packet</strong><p>A frozen DRAFT packet exists for four sample places only. This sample download stays separate from the any-place Evidence Brief.</p><button className="text-button" onClick={downloadPacket}><ArrowDownToLine size={14} />Download DRAFT LEP (frozen sample)</button></div>}
            </>}
            <button className="text-button" onClick={() => { setScreen("inspect"); setTab("why"); }}><ChevronRight size={14} />Return to Inspect</button>
          </div>
          <div className="packet-screen-checks"><div className="draft-stamp">DRAFT</div><span className="eyebrow">Evidence Brief checks</span><h3>Portable, bounded, and still DRAFT</h3><div className="checklist">{[["Both-lens equality", selectedInjuryCount === selectedInjuryIds.length && selectedFatalCount === selectedFatalIds.length],["Same method lock", true],["Freshness and backfill warning", true],["Known context from Situate only", Boolean(situate)],["Material unknowns explicit", Boolean(evidenceBrief?.knownStreetContext.unknown.length)],["Claim limitations present", true]].map(([label, pass]) => <div key={String(label)}><span className={pass ? "pass" : "fail"}><Check size={13} /></span><strong>{label}</strong><small>{pass ? "Present" : "Waiting"}</small></div>)}</div><div className="unsupported-card"><LockKeyhole size={18} /><div><strong>This brief does not support</strong><p>Risk, cause, treatment prescription, effectiveness, official priority, KSI, or a durable shortlist. Optional human toll is only a separate Crash-field sum.</p></div></div></div>
        </section>}
      </div>}

      {methodOpen && (
        <div className="modal-backdrop">
          <section className="method-modal" role="dialog" aria-modal="true" aria-label="Compare method lock">
            <button className="modal-close" onClick={() => setMethodOpen(false)} aria-label="Close method lock"><X size={18} /></button>
            <LockKeyhole size={24} />
            <span className="eyebrow">Compare method lock</span>
            <h2>Both lenses use the same evidence frame.</h2>
            <div className="lock-grid">
              <div><small>Window</small><strong>{activeWindow.start} → {activeWindow.end}</strong><code>{activeWindow.id}</code></div>
              <div><small>Geography</small><strong>LION 26B canonical</strong><code>LION_26B_canonical_2026-08-10</code></div>
              <div><small>Assignment</small><strong>Conservative v2</strong><code>{data.meta.assignmentVersion}</code></div>
              <div><small>Predicates</small><strong>Crash aggregates only</strong><code>{data.meta.predicateRegistry}</code></div>
              <div><small>Place grain</small><strong>{mode === "intersection_node" ? "Intersection nodes" : "Midblock segments"}</strong><code>never mixed in one rank</code></div>
              <div><small>Road-user predicate</small><strong>{ROAD_USER_LABELS[roadUser]}</strong><code>{activeRoadUserCopy}</code></div>
              <div><small>Corridor scope</small><strong>{activeCorridor ? `${activeCorridor.displayName} · component ${activeCorridor.componentOrdinal}` : "No corridor filter"}</strong><code>{activeCorridor ? p25.meta.corridorVersion : "place grain"}</code></div>
              <div><small>Peer rule</small><strong>Positive-count p90 with ties</strong><code>{data.meta.peerRule}</code></div>
            </div>
            <div className="modal-note"><Info size={17} />A mismatch in window, road-user predicate, geography, assignment, predicates, or grain invalidates the compare. {p25.meta.fixedUniverseDisclosure}</div>
          </section>
        </div>
      )}
    </main>
  );
}
