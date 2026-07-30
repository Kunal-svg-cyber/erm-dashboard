import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { CATEGORIES } from "./riskLogic.js";

const ROLES = ["admin", "owner", "viewer"];

const ROLE_COLOR = {
  admin: { bg: "#EFD3D0", border: "#8E2E2E", text: "#5F1E1E" },
  owner: { bg: "#F5EAD4", border: "#C68A2E", text: "#7A5620" },
  viewer: { bg: "#E4EEE8", border: "#4C7A5E", text: "#2C4E3B" },
};

function ThresholdEditor() {
  const [thresholds, setThresholds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingCat, setSavingCat] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("category_thresholds").select("*").order("category");
    if (error) setErrorMsg(error.message);
    else setThresholds(data);
    setLoading(false);
  }

  async function changeThreshold(category, value) {
    setSavingCat(category);
    setErrorMsg("");
    const { error } = await supabase.from("category_thresholds").update({ appetite_score: value }).eq("category", category);
    if (error) setErrorMsg(error.message);
    else setThresholds(prev => prev.map(t => t.category === category ? { ...t, appetite_score: value } : t));
    setSavingCat(null);
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden", marginTop: 16 }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>
          Category risk appetite
        </div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
          A risk "exceeds appetite" once its score reaches this threshold for its category. Stricter categories should use a lower number.
        </div>
      </div>
      {errorMsg && <div style={{ background: "#EFD3D0", color: "#5F1E1E", fontSize: 13, padding: "8px 16px" }}>{errorMsg}</div>}
      {loading ? (
        <div style={{ padding: 24, color: "var(--muted)", fontFamily: "'IBM Plex Sans', sans-serif" }}>Loading thresholds...</div>
      ) : (
        <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {CATEGORIES.map(cat => {
            const row = thresholds.find(t => t.category === cat);
            const value = row?.appetite_score ?? 15;
            return (
              <div key={cat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, padding: "8px 12px" }}>
                <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: "var(--ink)" }}>{cat}</span>
                <input
                  type="number" min={1} max={25} value={value}
                  disabled={savingCat === cat}
                  onChange={e => changeThreshold(cat, Number(e.target.value))}
                  style={{
                    width: 50, textAlign: "center", padding: "4px 6px", border: "1px solid var(--border)",
                    borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, background: "var(--card)", color: "var(--ink)",
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminPanel({ currentUserId }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("profiles").select("*").order("email");
    if (error) setErrorMsg(error.message);
    else setProfiles(data);
    setLoading(false);
  }

  async function changeRole(id, role) {
    setSavingId(id);
    setErrorMsg("");
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    if (error) setErrorMsg(error.message);
    else setProfiles(prev => prev.map(p => p.id === id ? { ...p, role } : p));
    setSavingId(null);
  }

  return (
    <div>
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>
          User roles
        </div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
          admin = edits everything &middot; owner = edits only their own risks &middot; viewer = read-only
        </div>
      </div>

      {errorMsg && (
        <div style={{ background: "#EFD3D0", color: "#5F1E1E", fontSize: 13, padding: "8px 16px" }}>{errorMsg}</div>
      )}

      {loading ? (
        <div style={{ padding: 24, color: "var(--muted)", fontFamily: "'IBM Plex Sans', sans-serif" }}>Loading users...</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
              {["Name", "Email", "Role"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profiles.map(p => {
              const c = ROLE_COLOR[p.role] || ROLE_COLOR.viewer;
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid var(--row-border)" }}>
                  <td style={{ padding: "10px 12px", color: "var(--ink)" }}>
                    {p.full_name || "—"} {p.id === currentUserId && <span style={{ color: "var(--muted)", fontSize: 11 }}>(you)</span>}
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{p.email}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <select
                      value={p.role}
                      disabled={savingId === p.id}
                      onChange={e => changeRole(p.id, e.target.value)}
                      style={{
                        background: c.bg, border: `1px solid ${c.border}`, color: c.text,
                        borderRadius: 4, padding: "4px 8px", fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: 12, fontWeight: 600,
                      }}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
    <ThresholdEditor />
    </div>
  );
}
