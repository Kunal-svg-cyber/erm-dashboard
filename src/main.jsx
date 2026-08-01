import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.jsx";

const dsn = import.meta.env.VITE_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.2, // 20% of transactions — plenty for a free-tier quota
    environment: import.meta.env.MODE,
  });
}
// If VITE_SENTRY_DSN isn't set (e.g. local dev), the app just runs without
// error monitoring instead of crashing on a missing config value.

function Fallback({ error }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", padding: 24, textAlign: "center" }}>
      <div>
        <h2 style={{ color: "#16233A" }}>Something went wrong</h2>
        <p style={{ color: "#5B6B7C", maxWidth: 420 }}>
          This error has been reported automatically. Try refreshing the page — if it keeps happening, let an admin know.
        </p>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={Fallback}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
