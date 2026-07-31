// Preset scenarios shift likelihood/impact for specific categories, modeling
// how BAU/ad hoc stress tests work at real risk functions: apply a shock,
// see what breaches threshold, decide whether to act. Nothing here is
// persisted — it's a pure client-side simulation.
export const SCENARIOS = [
  {
    id: "market-volatility",
    name: "Market Volatility Spike",
    description: "Sharp market drawdown and correlation breakdown across asset classes",
    deltas: { Financial: { likelihood: 2, impact: 1 }, Strategic: { likelihood: 1, impact: 1 } },
  },
  {
    id: "liquidity-crunch",
    name: "Liquidity Crunch",
    description: "Investor outflows concentrate faster than underlying liquidity can absorb",
    deltas: { Financial: { likelihood: 2, impact: 2 }, Operational: { likelihood: 1, impact: 1 } },
  },
  {
    id: "cyber-surge",
    name: "Cyber Incident Surge",
    description: "Elevated threat environment — active exploitation of known vulnerability classes",
    deltas: { Cyber: { likelihood: 2, impact: 2 }, Reputational: { likelihood: 1, impact: 1 } },
  },
  {
    id: "regulatory-crackdown",
    name: "Regulatory Crackdown",
    description: "Accelerated enforcement action and tightened reporting requirements",
    deltas: { Compliance: { likelihood: 2, impact: 2 }, Strategic: { likelihood: 1, impact: 0 } },
  },
  {
    id: "counterparty-default",
    name: "Counterparty Default Wave",
    description: "A major counterparty fails, triggering contagion through connected exposures",
    deltas: { Financial: { likelihood: 1, impact: 2 }, Operational: { likelihood: 1, impact: 1 } },
  },
];

function clamp15(n) {
  return Math.min(5, Math.max(1, n));
}

// Applies a delta map ({ category: { likelihood, impact } }) to a set of
// risks, shifting INHERENT likelihood/impact only. Residual scores are left
// untouched — under stress, whether mitigations still hold is itself the
// insight worth seeing (a risk whose residual score stays low despite a
// severe inherent shock indicates a genuinely resilient mitigation).
export function applyStress(risks, deltas) {
  return risks.map(r => {
    const d = deltas[r.category];
    if (!d) return r;
    return {
      ...r,
      likelihood: clamp15(r.likelihood + (d.likelihood || 0)),
      impact: clamp15(r.impact + (d.impact || 0)),
    };
  });
}
