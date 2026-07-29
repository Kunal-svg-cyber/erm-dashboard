import { CATEGORIES, STATUSES } from "./riskLogic.js";

export const HEADER_ALIASES = {
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

export function normalizeHeader(h) {
  const key = String(h || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return HEADER_ALIASES[key] || key;
}

// Case/whitespace-insensitive match against the app's fixed option lists
export function matchOption(value, options, fallback) {
  if (!value) return fallback;
  const clean = String(value).trim().toLowerCase();
  const hit = options.find(o => o.toLowerCase() === clean);
  return hit || fallback;
}

// Accepts YYYY-MM-DD, MM/DD/YYYY, DD-MM-YYYY, or a few other common formats.
export function normalizeDate(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

// Converts one normalized field object (from CSV or PDF) into a validated
// risk row + list of errors for that row. Shared by both import paths so
// validation rules never drift between them.
export function fieldsToRisk(fields, rowNum, seenIds) {
  const errors = [];
  const title = fields.title || "";
  const likelihoodRaw = fields.likelihood;
  const impactRaw = fields.impact;
  const likelihood = Math.round(Number(likelihoodRaw));
  const impact = Math.round(Number(impactRaw));
  const category = matchOption(fields.category, CATEGORIES, CATEGORIES[0]);
  const status = matchOption(fields.status, STATUSES, "Open");
  const targetDate = normalizeDate(fields.targetDate);
  const lastReviewed = normalizeDate(fields.lastReviewed) || new Date().toISOString().slice(0, 10);

  if (!title) errors.push(`Row ${rowNum}: missing Title`);
  if (!likelihoodRaw || isNaN(likelihood) || likelihood < 1 || likelihood > 5) {
    errors.push(`Row ${rowNum}: Likelihood must be a number 1-5 (got "${likelihoodRaw ?? ""}")`);
  }
  if (!impactRaw || isNaN(impact) || impact < 1 || impact > 5) {
    errors.push(`Row ${rowNum}: Impact must be a number 1-5 (got "${impactRaw ?? ""}")`);
  }
  if (fields.targetDate && !targetDate) {
    errors.push(`Row ${rowNum}: Target Date "${fields.targetDate}" couldn't be read — use YYYY-MM-DD`);
  }

  let id = fields.id || "";
  if (!id || seenIds.has(id)) id = `R-${Date.now()}-${rowNum}`;
  seenIds.add(id);

  const risk = {
    id, title,
    description: fields.description || "",
    category,
    likelihood: isNaN(likelihood) ? 3 : Math.min(5, Math.max(1, likelihood)),
    impact: isNaN(impact) ? 3 : Math.min(5, Math.max(1, impact)),
    owner: fields.owner || "",
    status,
    mitigation: fields.mitigation || "",
    targetDate,
    lastReviewed,
    _rowNum: rowNum,
  };
  return { risk, errors };
}
