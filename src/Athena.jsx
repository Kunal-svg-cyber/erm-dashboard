import React, { useState, useRef, useEffect } from "react";
import { Send, Sparkles } from "lucide-react";
import { supabase } from "./supabaseClient.js";

const SUGGESTIONS = [
  "Which risks are exceeding their appetite threshold?",
  "Summarize our top 3 exposures right now",
  "Which risks don't have a target date set?",
  "What's overdue and who owns it?",
];

export default function Athena() {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hi, I'm Athena — ask me anything about your current risk register. I only answer from the risks actually in your database." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function ask(question) {
    if (!question.trim() || busy) return;
    setError("");
    setMessages(prev => [...prev, { role: "user", text: question }]);
    setInput("");
    setBusy(true);

    const history = messages
      .filter(m => m !== messages[0]) // exclude the static greeting
      .map(m => ({ role: m.role, text: m.text }));

    const { data, error: fnError } = await supabase.functions.invoke("athena-assistant", {
      body: { question, history },
    });

    setBusy(false);
    if (fnError || data?.error) {
      setError((fnError?.message) || data?.error || "Something went wrong reaching Athena.");
      return;
    }
    setMessages(prev => [...prev, { role: "assistant", text: data.answer }]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 140px)", maxWidth: 780 }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "4px 2px 16px" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
            {m.role === "assistant" && (
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 8, flexShrink: 0 }}>
                <Sparkles size={14} color="var(--card)" />
              </div>
            )}
            <div style={{
              maxWidth: "78%", padding: "10px 14px", borderRadius: 10,
              background: m.role === "user" ? "var(--ink)" : "var(--card)",
              color: m.role === "user" ? "var(--card)" : "var(--ink)",
              border: m.role === "assistant" ? "1px solid var(--border)" : "none",
              fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap",
            }}>
              {m.text}
            </div>
          </div>
        ))}
        {busy && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif" }}>
            <Sparkles size={14} /> Athena is thinking...
          </div>
        )}
        {error && (
          <div style={{ color: "#8E2E2E", fontSize: 12.5, fontFamily: "'IBM Plex Sans', sans-serif", marginTop: 4 }}>{error}</div>
        )}
      </div>

      {messages.length <= 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => ask(s)} style={{
              padding: "6px 12px", borderRadius: 16, border: "1px solid var(--border)", background: "var(--card)",
              color: "var(--muted)", fontSize: 12, fontFamily: "'IBM Plex Sans', sans-serif", cursor: "pointer",
            }}>{s}</button>
          ))}
        </div>
      )}

      <form onSubmit={e => { e.preventDefault(); ask(input); }} style={{ display: "flex", gap: 8 }}>
        <input
          value={input} onChange={e => setInput(e.target.value)} placeholder="Ask Athena about your risks..."
          style={{
            flex: 1, padding: "10px 14px", border: "1px solid var(--border)", borderRadius: 6,
            fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, background: "var(--card)", color: "var(--ink)",
          }}
        />
        <button type="submit" disabled={busy || !input.trim()} style={{
          padding: "0 18px", borderRadius: 6, border: "none", background: "var(--ink)", color: "var(--card)",
          cursor: busy ? "not-allowed" : "pointer", display: "flex", alignItems: "center",
        }}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
