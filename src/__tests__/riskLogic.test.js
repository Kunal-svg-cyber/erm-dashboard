import { describe, it, expect } from "vitest";
import { scoreOf, bandOf } from "../riskLogic.js";

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
