"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Outcome = "injury" | "fatal";
type Group = "motorist" | "pedestrian" | "cyclist";

type HarmData = {
  total_rows: number;
  motorist_injury_collisions: number;
  pedestrian_injury_collisions: number;
  cyclist_injury_collisions: number;
  motorist_fatal_collisions: number;
  pedestrian_fatal_collisions: number;
  cyclist_fatal_collisions: number;
  latest_crash_date: string;
  fetched_at: string;
};

const groups: Array<{ id: Group; label: string; note: string }> = [
  { id: "motorist", label: "Motorists", note: "drivers and vehicle occupants" },
  { id: "pedestrian", label: "Pedestrians", note: "people traveling on foot" },
  { id: "cyclist", label: "Cyclists", note: "people traveling by bicycle" },
];

const number = new Intl.NumberFormat("en-US");

async function fetchHarm() {
  const response = await fetch("/api/harm", { cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Live data is unavailable.");
  return body as HarmData;
}

function valueFor(data: HarmData, group: Group, outcome: Outcome) {
  return data[`${group}_${outcome}_collisions` as keyof HarmData] as number;
}

export default function Home() {
  const [outcome, setOutcome] = useState<Outcome>("injury");
  const [data, setData] = useState<HarmData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchHarm());
    } catch (reason) {
      setData(null);
      setError(reason instanceof Error ? reason.message : "Live data is unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHarm()
      .then(setData)
      .catch((reason) => {
        setData(null);
        setError(reason instanceof Error ? reason.message : "Live data is unavailable.");
      })
      .finally(() => setLoading(false));
  }, []);

  const ranked = useMemo(() => {
    if (!data) return [];
    return groups
      .map((group) => ({ ...group, value: valueFor(data, group.id, outcome) }))
      .sort((a, b) => b.value - a.value);
  }, [data, outcome]);

  const leader = ranked[0];
  const latestDate = data
    ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(data.latest_crash_date))
    : "";
  const summary = outcome === "injury"
    ? "Motorists lead injury-involved collision records."
    : "Pedestrians lead fatal collision records.";

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Harm Lens home"><span aria-hidden="true">HL</span> Harm Lens</a>
        <a className="source-link" href="https://data.cityofnewyork.us/Public-Safety/Motor-Vehicle-Collisions-Crashes/h9gi-nx95/about_data" target="_blank" rel="noreferrer">NYC Open Data ↗</a>
      </header>

      <section className="hero" id="top">
        <p className="eyebrow">NYC motor vehicle collisions</p>
        <h1>The answer changes when harm becomes fatal.</h1>
        <p className="lede">One live lens on the same crash table reveals a ranking reversal: motorists lead injury-involved records; pedestrians lead fatal records.</p>
      </section>

      <section className="lens" aria-labelledby="lens-title">
        <div className="lens-topline">
          <div>
            <p className="step">THE HARM LENS</p>
            <h2 id="lens-title">How are we measuring harm?</h2>
          </div>
          {data && <p className="coverage"><span className="status-dot" aria-hidden="true" />Live API result<br /><small>Data through {latestDate}</small></p>}
        </div>

        <div className="switch" role="group" aria-label="Choose harm outcome">
          <button type="button" aria-pressed={outcome === "injury"} onClick={() => setOutcome("injury")}>Injury volume</button>
          <button type="button" aria-pressed={outcome === "fatal"} onClick={() => setOutcome("fatal")}>Fatal harm</button>
        </div>

        <p className="announcement" aria-live="polite">{data ? summary : loading ? "Loading live collision aggregates." : error}</p>

        {loading && <div className="loading-card" role="status">Requesting six aggregate values from NYC Open Data…</div>}

        {!loading && error && (
          <div className="error-card" role="alert">
            <strong>Live values are unavailable.</strong>
            <p>{error} We won’t substitute an unverified snapshot.</p>
            <button type="button" onClick={() => void load()}>Try again</button>
          </div>
        )}

        {!loading && data && leader && (
          <div className="viz-wrap">
            <div className="axis-note"><span>Relative to this outcome’s leader</span><span>Leader = 100</span></div>
            <div className="ranking" aria-hidden="true">
              {ranked.map((item, index) => {
                const width = Math.max(5, (item.value / leader.value) * 100);
                return (
                  <div className={`rank-row group-${item.id}`} key={item.id}>
                    <div className="rank-number">0{index + 1}</div>
                    <div className="group-label"><strong>{item.label}</strong><small>{item.note}</small></div>
                    <div className="measure">
                      <div className="bar-track"><div className="bar-fill" style={{ width: `${width}%` }} /></div>
                      <strong className="value">{number.format(item.value)}</strong>
                    </div>
                  </div>
                );
              })}
            </div>

            <table className="sr-only">
              <caption>{outcome === "injury" ? "Injury-involved" : "Fatal"} collision records by road-user group</caption>
              <thead><tr><th>Rank</th><th>Road-user group</th><th>Collision records</th></tr></thead>
              <tbody>{ranked.map((item, index) => <tr key={item.id}><td>{index + 1}</td><th>{item.label}</th><td>{item.value}</td></tr>)}</tbody>
            </table>

            <div className="finding">
              <span aria-hidden="true">↳</span>
              <p>{outcome === "injury" ? <><strong>Motorists rank first.</strong> Their injuries appear in 2.7× as many crash records as pedestrian injuries.</> : <><strong>Pedestrians move to first.</strong> Their deaths appear in 31% more crash records than motorist deaths.</>}</p>
            </div>

            <div className="data-foot">
              <p>Counts are crash records with ≥1 person in the group {outcome === "injury" ? "injured" : "killed"}—not people, probability, or risk. Groups can overlap within a crash.</p>
              <button type="button" className="refresh" onClick={() => void load()} disabled={loading}>↻ Refresh live data</button>
            </div>
          </div>
        )}
      </section>

      <section className="method" aria-labelledby="read-carefully">
        <div><p className="step">READ THIS CAREFULLY</p><h2 id="read-carefully">A live connection is not the same as current conditions.</h2></div>
        <div className="method-copy">
          <p>NYC currently warns that this dataset’s automated updates are temporarily paused. The page requests a fresh aggregate from the published table, whose latest crash date is shown above.</p>
          <details>
            <summary>Method and limitations</summary>
            <div className="details-grid">
              <p><strong>What is counted</strong> Each value is the number of police-reported crash rows where the named group has at least one injury or death.</p>
              <p><strong>What is not measured</strong> Trips, miles traveled, population exposure, personal risk, causation, and fault.</p>
              <p><strong>Why no map yet</strong> This MVP tests a ranking claim. Geography would introduce a different question and missing-coordinate limitations.</p>
              <p><strong>How it stays light</strong> One server-side Socrata aggregate returns only the six chart values plus coverage metadata—never millions of raw rows.</p>
            </div>
          </details>
        </div>
      </section>

      <footer><p>Harm Lens</p><p>Source: NYPD via NYC Open Data · Dataset h9gi-nx95</p></footer>
    </main>
  );
}
