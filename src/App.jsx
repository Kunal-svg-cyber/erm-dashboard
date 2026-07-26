import React, { useState, useEffect, useMemo } from "react";
import { AlertTriangle, Shield, Plus, X, Search, LayoutGrid, ListChecks, LogOut } from "lucide-react";
import { supabase } from "./supabaseClient.js";
import Auth from "./Auth.jsx";

// ---------------------------------------------------------------------------
// STEP 1: Static config
// ---------------------------------------------------------------------------
const CATEGORIES = ["Strategic", "Operational", "Financial", "Compliance", "Cyber", "Reputational"];
const STATUSES = ["Open", "Mitigating", "Escalated", "Closed"];

// ---------------------------------------------------------------------------
// STEP 2: Scoring logic
// ---------------------------------------------------------------------------
function scoreOf(r) { return r.likelihood * r.impact; }

function bandOf(score) {
  if (score >= 15) return { label: "Critical", ramp: "crit" };
  if (score >= 10) return { label: "High", ramp: "high" };
  if (score >= 5) return { label: "Medium", ramp: "med" };
  return { label: "Low", ramp: "low" };
}

const RAMP = {
  low: { bg: "#E4EEE8", border: "#4C7A5E", text: "#2C4E3B" },
  med: { bg: "#F5EAD4", border: "#C68A2E", text: "#7A5620" },
  high: { bg: "#F3DFD6", border: "#B0492E", text: "#7A311E" },
  crit: { bg: "#EFD3D0", border: "#8E2E2E", text: "#5F1E1E" },
};

// ---------------------------------------------------------------------------
// STEP 3: DB <-> app shape mapping
// (Postgres columns are snake_case; the UI uses camelCase)
// ---------------------------------------------------------------------------
function fromDb(row) {
  return {
    id: row.id, title: row.title, description: row.description || "",
    category: row.category, likelihood: row.likelihood, impact: row.impact,
    ownerId: row.owner_id, owner: row.owner_name, status: row.status,
    mitigation: row.mitigation || "", targetDate: row.target_date || "",
    lastReviewed: row.last_reviewed || "",
  };
}
function toDb(r, session, profile) {
  return {
    id: r.id, title: r.title, description: r.description, category: r.category,
    likelihood: r.likelihood, impact: r.impact,
    owner_id: r.ownerId || session.user.id,
    owner_name: r.owner || profile?.full_name || session.user.email,
    status: r.status, mitigation: r.mitigation,
    target_date: r.targetDate || null, last_reviewed: r.lastReviewed || new Date().toISOString().slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// STEP 4: Small building blocks
// ---------------------------------------------------------------------------
function ScoreBadge({ score }) {
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
    </span>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #C9D1D6", borderRadius: 6, padding: "14px 16px" }}>
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#5B6B7C" }}>{label}</div>
      <div style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontSize: 36, fontWeight: 700, color: "#16233A", lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: "#5B6B7C", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// STEP 5: Heatmap
// ---------------------------------------------------------------------------
function Heatmap({ risks, onCellClick, activeCell }) {
  const grid = useMemo(() => {
    const g = {};
    for (let l = 1; l <= 5; l++) for (let i = 1; i <= 5; i++) g[`${l}-${i}`] = [];
    risks.forEach(r => g[`${r.likelihood}-${r.impact}`]?.push(r));
    return g;
  }, [risks]);

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #C9D1D6", borderRadius: 6, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#5B6B7C" }}>Likelihood &times; impact</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#5B6B7C" }}>appetite frontier —</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "24px repeat(5, 1fr)", gap: 4 }}>
        <div />
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{ textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#5B6B7C" }}>I{i}</div>
        ))}
        {[5,4,3,2,1].map(l => (
          <React.Fragment key={l}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#5B6B7C" }}>L{l}</div>
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
                    border: active ? `2px solid #16233A` : isFrontier ? `1px dashed ${c.border}` : `1px solid ${c.border}33`,
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
            <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: "#5B6B7C", textTransform: "capitalize" }}>{k === "crit" ? "critical" : k === "med" ? "medium" : k}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// STEP 6: Risk register table
// ---------------------------------------------------------------------------
function RiskTable({ risks, onSelect }) {
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #C9D1D6", borderRadius: 6, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#EEF1F0", borderBottom: "1px solid #C9D1D6" }}>
            {["ID", "Title", "Category", "Score", "Owner", "Status", "Reviewed"].map(h => (
              <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5B6B7C", fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {risks.map(r => (
            <tr key={r.id} onClick={() => onSelect(r)} style={{ borderBottom: "1px solid #E5E8EA", cursor: "pointer" }}>
              <td style={{ padding: "10px 12px", fontFamily: "'IBM Plex Mono', monospace", color: "#5B6B7C" }}>{r.id}</td>
              <td style={{ padding: "10px 12px", color: "#16233A", maxWidth: 280 }}>{r.title}</td>
              <td style={{ padding: "10px 12px", color: "#5B6B7C" }}>{r.category}</td>
              <td style={{ padding: "10px 12px" }}><ScoreBadge score={scoreOf(r)} /></td>
              <td style={{ padding: "10px 12px", color: "#5B6B7C" }}>{r.owner}</td>
              <td style={{ padding: "10px 12px", color: "#5B6B7C" }}>{r.status}</td>
              <td style={{ padding: "10px 12px", color: "#5B6B7C", fontFamily: "'IBM Plex Mono', monospace" }}>{r.lastReviewed}</td>
            </tr>
          ))}
          {risks.length === 0 && (
            <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#5B6B7C" }}>No risks match the current filters.</td></tr>
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
    likelihood: 3, impact: 3, owner: "", status: "Open", mitigation: "", targetDate: "",
    lastReviewed: new Date().toISOString().slice(0, 10),
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(22,35,58,0.35)", display: "flex", justifyContent: "flex-end", zIndex: 50 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 420, background: "#F5F6F5", height: "100%", padding: 24, overflowY: "auto", borderLeft: "1px solid #C9D1D6" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontSize: 24, fontWeight: 700, color: "#16233A", margin: 0 }}>
            {risk ? (readOnly ? "View risk" : "Edit risk") : "New risk"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#5B6B7C" }}><X size={20} /></button>
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
            <Field label={`Likelihood (${form.likelihood})`}>
              <input type="range" min={1} max={5} value={form.likelihood} onChange={e => set("likelihood", Number(e.target.value))} style={{ width: "100%" }} />
            </Field>
            <Field label={`Impact (${form.impact})`}>
              <input type="range" min={1} max={5} value={form.impact} onChange={e => set("impact", Number(e.target.value))} style={{ width: "100%" }} />
            </Field>
          </div>

          <div style={{ margin: "8px 0 16px" }}><ScoreBadge score={form.likelihood * form.impact} /></div>

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
          <div style={{ marginTop: 16, fontSize: 12, color: "#5B6B7C" }}>
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
      <label style={{ display: "block", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5B6B7C", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "8px 10px", border: "1px solid #C9D1D6",
  borderRadius: 4, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, background: "#FFFFFF", color: "#16233A",
};
const primaryBtn = {
  flex: 1, padding: "10px 16px", background: "#16233A", color: "#F5F6F5", border: "none",
  borderRadius: 4, fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer",
};
const dangerBtn = {
  padding: "10px 16px", background: "#FFFFFF", color: "#8E2E2E", border: "1px solid #8E2E2E",
  borderRadius: 4, fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer",
};

// ---------------------------------------------------------------------------
// STEP 8: Dashboard — everything after login lives here
// ---------------------------------------------------------------------------
function Dashboard({ session, profile }) {
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [view, setView] = useState("dashboard");
  const [drawerRisk, setDrawerRisk] = useState(undefined);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [activeCell, setActiveCell] = useState(null);

  const role = profile?.role || "owner";
  const canCreate = role === "admin" || role === "owner";
  const canEdit = (r) => role === "admin" || (role === "owner" && r.ownerId === session.user.id);

  useEffect(() => { loadRisks(); }, []);

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
      .filter(r => !activeCell || `${r.likelihood}-${r.impact}` === activeCell)
      .sort((a, b) => scoreOf(b) - scoreOf(a));
  }, [risks, catFilter, statusFilter, search, activeCell]);

  const openRisks = risks.filter(r => r.status !== "Closed");
  const avgScore = Math.round(openRisks.reduce((s, r) => s + scoreOf(r), 0) / (openRisks.length || 1));
  const criticalCount = openRisks.filter(r => bandOf(scoreOf(r)).label === "Critical").length;
  const topRisks = [...openRisks].sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, 5);

  async function saveRisk(r) {
    const payload = toDb(r, session, profile);
    const { error } = await supabase.from("risks").upsert(payload);
    if (error) { setErrorMsg(error.message); return; }
    setDrawerRisk(undefined);
    loadRisks();
  }
  async function deleteRisk(id) {
    const { error } = await supabase.from("risks").delete().eq("id", id);
    if (error) { setErrorMsg(error.message); return; }
    setDrawerRisk(undefined);
    loadRisks();
  }

  return (
    <div style={{ minHeight: "100vh", background: "#EEF1F0", display: "flex" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');`}</style>

      <div style={{ width: 68, background: "#16233A", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 20, gap: 8 }}>
        <Shield size={22} color="#F5F6F5" style={{ marginBottom: 16 }} />
        <SideBtn active={view === "dashboard"} onClick={() => setView("dashboard")} icon={<LayoutGrid size={18} />} />
        <SideBtn active={view === "register"} onClick={() => setView("register")} icon={<ListChecks size={18} />} />
        <div style={{ flex: 1 }} />
        <button onClick={() => supabase.auth.signOut()} title="Sign out" style={{ width: 40, height: 40, marginBottom: 16, borderRadius: 6, border: "none", background: "transparent", color: "#8B9AAC", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <LogOut size={18} />
        </button>
      </div>

      <div style={{ flex: 1, padding: "24px 32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5B6B7C" }}>
              Meridian Holdings · {profile?.full_name || session.user.email} · {role}
            </div>
            <h1 style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontSize: 32, fontWeight: 700, color: "#16233A", margin: "2px 0 0" }}>
              {view === "dashboard" ? "Enterprise risk exposure" : "Risk register"}
            </h1>
          </div>
          {canCreate && (
            <button onClick={() => setDrawerRisk(null)} style={{ ...primaryBtn, flex: "none", display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={16} /> New risk
            </button>
          )}
        </div>

        {errorMsg && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#EFD3D0", border: "1px solid #8E2E2E", color: "#5F1E1E", borderRadius: 4, padding: "8px 12px", marginBottom: 16, fontSize: 13 }}>
            <AlertTriangle size={14} /> {errorMsg}
          </div>
        )}

        {loading ? (
          <div style={{ color: "#5B6B7C", fontFamily: "'IBM Plex Sans', sans-serif" }}>Loading risks...</div>
        ) : view === "dashboard" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              <StatCard label="Open risks" value={openRisks.length} sub={`${risks.length} total logged`} />
              <StatCard label="Avg. exposure score" value={avgScore} sub="likelihood x impact" />
              <StatCard label="Critical risks" value={criticalCount} sub="score 15+" />
              <StatCard label="Categories tracked" value={CATEGORIES.length} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16, alignItems: "start" }}>
              <Heatmap risks={openRisks} onCellClick={setActiveCell} activeCell={activeCell} />
              <div style={{ background: "#FFFFFF", border: "1px solid #C9D1D6", borderRadius: 6, padding: 16 }}>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#5B6B7C", marginBottom: 12 }}>Top 5 exposures</div>
                {topRisks.map(r => (
                  <div key={r.id} onClick={() => setDrawerRisk(r)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #E5E8EA", cursor: "pointer" }}>
                    <div>
                      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: "#16233A" }}>{r.title}</div>
                      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: "#5B6B7C" }}>{r.owner} · {r.category}</div>
                    </div>
                    <ScoreBadge score={scoreOf(r)} />
                  </div>
                ))}
                {topRisks.length === 0 && <div style={{ color: "#5B6B7C", fontSize: 13 }}>No open risks yet.</div>}
              </div>
            </div>

            {activeCell && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: "#5B6B7C" }}>Filtered to heatmap cell {activeCell}</span>
                  <button onClick={() => setActiveCell(null)} style={{ background: "none", border: "none", color: "#16233A", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Clear</button>
                </div>
                <RiskTable risks={filtered} onSelect={setDrawerRisk} />
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Search size={15} style={{ position: "absolute", left: 10, top: 10, color: "#5B6B7C" }} />
                <input placeholder="Search risks..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: 32 }} />
              </div>
              <select style={{ ...inputStyle, width: 180 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                <option>All</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <select style={{ ...inputStyle, width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option>All</option>{STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <RiskTable risks={filtered} onSelect={setDrawerRisk} />
          </>
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

function SideBtn({ active, onClick, icon }) {
  return (
    <button onClick={onClick} style={{
      width: 40, height: 40, borderRadius: 6, border: "none", cursor: "pointer",
      background: active ? "#2C3E5A" : "transparent", color: active ? "#F5F6F5" : "#8B9AAC",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>{icon}</button>
  );
}

// ---------------------------------------------------------------------------
// STEP 9: Root — owns the auth session, renders Auth or Dashboard
// ---------------------------------------------------------------------------
export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setChecking(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
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
  return <Dashboard session={session} profile={profile} />;
}
