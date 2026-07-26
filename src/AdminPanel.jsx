import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";

const ROLES = ["admin", "owner", "viewer"];

const ROLE_COLOR = {
  admin: { bg: "#EFD3D0", border: "#8E2E2E", text: "#5F1E1E" },
  owner: { bg: "#F5EAD4", border: "#C68A2E", text: "#7A5620" },
  viewer: { bg: "#E4EEE8", border: "#4C7A5E", text: "#2C4E3B" },
};

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
    <div style={{ background: "#FFFFFF", border: "1px solid #C9D1D6", borderRadius: 6, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #C9D1D6" }}>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#5B6B7C" }}>
          User roles
        </div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: "#5B6B7C", marginTop: 2 }}>
          admin = edits everything &middot; owner = edits only their own risks &middot; viewer = read-only
        </div>
      </div>

      {errorMsg && (
        <div style={{ background: "#EFD3D0", color: "#5F1E1E", fontSize: 13, padding: "8px 16px" }}>{errorMsg}</div>
      )}

      {loading ? (
        <div style={{ padding: 24, color: "#5B6B7C", fontFamily: "'IBM Plex Sans', sans-serif" }}>Loading users...</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#EEF1F0", borderBottom: "1px solid #C9D1D6" }}>
              {["Name", "Email", "Role"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5B6B7C", fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profiles.map(p => {
              const c = ROLE_COLOR[p.role] || ROLE_COLOR.viewer;
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid #E5E8EA" }}>
                  <td style={{ padding: "10px 12px", color: "#16233A" }}>
                    {p.full_name || "—"} {p.id === currentUserId && <span style={{ color: "#5B6B7C", fontSize: 11 }}>(you)</span>}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#5B6B7C" }}>{p.email}</td>
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
  );
}
