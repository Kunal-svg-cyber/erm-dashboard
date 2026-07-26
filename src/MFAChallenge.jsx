import React, { useState } from "react";
import { supabase } from "./supabaseClient.js";

const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #C9D1D6",
  borderRadius: 4, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, background: "#FFFFFF", color: "#16233A",
  marginBottom: 12,
};

export default function MFAChallenge({ onVerified }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);

    const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
    if (listErr) { setError(listErr.message); setBusy(false); return; }
    const factor = factors?.totp?.[0];
    if (!factor) { setError("No 2FA factor found on this account."); setBusy(false); return; }

    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (challengeErr) { setError(challengeErr.message); setBusy(false); return; }

    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: factor.id, challengeId: challenge.id, code,
    });
    setBusy(false);
    if (verifyErr) { setError(verifyErr.message); return; }

    onVerified();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#EEF1F0", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700&family=IBM+Plex+Sans:wght@400;500;600&display=swap');`}</style>
      <form onSubmit={submit} style={{ width: 340, background: "#FFFFFF", border: "1px solid #C9D1D6", borderRadius: 6, padding: 28 }}>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5B6B7C" }}>Meridian Holdings</div>
        <h1 style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontSize: 26, color: "#16233A", margin: "2px 0 20px" }}>
          Enter your 2FA code
        </h1>
        <input
          style={{ ...inputStyle, textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, letterSpacing: "0.2em" }}
          placeholder="123456" value={code} onChange={e => setCode(e.target.value)} maxLength={6} required autoFocus
        />
        {error && <div style={{ color: "#8E2E2E", fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <button type="submit" disabled={busy || code.length !== 6} style={{
          width: "100%", padding: "10px 16px", background: (busy || code.length !== 6) ? "#8B98A6" : "#16233A",
          color: "#F5F6F5", border: "none", borderRadius: 4, fontFamily: "'IBM Plex Sans', sans-serif",
          fontWeight: 600, fontSize: 13, cursor: (busy || code.length !== 6) ? "not-allowed" : "pointer",
        }}>
          {busy ? "Verifying..." : "Verify"}
        </button>
        <div style={{ marginTop: 14, textAlign: "center", fontSize: 12, color: "#5B6B7C" }}>
          <a href="#" onClick={async e => { e.preventDefault(); await supabase.auth.signOut(); }} style={{ color: "#16233A" }}>
            Cancel and sign out
          </a>
        </div>
      </form>
    </div>
  );
}
