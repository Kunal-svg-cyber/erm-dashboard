import Papa from "papaparse";
import { CATEGORIES, STATUSES } from "./riskLogic.js";

// ---------------------------------------------------------------------------
// Header aliasing: real-world spreadsheets rarely use your exact column
// names. This maps common variants (any case, spacing, punctuation) onto
// the canonical fields the app understands.
// ---------------------------------------------------------------------------
const HEADER_ALIASES = {
  id: "id", riskid: "id",
  title: "title", risktitle: "title", name: "title", riskname: "title",
  description: "description", desc: "description", details: "description",
  category: "category", risktype: "category", type: "category",
  likelihood: "likelihood", probability: "likelihood",
  impact: "impact", severity: "impact",
  score: "score", riskscore: "score", // accepted but ignored — always recalculated
  owner: "owner", riskowner: "owner", assignedto: "owner", assignee: "owner",
  status: "status",
  mitigation: "mitigation", mitigationplan: "mitigation", action: "mitigation", actionplan: "mitigation",
  targetdate: "targetDate", duedate: "targetDate", deadline: "targetDate",
  lastreviewed: "lastReviewed", reviewed: "lastReviewed", reviewdate: "lastReviewed",
};

function normalizeHeader(h) {
  const key = String(h || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return HEADER_ALIASES[key] || key;
}

// Case/whitespace-insensitive match against the app's fixed option lists
function matchOption(value, options, fallback) {
  if (!value) return fallback;
  const clean = String(value).trim().toLowerCase();
  const hit = options.find(o => o.toLowerCase() === clean);
  return hit || fallback;
}

// Accepts YYYY-MM-DD, MM/DD/YYYY, DD-MM-YYYY, or a few other common formats.
// Returns YYYY-MM-DD (what the app + database expect) or "" if unparseable.
function normalizeDate(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw; // already correct
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

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
          .map((row, i) => {
            const rowNum = i + 2; // +1 for header row, +1 for 1-indexing

            // Silently skip fully blank rows (common at the end of exported sheets)
            const hasAnyData = Object.values(row).some(v => v && String(v).trim() !== "");
            if (!hasAnyData) { skippedBlank++; return null; }

            const title = row.title || "";
            const likelihoodRaw = row.likelihood;
            const impactRaw = row.impact;
            const likelihood = Math.round(Number(likelihoodRaw));
            const impact = Math.round(Number(impactRaw));
            const category = matchOption(row.category, CATEGORIES, CATEGORIES[0]);
            const status = matchOption(row.status, STATUSES, "Open");
            const targetDate = normalizeDate(row.targetDate);
            const lastReviewed = normalizeDate(row.lastReviewed) || new Date().toISOString().slice(0, 10);

            if (!title) errors.push(`Row ${rowNum}: missing Title`);
            if (!likelihoodRaw || isNaN(likelihood) || likelihood < 1 || likelihood > 5) {
              errors.push(`Row ${rowNum}: Likelihood must be a number 1-5 (got "${likelihoodRaw ?? ""}")`);
            }
            if (!impactRaw || isNaN(impact) || impact < 1 || impact > 5) {
              errors.push(`Row ${rowNum}: Impact must be a number 1-5 (got "${impactRaw ?? ""}")`);
            }
            if (row.targetDate && !targetDate) {
              errors.push(`Row ${rowNum}: Target Date "${row.targetDate}" couldn't be read — use YYYY-MM-DD`);
            }

            let id = row.id || "";
            if (!id || seenIds.has(id)) id = `R-${Date.now()}-${i}`;
            seenIds.add(id);

            return {
              id, title,
              description: row.description || "",
              category,
              likelihood: isNaN(likelihood) ? 3 : Math.min(5, Math.max(1, likelihood)),
              impact: isNaN(impact) ? 3 : Math.min(5, Math.max(1, impact)),
              owner: row.owner || "",
              status,
              mitigation: row.mitigation || "",
              targetDate,
              lastReviewed,
              _rowNum: rowNum,
            };
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
