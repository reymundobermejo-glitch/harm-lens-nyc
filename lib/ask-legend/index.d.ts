/**
 * Ask Legend — TypeScript types for later page wire (G0 + G1a/G1b).
 * Runtime: `./index.mjs`
 * Chips are NOT visible in Explore until page.tsx is wired after C6.
 */

export type AskLegendPlaceType = "intersection_node" | "midblock_segment";
export type AskLegendLens = "injury" | "fatal";
export type AskLegendAgreementFilter = "all" | "injury_led" | "fatal_led" | "both";

export type AskLegendPlace = {
  id: string;
  placeType: AskLegendPlaceType;
  placeId: number | string;
  title?: string | null;
  streetNames?: string[];
  street?: string | null;
  displayName?: string | null;
};

export type AskLegendMatch = {
  id: string;
  score: number;
  reason: string;
};

export type SearchPlacesOptions = {
  limit?: number;
};

export type PlaceLabelLike = {
  title?: string;
  streetNames?: string[];
};

export type PlaceLabelIndexLike = {
  labels?: Record<string, PlaceLabelLike>;
};

export type ToolOk = {
  ok: true;
  tool: string;
  args: Record<string, unknown>;
  effect?: string;
  placeIds?: string[];
};

export type ToolRefuse = {
  ok: false;
  refused: true;
  tool: string;
  reason: string;
  args?: Record<string, unknown>;
};

export type ToolResult = ToolOk | ToolRefuse;

export type AskLegendChip = {
  id: string;
  stage: "G1a" | "G1b";
  label: string;
  tool: string;
  args: Record<string, unknown>;
  hint?: string;
};

export type SituateEvidenceRow = {
  family: string;
  claimClass?: string;
  speedClaimEligible?: boolean;
};

export type SituateFilterPlace = {
  id?: string;
  documentedStreetChanges?: SituateEvidenceRow[];
  streetNetworkAndRules?: SituateEvidenceRow[];
  evidence?: SituateEvidenceRow[];
  familyStatus?: Record<string, { status?: string; documentedYes?: boolean }>;
  families?: Record<string, { documentedYes?: boolean }>;
};

export type SituateFilterIndex = {
  places: Record<string, SituateFilterPlace>;
};

export declare const ASK_LEGEND_SUBTITLE: "Searches this frozen evidence only";
export declare const ASK_LEGEND_STAGE: "G0";
export declare const ASK_LEGEND_CHIP_STAGES: readonly ["G1a", "G1b"];
export declare const ALLOWLISTED_TOOLS: readonly string[];
export declare const CLAIM_SAFE_SITUATE_FAMILIES: readonly string[];
export declare const HOLD_SITUATE_FAMILIES: readonly string[];
export declare const ASK_LEGEND_CHIP_CATALOG: readonly AskLegendChip[];

export declare function normalizeQuery(query: string): string;
export declare function queryTokens(normalized: string): string[];
export declare function splitCrossStreet(
  normalized: string,
): { left: string[]; right: string[] } | null;
export declare function labelTokens(value: string | null | undefined): string[];

export declare function searchPlaces(
  query: string,
  places: readonly AskLegendPlace[],
  options?: SearchPlacesOptions,
): AskLegendMatch[];

export declare function searchPlaceIds(
  query: string,
  places: readonly AskLegendPlace[],
  options?: SearchPlacesOptions,
): string[];

export declare function buildSearchUniverse(
  places: readonly {
    id: string;
    placeType: AskLegendPlaceType;
    placeId: number | string;
    street?: string | null;
    displayName?: string | null;
  }[],
  labelIndex?: PlaceLabelIndexLike | null,
): AskLegendPlace[];

export declare function setLens(raw: unknown): ToolResult;
export declare function setMode(raw: unknown): ToolResult;
export declare function setAgreementFilter(raw: unknown): ToolResult;
export declare function filterByQuery(raw: unknown): ToolResult;
export declare function clearFilters(): ToolResult;
export declare function fitNyc(): ToolResult;
export declare function selectPlace(
  raw: unknown,
  ctx?: { allowedPlaceIds?: ReadonlySet<string> | readonly string[] },
): ToolResult;
export declare function flyToPlace(
  raw: unknown,
  ctx?: { allowedPlaceIds?: ReadonlySet<string> | readonly string[] },
): ToolResult;
export declare function invokeAllowlistedTool(
  tool: string,
  args: unknown,
  ctx?: { allowedPlaceIds?: ReadonlySet<string> | readonly string[] },
): ToolResult;

export declare function placeHasDocumentedYes(
  place: SituateFilterPlace | null | undefined,
  family: string,
): boolean;
export declare function filterSituateFamily(
  rawArgs: unknown,
  situateIndex: SituateFilterIndex | null | undefined,
  ctx?: { allowedPlaceIds?: ReadonlySet<string> | readonly string[] },
): ToolResult & { placeIds?: string[] };
export declare function buildSituateFilterIndexFromYesMap(
  yesByPlace: Record<string, string[] | Record<string, boolean>>,
): SituateFilterIndex;

export declare function getChip(chipId: string): AskLegendChip | null;
export declare function listChips(stage?: "G1a" | "G1b" | "all"): AskLegendChip[];
export declare function parseChip(
  raw: unknown,
): { ok: true; chip: AskLegendChip } | { ok: false; refused: true; reason: string };
export declare function applyChip(
  chipOrId: string | AskLegendChip,
  ctx?: {
    allowedPlaceIds?: ReadonlySet<string> | readonly string[];
    situateIndex?: SituateFilterIndex | null;
  },
): ToolResult & { placeIds?: string[] };
