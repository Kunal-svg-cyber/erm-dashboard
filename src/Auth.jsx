import React, { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient.js";
import Turnstile from "./Turnstile.jsx";

const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #C9D1D6",
  borderRadius: 4, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, background: "#FFFFFF", color: "#16233A",
  marginBottom: 12,
};

// Client-side password strength check.
// Supabase's leaked-password (HaveIBeenPwned) check is a paid-plan feature,
// so this is the free-tier substitute: enforce length + character variety.
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

// Client-side brute-force defense-in-depth. Supabase enforces its own
// server-side rate limits regardless (Authentication -> Rate Limits) —
// this just adds a fast, visible lockout in the UI and slows down
// scripted guessing before it ever reaches the network. Keyed per-email
// in localStorage so a page refresh doesn't reset the counter.
const MAX_ATTEMPTS = 5;
const LOCKOUT_BASE_SECONDS = 30;

function getAttemptState(email) {
  try {
    const raw = localStorage.getItem(`login_attempts:${email.toLowerCase()}`);
    return raw ? JSON.parse(raw) : { count: 0, lockedUntil: 0, lockouts: 0 };
  } catch {
    return { count: 0, lockedUntil: 0, lockouts: 0 };
  }
}
function setAttemptState(email, state) {
  try {
    localStorage.setItem(`login_attempts:${email.toLowerCase()}`, JSON.stringify(state));
  } catch { /* ignore storage errors */ }
}
function registerFailedAttempt(email) {
  const state = getAttemptState(email);
  const count = state.count + 1;
  if (count >= MAX_ATTEMPTS) {
    const lockouts = state.lockouts + 1;
    const seconds = LOCKOUT_BASE_SECONDS * Math.pow(2, lockouts - 1); // 30s, 60s, 120s...
    const lockedUntil = Date.now() + seconds * 1000;
    setAttemptState(email, { count: 0, lockedUntil, lockouts });
    return { locked: true, seconds };
  }
  setAttemptState(email, { ...state, count });
  return { locked: false, remaining: MAX_ATTEMPTS - count };
}
function clearAttempts(email) {
  setAttemptState(email, { count: 0, lockedUntil: 0, lockouts: 0 });
}

export default function Auth() {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [lockedSeconds, setLockedSeconds] = useState(0);
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileRef = useRef(null);

  useEffect(() => {
    if (lockedSeconds <= 0) return;
    const t = setInterval(() => setLockedSeconds(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [lockedSeconds]);

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
      const existing = getAttemptState(email);
      if (existing.lockedUntil > Date.now()) {
        setLockedSeconds(Math.ceil((existing.lockedUntil - Date.now()) / 1000));
        setError("Too many failed attempts. Please wait before trying again.");
        setBusy(false);
        return;
      }
      if (!captchaToken) {
        setError("Please complete the verification challenge.");
        setBusy(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email, password, options: { captchaToken },
      });
      turnstileRef.current?.reset();
      setCaptchaToken("");
      if (error) {
        const result = registerFailedAttempt(email);
        if (result.locked) {
          setLockedSeconds(result.seconds);
          setError(`Too many failed attempts. Locked for ${result.seconds} seconds.`);
        } else {
          setError(`${error.message} (${result.remaining} attempt${result.remaining === 1 ? "" : "s"} remaining before lockout)`);
        }
        setBusy(false);
        return;
      }
      clearAttempts(email);
    } else {
      if (!captchaToken) {
        setError("Please complete the verification challenge.");
        setBusy(false);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName }, captchaToken },
      });
      turnstileRef.current?.reset();
      setCaptchaToken("");
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
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>

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

        <Turnstile
          ref={turnstileRef}
          siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
          onVerify={setCaptchaToken}
        />

        {error && <div style={{ color: "#8E2E2E", fontSize: 12, marginBottom: 10 }}>{error}</div>}
        {info && <div style={{ color: "#2C4E3B", fontSize: 12, marginBottom: 10 }}>{info}</div>}
        {lockedSeconds > 0 && (
          <div style={{ color: "#8E2E2E", fontSize: 12, marginBottom: 10 }}>Try again in {lockedSeconds}s</div>
        )}

        <button type="submit" disabled={busy || signupBlocked || lockedSeconds > 0 || !captchaToken} style={{
          width: "100%", padding: "10px 16px",
          background: (busy || signupBlocked || lockedSeconds > 0 || !captchaToken) ? "#8B98A6" : "#16233A",
          color: "#F5F6F5", border: "none",
          borderRadius: 4, fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 13,
          cursor: (busy || signupBlocked || lockedSeconds > 0 || !captchaToken) ? "not-allowed" : "pointer",
        }}>
          {busy ? "Please wait..." : lockedSeconds > 0 ? `Locked (${lockedSeconds}s)` : mode === "signin" ? "Sign in" : "Sign up"}
        </button>

        <div style={{ marginTop: 14, textAlign: "center", fontSize: 12, color: "#5B6B7C" }}>
          {mode === "signin" ? (
            <>New here? <a href="#" onClick={e => { e.preventDefault(); setMode("signup"); setError(""); }} style={{ color: "#16233A" }}>Create an account</a></>
          ) : (
            <>Already have an account? <a href="#" onClick={e => { e.preventDefault(); setMode("signin"); setError(""); }} style={{ color: "#16233A" }}>Sign in</a></>
          )}
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
