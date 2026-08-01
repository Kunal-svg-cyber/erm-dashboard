import React, { useState, useEffect, useMemo, useRef } from "react";
import { AlertTriangle, Shield, ShieldCheck, Plus, X, Search, LayoutGrid, ListChecks, LogOut, Users, Download, Upload, FileText, Moon, Sun, Sparkles, Zap, PieChart, Activity } from "lucide-react";
import { supabase } from "./supabaseClient.js";
import Auth from "./Auth.jsx";
import AdminPanel from "./AdminPanel.jsx";
import TrendChart from "./TrendChart.jsx";
import MFAEnroll from "./MFAEnroll.jsx";
import MFAChallenge from "./MFAChallenge.jsx";
import Athena from "./Athena.jsx";
import StressTest from "./StressTest.jsx";
import ConcentrationAnalysis from "./ConcentrationAnalysis.jsx";
import MonteCarlo from "./MonteCarlo.jsx";
import SemanticSearch from "./SemanticSearch.jsx";
import { exportExecutivePDF } from "./executiveReport.js";
import { exportRisksToCSV, exportRisksToPDF } from "./exportUtils.js";
import { parseRisksCSV, downloadCSVTemplate } from "./importUtils.js";
import { parseRisksPDF } from "./pdfImportUtils.js";
import { CATEGORIES, STATUSES, scoreOf, bandOf, RAMP, exceedsAppetite } from "./riskLogic.js";

// ---------------------------------------------------------------------------
// STEP 1: Static config
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// STEP 3: DB <-> app shape mapping
// (Postgres columns are snake_case; the UI uses camelCase)
// ---------------------------------------------------------------------------
function fromDb(row) {
  return {
    id: row.id, title: row.title, description: row.description || "",
    category: row.category, likelihood: row.likelihood, impact: row.impact,
    residualLikelihood: row.residual_likelihood ?? row.likelihood,
    residualImpact: row.residual_impact ?? row.impact,
    ownerId: row.owner_id, owner: row.owner_name, status: row.status,
    mitigation: row.mitigation || "", targetDate: row.target_date || "",
    lastReviewed: row.last_reviewed || "",
  };
}
function toDb(r, session, profile) {
  return {
    id: r.id, title: r.title, description: r.description, category: r.category,
    likelihood: r.likelihood, impact: r.impact,
    residual_likelihood: r.residualLikelihood ?? r.likelihood,
    residual_impact: r.residualImpact ?? r.impact,
    owner_id: r.ownerId || session.user.id,
    owner_name: r.owner || profile?.full_name || session.user.email,
    status: r.status, mitigation: r.mitigation,
    target_date: r.targetDate || null, last_reviewed: r.lastReviewed || new Date().toISOString().slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// STEP 4: Small building blocks
// ---------------------------------------------------------------------------
function ScoreBadge({ score, exceeds }) {
  const band = bandOf(score);
  const c = RAMP[band.ramp];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      borderRadius: 4, padding: "2px 8px", fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 12, fontWeight: 600, letterSpacing: "0.02em",
    }}>
      {score.toString().padStart(2, "0")} · {band.label}
      {exceeds && <span title="Exceeds this category's risk appetite threshold" style={{ marginLeft: 2 }}>⚠</span>}
    </span>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, padding: "14px 16px" }}>
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>{label}</div>
      <div style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontSize: 36, fontWeight: 700, color: "var(--ink)", lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// STEP 5: Heatmap
// ---------------------------------------------------------------------------
function Heatmap({ risks, onCellClick, activeCell, view = "inherent" }) {
  const grid = useMemo(() => {
    const g = {};
    for (let l = 1; l <= 5; l++) for (let i = 1; i <= 5; i++) g[`${l}-${i}`] = [];
    risks.forEach(r => {
      const l = view === "residual" ? (r.residualLikelihood ?? r.likelihood) : r.likelihood;
      const i = view === "residual" ? (r.residualImpact ?? r.impact) : r.impact;
      g[`${l}-${i}`]?.push(r);
    });
    return g;
  }, [risks, view]);

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>
          Likelihood &times; impact <span style={{ textTransform: "capitalize" }}>({view})</span>
        </span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "var(--muted)" }}>appetite frontier —</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "24px repeat(5, 1fr)", gap: 4 }}>
        <div />
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{ textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "var(--muted)" }}>I{i}</div>
        ))}
        {[5,4,3,2,1].map(l => (
          <React.Fragment key={l}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "var(--muted)" }}>L{l}</div>
            {[1,2,3,4,5].map(i => {
              const cellRisks = grid[`${l}-${i}`];
              const score = l * i;
              const band = bandOf(score);
              const c = RAMP[band.ramp];
              const isFrontier = l + i === 6;
              const key = `${l}-${i}`;
              const active = activeCell === key;
              return (
                <button
                  key={key}
                  onClick={() => onCellClick(cellRisks.length ? key : null)}
                  style={{
                    aspectRatio: "1", background: c.bg,
                    border: active ? `2px solid var(--ink)` : isFrontier ? `1px dashed ${c.border}` : `1px solid ${c.border}33`,
                    borderRadius: 4, cursor: cellRisks.length ? "pointer" : "default",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 14, color: c.text,
                  }}
                  title={`Likelihood ${l} x Impact ${i} = ${score}`}
                >
                  {cellRisks.length > 0 ? cellRisks.length : ""}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
        {Object.entries(RAMP).map(([k, c]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: c.bg, border: `1px solid ${c.border}` }} />
            <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: "var(--muted)", textTransform: "capitalize" }}>{k === "crit" ? "critical" : k === "med" ? "medium" : k}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// STEP 6: Risk register table
// ---------------------------------------------------------------------------
function RiskTable({ risks, onSelect, view = "inherent", thresholds }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
            {["ID", "Title", "Category", `Score (${view})`, "Owner", "Status", "Reviewed"].map(h => (
              <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {risks.map(r => (
            <tr key={r.id} onClick={() => onSelect(r)} style={{ borderBottom: "1px solid var(--row-border)", cursor: "pointer" }}>
              <td style={{ padding: "10px 12px", fontFamily: "'IBM Plex Mono', monospace", color: "var(--muted)" }}>{r.id}</td>
              <td style={{ padding: "10px 12px", color: "var(--ink)", maxWidth: 280 }}>{r.title}</td>
              <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{r.category}</td>
              <td style={{ padding: "10px 12px" }}><ScoreBadge score={scoreOf(r, view)} exceeds={exceedsAppetite(r, thresholds, view)} /></td>
              <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{r.owner}</td>
              <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{r.status}</td>
              <td style={{ padding: "10px 12px", color: "var(--muted)", fontFamily: "'IBM Plex Mono', monospace" }}>{r.lastReviewed}</td>
            </tr>
          ))}
          {risks.length === 0 && (
            <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>No risks match the current filters.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// STEP 7: Add / edit risk drawer. readOnly hides save/delete for viewers
// and for owners looking at someone else's risk.
// ---------------------------------------------------------------------------
function RiskDrawer({ risk, onClose, onSave, onDelete, readOnly }) {
  const [form, setForm] = useState(risk || {
    id: `R-${String(Date.now()).slice(-6)}`, title: "", description: "", category: CATEGORIES[0],
    likelihood: 3, impact: 3, residualLikelihood: 3, residualImpact: 3,
    owner: "", status: "Open", mitigation: "", targetDate: "",
    lastReviewed: new Date().toISOString().slice(0, 10),
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(22,35,58,0.35)", display: "flex", justifyContent: "flex-end", zIndex: 50 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 420, background: "#F5F6F5", height: "100%", padding: 24, overflowY: "auto", borderLeft: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontSize: 24, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
            {risk ? (readOnly ? "View risk" : "Edit risk") : "New risk"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}><X size={20} /></button>
        </div>

        <fieldset disabled={readOnly} style={{ border: "none", padding: 0, margin: 0 }}>
          <Field label="Title"><input style={inputStyle} value={form.title} onChange={e => set("title", e.target.value)} /></Field>
          <Field label="Description"><textarea style={{ ...inputStyle, height: 60 }} value={form.description} onChange={e => set("description", e.target.value)} /></Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Category">
              <select style={inputStyle} value={form.category} onChange={e => set("category", e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select style={inputStyle} value={form.status} onChange={e => set("status", e.target.value)}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label={`Inherent Likelihood (${form.likelihood})`}>
              <input type="range" min={1} max={5} value={form.likelihood} onChange={e => set("likelihood", Number(e.target.value))} style={{ width: "100%" }} />
            </Field>
            <Field label={`Inherent Impact (${form.impact})`}>
              <input type="range" min={1} max={5} value={form.impact} onChange={e => set("impact", Number(e.target.value))} style={{ width: "100%" }} />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label={`Residual Likelihood (${form.residualLikelihood ?? form.likelihood})`}>
              <input type="range" min={1} max={5} value={form.residualLikelihood ?? form.likelihood} onChange={e => set("residualLikelihood", Number(e.target.value))} style={{ width: "100%" }} />
            </Field>
            <Field label={`Residual Impact (${form.residualImpact ?? form.impact})`}>
              <input type="range" min={1} max={5} value={form.residualImpact ?? form.impact} onChange={e => set("residualImpact", Number(e.target.value))} style={{ width: "100%" }} />
            </Field>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: -8, marginBottom: 12 }}>
            Residual = risk level after mitigation is applied. Defaults to match inherent until adjusted.
          </div>

          <div style={{ margin: "8px 0 16px", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>Inherent</div>
              <ScoreBadge score={form.likelihood * form.impact} />
            </div>
            <div>
              <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>Residual</div>
              <ScoreBadge score={(form.residualLikelihood ?? form.likelihood) * (form.residualImpact ?? form.impact)} />
            </div>
          </div>

          <Field label="Owner"><input style={inputStyle} value={form.owner} onChange={e => set("owner", e.target.value)} /></Field>
          <Field label="Mitigation plan"><textarea style={{ ...inputStyle, height: 60 }} value={form.mitigation} onChange={e => set("mitigation", e.target.value)} /></Field>
          <Field label="Target date"><input type="date" style={inputStyle} value={form.targetDate} onChange={e => set("targetDate", e.target.value)} /></Field>
        </fieldset>

        {!readOnly && (
          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button onClick={() => onSave(form)} style={primaryBtn}>Save risk</button>
            {risk && <button onClick={() => onDelete(form.id)} style={dangerBtn}>Delete</button>}
          </div>
        )}
        {readOnly && (
          <div style={{ marginTop: 16, fontSize: 12, color: "var(--muted)" }}>
            You don't have permission to edit this risk.
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "8px 10px", border: "1px solid var(--border)",
  borderRadius: 4, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, background: "var(--card)", color: "var(--ink)",
};
const primaryBtn = {
  flex: 1, padding: "10px 16px", background: "#16233A", color: "#F5F6F5", border: "none",
  borderRadius: 4, fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer",
};
const dangerBtn = {
  padding: "10px 16px", background: "var(--card)", color: "#8E2E2E", border: "1px solid #8E2E2E",
  borderRadius: 4, fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer",
};

// ---------------------------------------------------------------------------
// STEP 8: Dashboard — everything after login lives here
// ---------------------------------------------------------------------------
function Dashboard({ session, profile, theme, setTheme }) {
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [view, setView] = useState("dashboard");
  const [drawerRisk, setDrawerRisk] = useState(undefined);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [activeCell, setActiveCell] = useState(null);
  const reportRef = useRef(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const csvInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [riskView, setRiskView] = useState("inherent"); // inherent | residual
  const [thresholds, setThresholds] = useState({});

  const role = profile?.role || "owner";
  const canCreate = role === "admin" || role === "owner";
  const canEdit = (r) => role === "admin" || r.ownerId === session.user.id;

  useEffect(() => { loadRisks(); loadThresholds(); }, []);

  const [liveConnected, setLiveConnected] = useState(false);
  useEffect(() => {
    const channel = supabase
      .channel("risks-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "risks" }, () => {
        loadRisks();
      })
      .subscribe((status) => setLiveConnected(status === "SUBSCRIBED"));
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadThresholds() {
    const { data } = await supabase.from("category_thresholds").select("*");
    if (data) {
      const map = {};
      data.forEach(row => { map[row.category] = row.appetite_score; });
      setThresholds(map);
    }
  }

  async function loadRisks() {
    setLoading(true);
    const { data, error } = await supabase.from("risks").select("*").order("created_at", { ascending: false });
    if (error) setErrorMsg(error.message);
    else setRisks(data.map(fromDb));
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return risks
      .filter(r => catFilter === "All" || r.category === catFilter)
      .filter(r => statusFilter === "All" || r.status === statusFilter)
      .filter(r => r.title.toLowerCase().includes(search.toLowerCase()))
      .filter(r => {
        if (!activeCell) return true;
        const l = riskView === "residual" ? (r.residualLikelihood ?? r.likelihood) : r.likelihood;
        const i = riskView === "residual" ? (r.residualImpact ?? r.impact) : r.impact;
        return `${l}-${i}` === activeCell;
      })
      .sort((a, b) => scoreOf(b, riskView) - scoreOf(a, riskView));
  }, [risks, catFilter, statusFilter, search, activeCell, riskView]);

  const openRisks = risks.filter(r => r.status !== "Closed");
  const avgScore = Math.round(openRisks.reduce((s, r) => s + scoreOf(r, riskView), 0) / (openRisks.length || 1));
  const criticalCount = openRisks.filter(r => bandOf(scoreOf(r, riskView)).label === "Critical").length;
  const appetiteBreaches = openRisks.filter(r => exceedsAppetite(r, thresholds, riskView)).length;
  const topRisks = [...openRisks].sort((a, b) => scoreOf(b, riskView) - scoreOf(a, riskView)).slice(0, 5);

  async function saveRisk(r) {
    const payload = toDb(r, session, profile);
    const { error } = await supabase.from("risks").upsert(payload);
    if (error) { setErrorMsg(error.message); return; }
    // Fire-and-forget: keeps the risk searchable by meaning. Doesn't block
    // the save if it's slow or the embedding function isn't deployed yet.
    supabase.functions.invoke("embed-risk", { body: { riskId: payload.id } }).catch(() => {});
    setDrawerRisk(undefined);
    loadRisks();
  }
  async function deleteRisk(id) {
    const { error } = await supabase.from("risks").delete().eq("id", id);
    if (error) { setErrorMsg(error.message); return; }
    setDrawerRisk(undefined);
    loadRisks();
  }

  async function handleExecutivePdf() {
    if (!reportRef.current) return;
    setGeneratingPdf(true);
    try {
      await exportExecutivePDF(reportRef.current, {
        orgName: "Meridian Holdings",
        stats: { open: openRisks.length, avg: avgScore, critical: criticalCount },
        topRisks,
      });
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function applyImportedRows(rows, errors) {
    const errorRowNums = new Set(errors.map(err => Number(err.match(/^Row (\d+):/)?.[1])));
    const validRows = rows.filter(r => !errorRowNums.has(r._rowNum));
    const payload = validRows.map(({ _rowNum, ...r }) => toDb(r, session, profile));
    if (payload.length > 0) {
      const { error } = await supabase.from("risks").upsert(payload);
      if (error) { setErrorMsg(error.message); return; }
    }
    const errorSummary = errors.length
      ? ` Skipped ${errorRowNums.size} row(s): ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? ` (+${errors.length - 3} more)` : ""}`
      : "";
    setImportMsg(`Imported ${payload.length} risk(s).${errorSummary}`);
    loadRisks();
  }

  async function handleCsvImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg("");
    try {
      const { rows, errors } = await parseRisksCSV(file);
      await applyImportedRows(rows, errors);
    } catch (err) {
      setErrorMsg("Failed to parse CSV: " + err.message);
    }
    setImporting(false);
    e.target.value = "";
  }

  async function handlePdfImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg("");
    try {
      const { rows, errors } = await parseRisksPDF(file);
      await applyImportedRows(rows, errors);
    } catch (err) {
      setErrorMsg("Failed to read PDF: " + err.message);
    }
    setImporting(false);
    e.target.value = "";
  }

  return (
    <div className="erm-shell" style={{ minHeight: "100vh", background: "var(--bg)", display: "flex" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        @media (max-width: 768px) {
          .erm-shell { flex-direction: column !important; }
          .erm-sidebar { width: 100% !important; flex-direction: row !important; padding: 10px 16px !important; justify-content: space-between; }
          .erm-sidebar > div[style*="flex: 1"] { display: none !important; }
          .erm-main { padding: 16px !important; }
          .erm-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .erm-heatmap-row { grid-template-columns: 1fr !important; }
          .erm-filter-bar { flex-direction: column !important; }
          .erm-filter-bar > select { width: 100% !important; }
          .erm-header { flex-direction: column !important; align-items: flex-start !important; gap: 12px; }
          .erm-header-actions { width: 100%; flex-wrap: wrap; }
        }
        .erm-tooltip {
          position: absolute;
          left: 52px;
          top: 50%;
          transform: translateY(-50%) translateX(-6px);
          background: #16233A;
          color: #F5F6F5;
          font-family: 'IBM Plex Sans', sans-serif;
          font-size: 12px;
          font-weight: 600;
          padding: 6px 10px;
          border-radius: 4px;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.15s ease, transform 0.15s ease;
          z-index: 50;
        }
        .erm-tooltip::before {
          content: "";
          position: absolute;
          left: -4px;
          top: 50%;
          transform: translateY(-50%);
          border-width: 4px 4px 4px 0;
          border-style: solid;
          border-color: transparent #16233A transparent transparent;
        }
        .erm-tooltip-wrap:hover .erm-tooltip {
          opacity: 1;
          transform: translateY(-50%) translateX(0);
        }
      `}</style>

      <div className="erm-sidebar" style={{ width: 68, background: "#16233A", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 20, gap: 8 }}>
        <Shield size={22} color="#F5F6F5" style={{ marginBottom: 16 }} />
        <SideBtn active={view === "dashboard"} onClick={() => setView("dashboard")} icon={<LayoutGrid size={18} />} label="Dashboard" />
        <SideBtn active={view === "register"} onClick={() => setView("register")} icon={<ListChecks size={18} />} label="Risk Register" />
        {role === "admin" && (
          <SideBtn active={view === "admin"} onClick={() => setView("admin")} icon={<Users size={18} />} label="Admin" />
        )}
        <SideBtn active={view === "security"} onClick={() => setView("security")} icon={<ShieldCheck size={18} />} label="Security" />
        <SideBtn active={view === "athena"} onClick={() => setView("athena")} icon={<Sparkles size={18} />} label="Athena" />
        <SideBtn active={view === "stress"} onClick={() => setView("stress")} icon={<Zap size={18} />} label="Stress Test" />
        <SideBtn active={view === "montecarlo"} onClick={() => setView("montecarlo")} icon={<Activity size={18} />} label="Monte Carlo" />
        <SideBtn active={view === "concentration"} onClick={() => setView("concentration")} icon={<PieChart size={18} />} label="Concentration" />
        <SideBtn active={view === "semanticsearch"} onClick={() => setView("semanticsearch")} icon={<Search size={18} />} label="Semantic Search" />
        <div style={{ flex: 1 }} />
        <div className="erm-tooltip-wrap" style={{ position: "relative" }}>
          <button onClick={() => setTheme(t => t === "light" ? "dark" : "light")} style={{ width: 40, height: 40, marginBottom: 4, borderRadius: 6, border: "none", background: "transparent", color: "#8B9AAC", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <span className="erm-tooltip">{theme === "light" ? "Dark mode" : "Light mode"}</span>
        </div>
        <div className="erm-tooltip-wrap" style={{ position: "relative" }}>
          <button onClick={() => supabase.auth.signOut()} style={{ width: 40, height: 40, marginBottom: 16, borderRadius: 6, border: "none", background: "transparent", color: "#8B9AAC", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LogOut size={18} />
          </button>
          <span className="erm-tooltip">Sign out</span>
        </div>
      </div>

      <div className="erm-main" style={{ flex: 1, padding: "24px 32px", minWidth: 0 }}>
        <div className="erm-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)" }}>
              Meridian Holdings · {profile?.full_name || session.user.email} · {role}
              {liveConnected && (
                <span style={{ marginLeft: 8, color: "#4C7A5E" }}>
                  <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#4C7A5E", marginRight: 4 }} />
                  Live
                </span>
              )}
            </div>
            <h1 style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontSize: 32, fontWeight: 700, color: "var(--ink)", margin: "2px 0 0" }}>
              {view === "dashboard" ? "Enterprise risk exposure"
                : view === "register" ? "Risk register"
                : view === "admin" ? "User administration"
                : view === "athena" ? "Athena — risk assistant"
                : view === "stress" ? "Stress testing"
                : view === "montecarlo" ? "Monte Carlo simulation"
                : view === "concentration" ? "Concentration analysis"
                : view === "semanticsearch" ? "Semantic search"
                : "Account security"}
            </h1>
          </div>
          <div className="erm-header-actions" style={{ display: "flex", gap: 8 }}>
            {view === "dashboard" && (
              <button onClick={handleExecutivePdf} disabled={generatingPdf} style={{ ...dangerBtn, color: "var(--ink)", borderColor: "var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
                <FileText size={14} /> {generatingPdf ? "Generating..." : "Executive PDF"}
              </button>
            )}
            {view === "register" && (
              <>
                {canCreate && (
                  <>
                    <input ref={csvInputRef} type="file" accept=".csv" onChange={handleCsvImport} style={{ display: "none" }} />
                    <button onClick={downloadCSVTemplate} style={{ ...dangerBtn, color: "var(--ink)", borderColor: "var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
                      <FileText size={14} /> Template
                    </button>
                    <button onClick={() => csvInputRef.current?.click()} disabled={importing} style={{ ...dangerBtn, color: "var(--ink)", borderColor: "var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
                      <Upload size={14} /> {importing ? "Importing..." : "Import CSV"}
                    </button>
                    <input ref={pdfInputRef} type="file" accept=".pdf" onChange={handlePdfImport} style={{ display: "none" }} />
                    <button onClick={() => pdfInputRef.current?.click()} disabled={importing} style={{ ...dangerBtn, color: "var(--ink)", borderColor: "var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
                      <Upload size={14} /> {importing ? "Importing..." : "Import PDF"}
                    </button>
                  </>
                )}
                <button onClick={() => exportRisksToCSV(filtered)} style={{ ...dangerBtn, color: "var(--ink)", borderColor: "var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
                  <Download size={14} /> CSV
                </button>
                <button onClick={() => exportRisksToPDF(filtered)} style={{ ...dangerBtn, color: "var(--ink)", borderColor: "var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
                  <FileText size={14} /> PDF
                </button>
              </>
            )}
            {canCreate && (view === "dashboard" || view === "register") && (
              <button onClick={() => setDrawerRisk(null)} style={{ ...primaryBtn, flex: "none", display: "flex", alignItems: "center", gap: 6 }}>
                <Plus size={16} /> New risk
              </button>
            )}
          </div>
        </div>

        {errorMsg && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#EFD3D0", border: "1px solid #8E2E2E", color: "#5F1E1E", borderRadius: 4, padding: "8px 12px", marginBottom: 16, fontSize: 13 }}>
            <AlertTriangle size={14} /> {errorMsg}
          </div>
        )}
        {importMsg && (
          <div style={{ background: "#E4EEE8", border: "1px solid #4C7A5E", color: "#2C4E3B", borderRadius: 4, padding: "8px 12px", marginBottom: 16, fontSize: 13 }}>
            {importMsg}
          </div>
        )}

        {loading ? (
          <div style={{ color: "var(--muted)", fontFamily: "'IBM Plex Sans', sans-serif" }}>Loading risks...</div>
        ) : view === "dashboard" ? (
          <>
            <div ref={reportRef} style={{ background: "var(--bg)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 4, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, padding: 3 }}>
                  {["inherent", "residual"].map(v => (
                    <button key={v} onClick={() => setRiskView(v)} style={{
                      padding: "6px 14px", borderRadius: 4, border: "none", cursor: "pointer",
                      fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, fontWeight: 600, textTransform: "capitalize",
                      background: riskView === v ? "var(--ink)" : "transparent",
                      color: riskView === v ? "var(--bg)" : "var(--muted)",
                    }}>{v}</button>
                  ))}
                </div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: "var(--muted)" }}>
                  {riskView === "inherent" ? "Risk before mitigation" : "Risk after mitigation is applied"}
                </div>
              </div>

              <div className="erm-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
                <StatCard label="Open risks" value={openRisks.length} sub={`${risks.length} total logged`} />
                <StatCard label={`Avg. score (${riskView})`} value={avgScore} sub="likelihood x impact" />
                <StatCard label="Critical risks" value={criticalCount} sub="score 15+" />
                <StatCard label="Appetite breaches" value={appetiteBreaches} sub="exceeds category threshold" />
                <StatCard label="Categories tracked" value={CATEGORIES.length} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <TrendChart />
              </div>

              <div className="erm-heatmap-row" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16, alignItems: "start" }}>
                <Heatmap risks={openRisks} onCellClick={setActiveCell} activeCell={activeCell} view={riskView} />
                <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, padding: 16 }}>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 12 }}>Top 5 exposures</div>
                  {topRisks.map(r => (
                    <div key={r.id} onClick={() => setDrawerRisk(r)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--row-border)", cursor: "pointer" }}>
                      <div>
                        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: "var(--ink)" }}>{r.title}</div>
                        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: "var(--muted)" }}>{r.owner} · {r.category}</div>
                      </div>
                      <ScoreBadge score={scoreOf(r, riskView)} exceeds={exceedsAppetite(r, thresholds, riskView)} />
                    </div>
                  ))}
                  {topRisks.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>No open risks yet.</div>}
                </div>
              </div>
            </div>

            {activeCell && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: "var(--muted)" }}>Filtered to heatmap cell {activeCell}</span>
                  <button onClick={() => setActiveCell(null)} style={{ background: "none", border: "none", color: "var(--ink)", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Clear</button>
                </div>
                <RiskTable risks={filtered} onSelect={setDrawerRisk} view={riskView} thresholds={thresholds} />
              </div>
            )}
          </>
        ) : view === "register" ? (
          <>
            <div className="erm-filter-bar" style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Search size={15} style={{ position: "absolute", left: 10, top: 10, color: "var(--muted)" }} />
                <input placeholder="Search risks..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: 32 }} />
              </div>
              <select style={{ ...inputStyle, width: 180 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                <option>All</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <select style={{ ...inputStyle, width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option>All</option>{STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <RiskTable risks={filtered} onSelect={setDrawerRisk} view={riskView} thresholds={thresholds} />
          </>
        ) : view === "admin" ? (
          <AdminPanel currentUserId={session.user.id} />
        ) : view === "athena" ? (
          <Athena />
        ) : view === "stress" ? (
          <StressTest risks={openRisks} thresholds={thresholds} />
        ) : view === "montecarlo" ? (
          <MonteCarlo risks={openRisks} />
        ) : view === "concentration" ? (
          <ConcentrationAnalysis risks={openRisks} />
        ) : view === "semanticsearch" ? (
          <SemanticSearch onSelectRisk={(id) => { const r = risks.find(x => x.id === id); if (r) setDrawerRisk(r); }} />
        ) : (
          <MFAEnroll />
        )}
      </div>

      {drawerRisk !== undefined && (
        <RiskDrawer
          risk={drawerRisk}
          onClose={() => setDrawerRisk(undefined)}
          onSave={saveRisk}
          onDelete={deleteRisk}
          readOnly={drawerRisk ? !canEdit(drawerRisk) : !canCreate}
        />
      )}
    </div>
  );
}

function SideBtn({ active, onClick, icon, label }) {
  return (
    <div className="erm-tooltip-wrap" style={{ position: "relative" }}>
      <button onClick={onClick} style={{
        width: 40, height: 40, borderRadius: 6, border: "none", cursor: "pointer",
        background: active ? "#2C3E5A" : "transparent", color: active ? "#F5F6F5" : "#8B9AAC",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>{icon}</button>
      {label && <span className="erm-tooltip">{label}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// STEP 9: AuthGate — owns the auth session, renders Auth or Dashboard
// ---------------------------------------------------------------------------
function AuthGate({ theme, setTheme }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [checking, setChecking] = useState(true);
  const [needsMfa, setNeedsMfa] = useState(false);

  async function checkMfa() {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data && data.nextLevel === "aal2" && data.currentLevel !== "aal2") {
      setNeedsMfa(true);
    } else {
      setNeedsMfa(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) await checkMfa();
      setChecking(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) await checkMfa();
      else setNeedsMfa(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    supabase.from("profiles").select("*").eq("id", session.user.id).single()
      .then(({ data }) => setProfile(data));
  }, [session]);

  if (checking) return null;
  if (!session) return <Auth />;
  if (needsMfa) return <MFAChallenge onVerified={() => setNeedsMfa(false)} />;
  return <Dashboard session={session} profile={profile} theme={theme} setTheme={setTheme} />;
}

// ---------------------------------------------------------------------------
// STEP 10: App — top-level theme provider, wraps everything in CSS variables
// ---------------------------------------------------------------------------
export default function App() {
  const [theme, setTheme] = useState("light");
  return (
    <div data-theme={theme}>
      <style>{`
        [data-theme="light"] { --bg: #EEF1F0; --card: #FFFFFF; --border: #C9D1D6; --row-border: #E5E8EA; --ink: #16233A; --muted: #5B6B7C; }
        [data-theme="dark"] { --bg: #0E1620; --card: #16202C; --border: #2B3A48; --row-border: #22303C; --ink: #EAEEF1; --muted: #8FA0AF; }
      `}</style>
      <AuthGate theme={theme} setTheme={setTheme} />
    </div>
  );
}
