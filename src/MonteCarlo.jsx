import React, { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// Triangular distribution sample: models "likely value = current score,
// but could plausibly swing a notch either way" — the standard cheap
// approximation used when you don't have enough history for a real
// empirical distribution (which is true for any young risk register).
function triangular(min, mode, max) {
  const u = Math.random();
  const c = (mode - min) / (max - min);
  if (u < c) return min + Math.sqrt(u * (max - min) * (mode - min));
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

function sampleRiskScore(r) {
  const l = triangular(Math.max(1, r.likelihood - 1), r.likelihood, Math.min(5, r.likelihood + 1));
  const i = triangular(Math.max(1, r.impact - 1), r.impact, Math.min(5, r.impact + 1));
  return l * i;
}

function runSimulation(risks, trials) {
  const portfolioTotals = [];
  let criticalTrialCount = 0;
  for (let t = 0; t < trials; t++) {
    let total = 0;
    let hasCritical = false;
    risks.forEach(r => {
      const score = sampleRiskScore(r);
      total += score;
      if (score >= 15) hasCritical = true;
    });
    portfolioTotals.push(total);
    if (hasCritical) criticalTrialCount++;
  }
  portfolioTotals.sort((a, b) => a - b);
  const pct = (p) => portfolioTotals[Math.min(portfolioTotals.length - 1, Math.floor((p / 100) * portfolioTotals.length))];
  return {
    totals: portfolioTotals,
    p50: pct(50), p90: pct(90), p95: pct(95), p99: pct(99),
    criticalProbability: criticalTrialCount / trials,
  };
}

function histogramBins(totals, binCount = 20) {
  if (totals.length === 0) return [];
  const min = totals[0], max = totals[totals.length - 1];
  const width = (max - min) / binCount || 1;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    range: Math.round(min + i * width),
    count: 0,
  }));
  totals.forEach(v => {
    const idx = Math.min(binCount - 1, Math.floor((v - min) / width));
    bins[idx].count++;
  });
  return bins;
}

export default function MonteCarlo({ risks }) {
  const [trials, setTrials] = useState(2000);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  function run() {
    setRunning(true);
    // setTimeout lets the "running" state paint before the (synchronous,
    // CPU-bound) simulation blocks the main thread — trials are capped
    // at a level that stays well under a second even on modest hardware.
    setTimeout(() => {
      setResult(runSimulation(risks, trials));
      setRunning(false);
    }, 30);
  }

  const bins = useMemo(() => result ? histogramBins(result.totals) : [], [result]);

  return (
    <div>
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: "var(--muted)", marginBottom: 16, maxWidth: 680, lineHeight: 1.5 }}>
        Runs {trials.toLocaleString()} simulated trials, treating each risk's likelihood and impact as a range rather than a fixed number, to estimate the distribution of total portfolio exposure — the same logic behind Value-at-Risk style analysis, applied to qualitative risk scores.
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <select value={trials} onChange={e => setTrials(Number(e.target.value))} style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--card)", color: "var(--ink)", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13 }}>
          {[500, 2000, 5000, 10000].map(n => <option key={n} value={n}>{n.toLocaleString()} trials</option>)}
        </select>
        <button onClick={run} disabled={running || risks.length === 0} style={{
          padding: "8px 18px", background: "var(--ink)", color: "var(--card)", border: "none", borderRadius: 4,
          fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: running ? "not-allowed" : "pointer",
        }}>
          {running ? "Simulating..." : "Run simulation"}
        </button>
        {risks.length === 0 && <span style={{ fontSize: 12, color: "var(--muted)" }}>No open risks to simulate.</span>}
      </div>

      {result && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "P50 (median)", value: Math.round(result.p50) },
              { label: "P90", value: Math.round(result.p90) },
              { label: "P95", value: Math.round(result.p95) },
              { label: "P99 (tail exposure)", value: Math.round(result.p99) },
            ].map(s => (
              <div key={s.label} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>{s.label}</div>
                <div style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontSize: 32, fontWeight: 700, color: "var(--ink)" }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, padding: "12px 16px", marginBottom: 20, fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif", color: "var(--ink)" }}>
            Probability at least one risk hits Critical (score 15+) in a given trial: <strong>{(result.criticalProbability * 100).toFixed(1)}%</strong>
          </div>

          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, padding: 16 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 12 }}>Simulated portfolio exposure distribution</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bins} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--row-border)" vertical={false} />
                <XAxis dataKey="range" tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontFamily: "IBM Plex Sans", fontSize: 12 }} />
                <Bar dataKey="count" fill="#16233A" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
