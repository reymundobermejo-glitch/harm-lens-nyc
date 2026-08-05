const SOCRATA_URL = "https://data.cityofnewyork.us/resource/h9gi-nx95.json";

const SELECT = [
  "count(*) as total_rows",
  "sum(case when number_of_motorist_injured > 0 then 1 else 0 end) as motorist_injury_collisions",
  "sum(case when number_of_pedestrians_injured > 0 then 1 else 0 end) as pedestrian_injury_collisions",
  "sum(case when number_of_cyclist_injured > 0 then 1 else 0 end) as cyclist_injury_collisions",
  "sum(case when number_of_motorist_killed > 0 then 1 else 0 end) as motorist_fatal_collisions",
  "sum(case when number_of_pedestrians_killed > 0 then 1 else 0 end) as pedestrian_fatal_collisions",
  "sum(case when number_of_cyclist_killed > 0 then 1 else 0 end) as cyclist_fatal_collisions",
  "max(crash_date) as latest_crash_date",
].join(",");

const numericKeys = [
  "total_rows",
  "motorist_injury_collisions",
  "pedestrian_injury_collisions",
  "cyclist_injury_collisions",
  "motorist_fatal_collisions",
  "pedestrian_fatal_collisions",
  "cyclist_fatal_collisions",
] as const;

export async function GET() {
  try {
    const url = new URL(SOCRATA_URL);
    url.searchParams.set("$select", SELECT);

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) throw new Error(`Upstream returned ${response.status}`);

    const rows = (await response.json()) as Array<Record<string, string>>;
    const row = rows[0];
    if (!row) throw new Error("Upstream returned no aggregate row");

    const parsed = Object.fromEntries(
      numericKeys.map((key) => [key, Number(row[key])]),
    ) as Record<(typeof numericKeys)[number], number>;

    if (numericKeys.some((key) => !Number.isFinite(parsed[key]) || parsed[key] < 0)) {
      throw new Error("Upstream aggregate failed validation");
    }

    const latest = new Date(row.latest_crash_date);
    if (Number.isNaN(latest.getTime())) throw new Error("Upstream date failed validation");

    return Response.json(
      { ...parsed, latest_crash_date: row.latest_crash_date, fetched_at: new Date().toISOString() },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
    );
  } catch {
    return Response.json(
      { error: "NYC Open Data is unavailable. No unverified values are being shown." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
