export function exportRisksToCSV(risks) {
  const headers = ["ID", "Title", "Description", "Category", "Likelihood", "Impact", "Score", "Owner", "Status", "Mitigation", "Target Date", "Last Reviewed"];
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const rows = risks.map(r => [
    r.id, r.title, r.description, r.category, r.likelihood, r.impact,
    r.likelihood * r.impact, r.owner, r.status, r.mitigation, r.targetDate, r.lastReviewed,
  ].map(escape).join(","));

  const csv = [headers.map(escape).join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `risk-register-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportRisksToPDF(risks) {
  const win = window.open("", "_blank");
  const rows = risks.map(r => `
    <tr>
      <td>${r.id}</td><td>${r.title}</td><td>${r.category}</td>
      <td>${r.likelihood * r.impact}</td><td>${r.owner}</td><td>${r.status}</td><td>${r.lastReviewed}</td>
    </tr>`).join("");

  win.document.write(`
    <html>
      <head>
        <title>Risk Register Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #16233A; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          p { color: #5B6B7C; font-size: 12px; margin-top: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #C9D1D6; padding: 6px 10px; font-size: 12px; text-align: left; }
          th { background: #EEF1F0; }
        </style>
      </head>
      <body>
        <h1>Enterprise Risk Register</h1>
        <p>Generated ${new Date().toLocaleString()} &middot; ${risks.length} risks</p>
        <table>
          <thead><tr><th>ID</th><th>Title</th><th>Category</th><th>Score</th><th>Owner</th><th>Status</th><th>Reviewed</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}
