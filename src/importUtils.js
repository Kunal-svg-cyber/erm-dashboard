import Papa from "papaparse";
import { CATEGORIES, STATUSES } from "./riskLogic.js";

// Expects the same column layout exportRisksToCSV produces:
// ID, Title, Description, Category, Likelihood, Impact, Score, Owner, Status, Mitigation, Target Date, Last Reviewed
export function parseRisksCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const errors = [];
        const rows = results.data.map((row, i) => {
          const rowNum = i + 2; // account for header row
          const likelihood = Number(row["Likelihood"]);
          const impact = Number(row["Impact"]);
          const category = CATEGORIES.includes(row["Category"]) ? row["Category"] : CATEGORIES[0];
          const status = STATUSES.includes(row["Status"]) ? row["Status"] : "Open";

          if (!row["Title"]) errors.push(`Row ${rowNum}: missing Title`);
          if (!likelihood || likelihood < 1 || likelihood > 5) errors.push(`Row ${rowNum}: Likelihood must be 1-5`);
          if (!impact || impact < 1 || impact > 5) errors.push(`Row ${rowNum}: Impact must be 1-5`);

          return {
            id: row["ID"] || `R-${Date.now()}-${i}`,
            title: row["Title"] || "",
            description: row["Description"] || "",
            category,
            likelihood: likelihood || 3,
            impact: impact || 3,
            owner: row["Owner"] || "",
            status,
            mitigation: row["Mitigation"] || "",
            targetDate: row["Target Date"] || "",
            lastReviewed: row["Last Reviewed"] || new Date().toISOString().slice(0, 10),
          };
        });
        resolve({ rows, errors });
      },
      error: (err) => reject(err),
    });
  });
}
