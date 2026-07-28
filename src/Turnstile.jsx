import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";

// Loads and renders a Cloudflare Turnstile widget.
// Exposes a `.reset()` method via ref, since each token is single-use —
// after a failed or successful auth attempt, the widget must be reset
// before it can produce a new token.
const Turnstile = forwardRef(function Turnstile({ siteKey, onVerify, onExpire }, ref) {
  const containerRef = useRef(null);
  const widgetId = useRef(null);

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (window.turnstile && widgetId.current !== null) {
        window.turnstile.reset(widgetId.current);
      }
    },
  }));

  useEffect(() => {
    let cancelled = false;

    function render() {
      if (cancelled || !window.turnstile || !containerRef.current) return;
      widgetId.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onVerify(token),
        "expired-callback": () => { onVerify(""); onExpire?.(); },
        "error-callback": () => onVerify(""),
      });
    }

    if (window.turnstile) {
      render();
    } else {
      // Script tag (added in index.html) may still be loading
      const interval = setInterval(() => {
        if (window.turnstile) { clearInterval(interval); render(); }
      }, 100);
      return () => clearInterval(interval);
    }

    return () => {
      cancelled = true;
      if (window.turnstile && widgetId.current !== null) {
        window.turnstile.remove(widgetId.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} style={{ marginBottom: 12 }} />;
});

export default Turnstile;
