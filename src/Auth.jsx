import React, { useState, useMemo } from "react";
import { supabase } from "./supabaseClient.js";

const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #C9D1D6",
  borderRadius: 4, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, background: "#FFFFFF", color: "#16233A",
  marginBottom: 12,
};

// Client-side password strength check.
// Supabase's leaked-password (HaveIBeenPwned) check is a paid-plan feature,
// so this is the free-tier substitute: enforce length + character variety
// so at least trivially weak passwords are rejected before they ever reach Supabase.
function passwordStrength(pw) {
  const checks = {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
  };
  const score = Object.values(checks).filter(Boolean).length;
  return { checks, score, valid: checks.length && score >= 3 };
}

function StrengthMeter({ password }) {
  const { score } = passwordStrength(password);
  const labels = ["Too weak", "Weak", "Fair", "Good", "Strong"];
  const colors = ["#8E2E2E", "#B0492E", "#C68A2E", "#7A9A5E", "#4C7A5E"];
  const idx = password.length === 0 ? 0 : Math.max(1, score);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: 4, flex: 1, borderRadius: 2, background: i < idx ? colors[idx - 1] : "#E5E8EA" }} />
        ))}
      </div>
      {password.length > 0 && (
        <div style={{ fontSize: 11, color: colors[idx - 1] || "#5B6B7C" }}>
          {labels[idx - 1] || "Too weak"} &middot; use 8+ characters with a mix of upper/lowercase, numbers, and symbols
        </div>
      )}
    </div>
  );
}

export default function Auth() {
  const [mode, setMode] = useState("signin"); // signin | signup | mfa
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const strength = useMemo(() => passwordStrength(password), [password]);
  const signupBlocked = mode === "signup" && !strength.valid;

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setInfo("");

    if (mode === "signup" && !strength.valid) {
      setError("Please choose a stronger password (8+ characters, mix of upper/lowercase, numbers, and symbols).");
      return;
    }

    setBusy(true);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); setBusy(false); return; }

      // Check if this account requires a second factor before granting a full session
      const { data: levelData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (levelData && levelData.nextLevel === "aal2" && levelData.currentLevel !== "aal2") {
        setMode("mfa");
        setBusy(false);
        return;
      }
    } else if (mode === "mfa") {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp?.[0];
      if (!factor) { setError("No 2FA factor found."); setBusy(false); return; }
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (challengeErr) { setError(challengeErr.message); setBusy(false); return; }
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: factor.id, challengeId: challenge.id, code: mfaCode,
      });
      if (verifyErr) { setError(verifyErr.message); setBusy(false); return; }
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName } },
      });
      if (error) setError(error.message);
      else setInfo("Account created. Check your email to confirm, then sign in.");
    }
    setBusy(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#EEF1F0", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700&family=IBM+Plex+Sans:wght@400;500;600&display=swap');`}</style>
      <form onSubmit={submit} style={{ width: 340, background: "#FFFFFF", border: "1px solid #C9D1D6", borderRadius: 6, padding: 28 }}>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5B6B7C" }}>Meridian Holdings</div>
        <h1 style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontSize: 26, color: "#16233A", margin: "2px 0 20px" }}>
          {mode === "signin" ? "Sign in" : mode === "mfa" ? "Enter your 2FA code" : "Create account"}
        </h1>

        {mode === "mfa" ? (
          <input
            style={{ ...inputStyle, textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, letterSpacing: "0.2em" }}
            placeholder="123456" value={mfaCode} onChange={e => setMfaCode(e.target.value)} maxLength={6} required autoFocus
          />
        ) : (
          <>
            {mode === "signup" && (
              <input style={inputStyle} placeholder="Full name" value={fullName} onChange={e => setFullName(e.target.value)} required />
            )}
            <input style={inputStyle} type="email" placeholder="Work email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            <input
              style={inputStyle} type="password" placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)} required minLength={mode === "signup" ? 8 : 6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
            {mode === "signup" && <StrengthMeter password={password} />}
          </>
        )}

        {error && <div style={{ color: "#8E2E2E", fontSize: 12, marginBottom: 10 }}>{error}</div>}
        {info && <div style={{ color: "#2C4E3B", fontSize: 12, marginBottom: 10 }}>{info}</div>}

        <button type="submit" disabled={busy || signupBlocked} style={{
          width: "100%", padding: "10px 16px",
          background: (busy || signupBlocked) ? "#8B98A6" : "#16233A",
          color: "#F5F6F5", border: "none",
          borderRadius: 4, fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 13,
          cursor: (busy || signupBlocked) ? "not-allowed" : "pointer",
        }}>
          {busy ? "Please wait..." : mode === "signin" ? "Sign in" : mode === "mfa" ? "Verify" : "Sign up"}
        </button>

        <div style={{ marginTop: 14, textAlign: "center", fontSize: 12, color: "#5B6B7C" }}>
          {mode === "signin" ? (
            <>New here? <a href="#" onClick={e => { e.preventDefault(); setMode("signup"); setError(""); }} style={{ color: "#16233A" }}>Create an account</a></>
          ) : mode === "signup" ? (
            <>Already have an account? <a href="#" onClick={e => { e.preventDefault(); setMode("signin"); setError(""); }} style={{ color: "#16233A" }}>Sign in</a></>
          ) : null}
        </div>

        {mode === "signup" && (
          <div style={{ marginTop: 10, fontSize: 11, color: "#5B6B7C" }}>
            New accounts default to the "viewer" role. An admin can upgrade your role from the Admin panel.
          </div>
        )}
      </form>
    </div>
  );
}
