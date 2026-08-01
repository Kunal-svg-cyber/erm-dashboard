import React, { useMemo } from "react";
import { scoreOf } from "./riskLogic.js";

const CONCENTRATION_THRESHOLD = 0.30; // flag if one owner/category holds 30%+ of total exposure

function groupBy(risks, keyFn) {
  const map = {};
  risks.forEach(r => {
    const key = keyFn(r) || "Unassigned";
    if (!map[key]) map[key] = { key, count: 0, score: 0 };
    map[key].count += 1;
    map[key].score += scoreOf(r);
  });
  return Object.values(map).sort((a, b) => b.score - a.score);
}

function ConcentrationBar({ title, groups, totalScore }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, padding: 16 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 14 }}>{title}</div>
      {groups.map(g => {
        const pct = totalScore ? g.score / totalScore : 0;
        const breach = pct >= CONCENTRATION_THRESHOLD;
        return (
          <div key={g.key} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12.5, color: "var(--ink)", fontFamily: "'IBM Plex Sans', sans-serif" }}>
                {g.key} {breach && <span title="Exceeds 30% concentration threshold" style={{ color: "#8E2E2E" }}>⚠</span>}
              </span>
              <span style={{ fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: breach ? "#8E2E2E" : "var(--muted)" }}>
                {(pct * 100).toFixed(0)}% · {g.count} risk{g.count === 1 ? "" : "s"}
              </span>
            </div>
            <div style={{ height: 6, background: "var(--bg)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct * 100}%`, background: breach ? "#B0492E" : "#16233A", borderRadius: 3 }} />
            </div>
          </div>
        );
      })}
      {groups.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>No open risks yet.</div>}
    </div>
  );
}

export default function ConcentrationAnalysis({ risks }) {
  const totalScore = useMemo(() => risks.reduce((s, r) => s + scoreOf(r), 0), [risks]);
  const byOwner = useMemo(() => groupBy(risks, r => r.owner), [risks]);
  const byCategory = useMemo(() => groupBy(risks, r => r.category), [risks]);

  const ownerBreaches = byOwner.filter(g => totalScore && g.score / totalScore >= CONCENTRATION_THRESHOLD);
  const categoryBreaches = byCategory.filter(g => totalScore && g.score / totalScore >= CONCENTRATION_THRESHOLD);

  return (
    <div>
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: "var(--muted)", marginBottom: 16, maxWidth: 680, lineHeight: 1.5 }}>
        Mirrors how institutional risk functions monitor investor/counterparty concentration — flags when too much aggregate exposure sits with a single owner or category rather than being diversified.
      </div>

      {(ownerBreaches.length > 0 || categoryBreaches.length > 0) && (
        <div style={{ background: "#EFD3D0", border: "1px solid #8E2E2E", borderRadius: 6, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#5F1E1E", fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {ownerBreaches.map(g => <div key={g.key}>⚠ {g.key} holds {((g.score / totalScore) * 100).toFixed(0)}% of total open exposure — concentrated ownership risk</div>)}
          {categoryBreaches.map(g => <div key={g.key}>⚠ {g.key} accounts for {((g.score / totalScore) * 100).toFixed(0)}% of total open exposure — concentrated category risk</div>)}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <ConcentrationBar title="Concentration by owner" groups={byOwner} totalScore={totalScore} />
        <ConcentrationBar title="Concentration by category" groups={byCategory} totalScore={totalScore} />
      </div>
    </div>
  );
}
