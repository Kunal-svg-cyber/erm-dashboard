import React, { useState, useMemo } from "react";
import { Zap } from "lucide-react";
import { CATEGORIES, scoreOf, bandOf, exceedsAppetite } from "./riskLogic.js";
import { SCENARIOS, applyStress } from "./stressScenarios.js";

function ScoreBadgeMini({ score }) {
  const band = bandOf(score);
  const colors = {
    low: { bg: "#E4EEE8", text: "#2C4E3B" }, med: { bg: "#F5EAD4", text: "#7A5620" },
    high: { bg: "#F3DFD6", text: "#7A311E" }, crit: { bg: "#EFD3D0", text: "#5F1E1E" },
  };
  const c = colors[band.ramp];
  return (
    <span style={{ background: c.bg, color: c.text, borderRadius: 4, padding: "2px 7px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, fontWeight: 600 }}>
      {score} · {band.label}
    </span>
  );
}

export default function StressTest({ risks, thresholds }) {
  const [scenarioId, setScenarioId] = useState(null);
  const [customDeltas, setCustomDeltas] = useState({});
  const [mode, setMode] = useState("preset"); // preset | custom

  const activeDeltas = useMemo(() => {
    if (mode === "custom") return customDeltas;
    const s = SCENARIOS.find(s => s.id === scenarioId);
    return s?.deltas || {};
  }, [mode, scenarioId, customDeltas]);

  const hasActiveStress = Object.keys(activeDeltas).length > 0;
  const stressedRisks = useMemo(() => applyStress(risks, activeDeltas), [risks, activeDeltas]);

  const baseline = useMemo(() => summarize(risks, thresholds), [risks, thresholds]);
  const stressed = useMemo(() => summarize(stressedRisks, thresholds), [stressedRisks, thresholds]);

  function summarize(list, thresholds) {
    const avg = Math.round(list.reduce((s, r) => s + scoreOf(r), 0) / (list.length || 1));
    const critical = list.filter(r => bandOf(scoreOf(r)).label === "Critical").length;
    const breaches = list.filter(r => exceedsAppetite(r, thresholds)).length;
    return { avg, critical, breaches };
  }

  const flipped = useMemo(() => {
    return risks
      .map((r, i) => ({ before: r, after: stressedRisks[i] }))
      .filter(({ before, after }) => bandOf(scoreOf(after)).label !== bandOf(scoreOf(before)).label || scoreOf(after) !== scoreOf(before))
      .filter(({ after }) => bandOf(scoreOf(after)).ramp === "crit" || bandOf(scoreOf(after)).ramp === "high")
      .sort((a, b) => scoreOf(b.after) - scoreOf(a.after));
  }, [risks, stressedRisks]);

  function setCustomDelta(cat, field, value) {
    setCustomDeltas(prev => ({ ...prev, [cat]: { ...prev[cat], [field]: value } }));
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["preset", "custom"].map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer",
            fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, fontWeight: 600, textTransform: "capitalize",
            background: mode === m ? "var(--ink)" : "var(--card)", color: mode === m ? "var(--card)" : "var(--muted)",
          }}>{m}</button>
        ))}
      </div>

      {mode === "preset" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginBottom: 20 }}>
          {SCENARIOS.map(s => (
            <button key={s.id} onClick={() => setScenarioId(s.id === scenarioId ? null : s.id)} style={{
              textAlign: "left", padding: 14, borderRadius: 6, cursor: "pointer",
              border: scenarioId === s.id ? "1.5px solid var(--ink)" : "1px solid var(--border)",
              background: scenarioId === s.id ? "var(--bg)" : "var(--card)",
            }}>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>{s.name}</div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: "var(--muted)", lineHeight: 1.4 }}>{s.description}</div>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 12 }}>Custom shock per category</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {CATEGORIES.map(cat => (
              <div key={cat} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 0" }}>
                <span style={{ fontSize: 12.5, color: "var(--ink)", fontFamily: "'IBM Plex Sans', sans-serif" }}>{cat}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  {["likelihood", "impact"].map(field => (
                    <select key={field} value={customDeltas[cat]?.[field] || 0} onChange={e => setCustomDelta(cat, field, Number(e.target.value))}
                      style={{ fontSize: 11, padding: "3px 4px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)" }}>
                      {[-2, -1, 0, 1, 2].map(v => <option key={v} value={v}>{field[0].toUpperCase()}{v >= 0 ? "+" : ""}{v}</option>)}
                    </select>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasActiveStress ? (
        <div style={{ color: "var(--muted)", fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif" }}>
          Pick a scenario or set a custom shock to see its effect on your open risks. Nothing is saved — this is a simulation only.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            {[{ label: "Baseline", data: baseline }, { label: "Stressed", data: stressed, highlight: true }].map(({ label, data, highlight }) => (
              <div key={label} style={{ background: highlight ? "var(--ink)" : "var(--card)", border: "1px solid var(--border)", borderRadius: 6, padding: 16 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: highlight ? "#C7CEDB" : "var(--muted)", marginBottom: 10 }}>{label}</div>
                <div style={{ display: "flex", gap: 20 }}>
                  <div>
                    <div style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontSize: 30, fontWeight: 700, color: highlight ? "#FFFFFF" : "var(--ink)" }}>{data.avg}</div>
                    <div style={{ fontSize: 11, color: highlight ? "#C7CEDB" : "var(--muted)" }}>avg score</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontSize: 30, fontWeight: 700, color: highlight ? "#E38A6E" : "#8E2E2E" }}>{data.critical}</div>
                    <div style={{ fontSize: 11, color: highlight ? "#C7CEDB" : "var(--muted)" }}>critical</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontSize: 30, fontWeight: 700, color: highlight ? "#E38A6E" : "#B0492E" }}>{data.breaches}</div>
                    <div style={{ fontSize: 11, color: highlight ? "#C7CEDB" : "var(--muted)" }}>appetite breaches</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
              Risks that shift under this scenario ({flipped.length})
            </div>
            {flipped.length === 0 ? (
              <div style={{ padding: 20, color: "var(--muted)", fontSize: 13 }}>No open risks reach High or Critical under this scenario.</div>
            ) : flipped.map(({ before, after }) => (
              <div key={before.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid var(--row-border)" }}>
                <div>
                  <div style={{ fontSize: 13, color: "var(--ink)", fontFamily: "'IBM Plex Sans', sans-serif" }}>{before.title}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{before.category} · {before.owner}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ScoreBadgeMini score={scoreOf(before)} />
                  <Zap size={13} color="var(--muted)" />
                  <ScoreBadgeMini score={scoreOf(after)} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
