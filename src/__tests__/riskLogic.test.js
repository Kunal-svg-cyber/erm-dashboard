import { describe, it, expect } from "vitest";
import { scoreOf, bandOf, exceedsAppetite } from "../riskLogic.js";

describe("scoreOf", () => {
  it("multiplies likelihood and impact", () => {
    expect(scoreOf({ likelihood: 3, impact: 4 })).toBe(12);
  });
  it("handles minimum values", () => {
    expect(scoreOf({ likelihood: 1, impact: 1 })).toBe(1);
  });
  it("handles maximum values", () => {
    expect(scoreOf({ likelihood: 5, impact: 5 })).toBe(25);
  });
});

describe("bandOf", () => {
  it("classifies low risk (score < 5)", () => {
    expect(bandOf(4).label).toBe("Low");
    expect(bandOf(1).label).toBe("Low");
  });
  it("classifies medium risk (5-9)", () => {
    expect(bandOf(5).label).toBe("Medium");
    expect(bandOf(9).label).toBe("Medium");
  });
  it("classifies high risk (10-14)", () => {
    expect(bandOf(10).label).toBe("High");
    expect(bandOf(14).label).toBe("High");
  });
  it("classifies critical risk (15+)", () => {
    expect(bandOf(15).label).toBe("Critical");
    expect(bandOf(25).label).toBe("Critical");
  });
});

describe("scoreOf with view", () => {
  const risk = { likelihood: 5, impact: 5, residualLikelihood: 2, residualImpact: 2 };
  it("defaults to inherent score", () => {
    expect(scoreOf(risk)).toBe(25);
  });
  it("uses residual values when view is residual", () => {
    expect(scoreOf(risk, "residual")).toBe(4);
  });
  it("falls back to inherent values if residual fields are missing", () => {
    expect(scoreOf({ likelihood: 3, impact: 3 }, "residual")).toBe(9);
  });
});

describe("exceedsAppetite", () => {
  const thresholds = { Cyber: 10, Strategic: 15 };
  it("flags a risk that meets or exceeds its category threshold", () => {
    expect(exceedsAppetite({ category: "Cyber", likelihood: 2, impact: 5 }, thresholds)).toBe(true);
  });
  it("does not flag a risk below its category threshold", () => {
    expect(exceedsAppetite({ category: "Strategic", likelihood: 2, impact: 5 }, thresholds)).toBe(false);
  });
  it("defaults to a threshold of 15 for unlisted categories", () => {
    expect(exceedsAppetite({ category: "Financial", likelihood: 4, impact: 4 }, {})).toBe(true);
  });
});
