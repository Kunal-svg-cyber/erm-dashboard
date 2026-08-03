import React, { useState } from "react";
import { Sparkles, Search } from "lucide-react";
import { supabase } from "./supabaseClient.js";

export default function SemanticSearch({ onSelectRisk }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function search(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError("");
    const { data, error: fnError } = await supabase.functions.invoke("semantic-search", { body: { query } });
    setBusy(false);
    if (fnError || data?.error) {
      let message = data?.error || fnError?.message || "Search failed.";
      if (fnError?.context) {
        try { message = (await fnError.context.json())?.error || message; } catch { /* keep fallback */ }
      }
      setError(message);
      return;
    }
    setResults(data.results || []);
  }

  return (
    <div>
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: "var(--muted)", marginBottom: 16, maxWidth: 680, lineHeight: 1.5 }}>
        Searches by meaning, not just keywords — try something like "problems with a single vendor" or "things that could delay month-end close" even if those exact words never appear in a risk.
      </div>

      <form onSubmit={search} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 500 }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "var(--muted)" }} />
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Describe what you're looking for..."
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 32px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--card)", color: "var(--ink)", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13 }}
          />
        </div>
        <button type="submit" disabled={busy} style={{
          padding: "0 18px", background: "var(--ink)", color: "var(--card)", border: "none", borderRadius: 6,
          fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: busy ? "not-allowed" : "pointer",
        }}>
          {busy ? "Searching..." : "Search"}
        </button>
      </form>

      {error && <div style={{ color: "#8E2E2E", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {results && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
          {results.length === 0 ? (
            <div style={{ padding: 24, color: "var(--muted)", fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif" }}>
              No matches — risks need to have been saved at least once after semantic search was enabled to be searchable.
            </div>
          ) : results.map(r => (
            <div key={r.id} onClick={() => onSelectRisk?.(r.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--row-border)", cursor: onSelectRisk ? "pointer" : "default" }}>
              <div>
                <div style={{ fontSize: 13.5, color: "var(--ink)", fontFamily: "'IBM Plex Sans', sans-serif" }}>{r.title}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{r.category} · {r.owner_name} · {r.status}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "var(--muted)" }}>
                <Sparkles size={12} /> {(r.similarity * 100).toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
