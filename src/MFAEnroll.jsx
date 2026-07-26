import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";

export default function MFAEnroll() {
  const [factors, setFactors] = useState([]);
  const [enrolling, setEnrolling] = useState(false);
  const [qr, setQr] = useState(null);
  const [factorId, setFactorId] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadFactors(); }, []);

  async function loadFactors() {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(data?.totp || []);
  }

  async function startEnroll() {
    setError(""); setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setEnrolling(true);
  }

  async function confirmEnroll() {
    setError(""); setBusy(true);
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeErr) { setError(challengeErr.message); setBusy(false); return; }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId, challengeId: challenge.id, code,
    });
    setBusy(false);
    if (verifyErr) { setError(verifyErr.message); return; }
    setEnrolling(false); setQr(null); setCode("");
    loadFactors();
  }

  async function removeFactor(id) {
    await supabase.auth.mfa.unenroll({ factorId: id });
    loadFactors();
  }

  const active = factors.find(f => f.status === "verified");

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, padding: 20, maxWidth: 420 }}>
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 4 }}>
        Two-factor authentication
      </div>
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
        Adds a 6-digit code from an authenticator app (Google Authenticator, Authy, 1Password) on top of your password.
      </div>

      {error && <div style={{ color: "#8E2E2E", fontSize: 12, marginBottom: 12 }}>{error}</div>}

      {active ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#2C4E3B", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, marginBottom: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4C7A5E", display: "inline-block" }} />
            2FA is enabled
          </div>
          <button onClick={() => removeFactor(active.id)} style={{
            padding: "8px 14px", background: "var(--card)", color: "#8E2E2E", border: "1px solid #8E2E2E",
            borderRadius: 4, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, cursor: "pointer",
          }}>Disable 2FA</button>
        </div>
      ) : enrolling ? (
        <div>
          <div style={{ background: "#F5F6F5", padding: 12, borderRadius: 4, marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: qr }} />
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Scan this with your authenticator app, then enter the 6-digit code:</div>
          <input
            value={code} onChange={e => setCode(e.target.value)} maxLength={6} placeholder="123456"
            style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, letterSpacing: "0.2em", textAlign: "center", marginBottom: 12 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={confirmEnroll} disabled={busy || code.length !== 6} style={{
              flex: 1, padding: "10px 16px", background: "#16233A", color: "#F5F6F5", border: "none",
              borderRadius: 4, fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}>{busy ? "Verifying..." : "Confirm & enable"}</button>
            <button onClick={() => { setEnrolling(false); setQr(null); }} style={{
              padding: "10px 16px", background: "var(--card)", color: "var(--muted)", border: "1px solid var(--border)",
              borderRadius: 4, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, cursor: "pointer",
            }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={startEnroll} disabled={busy} style={{
          padding: "10px 16px", background: "#16233A", color: "#F5F6F5", border: "none",
          borderRadius: 4, fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer",
        }}>{busy ? "Starting..." : "Enable 2FA"}</button>
      )}
    </div>
  );
}
