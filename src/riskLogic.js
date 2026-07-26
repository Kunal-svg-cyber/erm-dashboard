export const CATEGORIES = ["Strategic", "Operational", "Financial", "Compliance", "Cyber", "Reputational"];
export const STATUSES = ["Open", "Mitigating", "Escalated", "Closed"];

export function scoreOf(r) {
  return r.likelihood * r.impact;
}

export function bandOf(score) {
  if (score >= 15) return { label: "Critical", ramp: "crit" };
  if (score >= 10) return { label: "High", ramp: "high" };
  if (score >= 5) return { label: "Medium", ramp: "med" };
  return { label: "Low", ramp: "low" };
}

export const RAMP = {
  low: { bg: "#E4EEE8", border: "#4C7A5E", text: "#2C4E3B" },
  med: { bg: "#F5EAD4", border: "#C68A2E", text: "#7A5620" },
  high: { bg: "#F3DFD6", border: "#B0492E", text: "#7A311E" },
  crit: { bg: "#EFD3D0", border: "#8E2E2E", text: "#5F1E1E" },
};
