import { normalizeHeader, fieldsToRisk } from "./importShared.js";

// pdfjs-dist is loaded lazily so it doesn't bloat the initial bundle —
// most users will never touch PDF import.
async function loadPdfjs() {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  return pdfjsLib;
}

// Extracts a 2D array of cell strings (first row = header) from a PDF that
// contains a single table. Column boundaries are derived from the header
// row's own text positions, then every other row's text is bucketed into
// the nearest boundary — this is far more reliable across different PDF
// generators than trying to detect gaps between text runs.
async function extractTableFromPdf(file) {
  const pdfjsLib = await loadPdfjs();
  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;

  const allItems = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    for (const item of content.items) {
      allItems.push({ x: item.transform[4], y: item.transform[5], str: item.str, page: p });
    }
  }
  if (allItems.length === 0) return [];

  const Y_TOL = 3;
  const rows = [];
  allItems
    .sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x)
    .forEach((item) => {
      let row = rows.find(r => r.page === item.page && Math.abs(r.y - item.y) <= Y_TOL);
      if (!row) { row = { page: item.page, y: item.y, items: [] }; rows.push(row); }
      row.items.push(item);
    });

  const headerItems = rows[0].items.filter(it => it.str.trim() !== "").sort((a, b) => a.x - b.x);
  const boundaries = headerItems.map(it => it.x);
  if (boundaries.length === 0) return [];

  function bucketRow(row) {
    const cells = new Array(boundaries.length).fill("");
    row.items.slice().sort((a, b) => a.x - b.x).forEach((it) => {
      let colIdx = 0;
      for (let i = 0; i < boundaries.length; i++) {
        if (it.x >= boundaries[i] - 2) colIdx = i; else break;
      }
      cells[colIdx] += it.str;
    });
    return cells.map(c => c.trim());
  }

  return rows.map(bucketRow);
}

// Reassembles rows that wrapped onto multiple lines (e.g. a long Title
// spilling to a second line). Detected as: no value in the Likelihood or
// Impact columns, but at least one other cell has text — such rows are
// merged into the previous real row instead of becoming their own.
function mergeWrappedRows(table, likelihoodIdx, impactIdx) {
  if (likelihoodIdx === -1 || impactIdx === -1) return table;
  const out = [table[0]];
  for (let i = 1; i < table.length; i++) {
    const row = table[i];
    const isContinuation = !row[likelihoodIdx] && !row[impactIdx] && row.some(c => c !== "");
    if (isContinuation && out.length > 1) {
      const prev = out[out.length - 1];
      row.forEach((cell, idx) => {
        if (cell) prev[idx] = (prev[idx] ? prev[idx] + " " : "") + cell;
      });
    } else {
      out.push(row);
    }
  }
  return out;
}

export async function parseRisksPDF(file) {
  const rawTable = await extractTableFromPdf(file);
  if (rawTable.length < 2) {
    return { rows: [], errors: ["Couldn't find a table in this PDF — make sure it contains a single risk table with a header row."], skippedBlank: 0, totalRows: 0 };
  }

  const headerRow = rawTable[0].map(normalizeHeader);
  const likelihoodIdx = headerRow.indexOf("likelihood");
  const impactIdx = headerRow.indexOf("impact");
  const merged = mergeWrappedRows(rawTable, likelihoodIdx, impactIdx);

  const errors = [];
  const seenIds = new Set();
  let skippedBlank = 0;

  const rows = merged.slice(1)
    .map((cellRow, i) => {
      const rowNum = i + 2;
      const hasAnyData = cellRow.some(c => c !== "");
      if (!hasAnyData) { skippedBlank++; return null; }

      const fields = {};
      headerRow.forEach((key, idx) => { if (key) fields[key] = cellRow[idx]; });

      const { risk, errors: rowErrors } = fieldsToRisk(fields, rowNum, seenIds);
      errors.push(...rowErrors);
      return risk;
    })
    .filter(Boolean);

  return { rows, errors, skippedBlank, totalRows: merged.length - 1 };
}
