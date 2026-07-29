import Papa from "papaparse";
import { normalizeHeader, fieldsToRisk } from "./importShared.js";

export function parseRisksCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader,
      transform: (value) => (typeof value === "string" ? value.trim() : value),
      complete: (results) => {
        const errors = [];
        const seenIds = new Set();
        let skippedBlank = 0;

        const rows = results.data
          .map((fields, i) => {
            const rowNum = i + 2; // +1 for header row, +1 for 1-indexing
            const hasAnyData = Object.values(fields).some(v => v && String(v).trim() !== "");
            if (!hasAnyData) { skippedBlank++; return null; }

            const { risk, errors: rowErrors } = fieldsToRisk(fields, rowNum, seenIds);
            errors.push(...rowErrors);
            return risk;
          })
          .filter(Boolean);

        resolve({ rows, errors, skippedBlank, totalRows: results.data.length });
      },
      error: (err) => reject(err),
    });
  });
}

// A ready-to-fill starter CSV so the format is never guesswork.
export function downloadCSVTemplate() {
  const headers = ["Title", "Description", "Category", "Likelihood", "Impact", "Owner", "Status", "Mitigation", "Target Date", "Last Reviewed"];
  const example = [
    "Vendor concentration in core payments processor",
    "Single point of failure if primary processor has an outage",
    "Operational",
    "4", "5",
    "M. Alvarez",
    "Open",
    "Qualify a second processor for failover",
    "2026-09-15",
    "2026-07-29",
  ];
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(","), example.map(escape).join(",")].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "risk-import-template.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
