/**
 * Domain Keywords — Centralized keyword dictionary for the 4-domain matrix.
 * Each keyword has a weight (1–3) for confidence scoring.
 */

export const DOMAINS = {
  'Oil/Energy': {
    keywords: {
      oil: 3, drill: 3, drilling: 3, opec: 3, pipeline: 3, energy: 2,
      lng: 2, barrel: 2, fracking: 3, petroleum: 3, refinery: 2,
      crude: 3, gasoline: 2, gas: 1, fuel: 2, shale: 2, offshore: 2,
      solar: 2, wind: 1, nuclear: 1, coal: 2, carbon: 1, emission: 1,
      eia: 2, reserves: 2, export: 1, import: 1, strategic: 1,
      keystone: 3, anwr: 3, permian: 2, dominance: 1
    },
    marketSymbol: 'CL=F',
    assetName: 'WTI Crude Oil',
    bentoIcon: '🛢️'
  },

  'Global Conflict': {
    keywords: {
      nato: 3, military: 3, troops: 3, sanctions: 3, war: 3,
      defense: 2, allies: 2, nuclear: 2, missile: 3, army: 2,
      navy: 2, attack: 2, invasion: 3, ceasefire: 3, treaty: 2,
      weapons: 2, intelligence: 1, espionage: 2, terror: 3,
      terrorist: 3, security: 1, border: 2, iran: 2, china: 2,
      russia: 2, ukraine: 3, taiwan: 2, korea: 2, pacific: 1,
      deployment: 2, pentagon: 2, general: 1, combat: 2, drone: 2
    },
    escalationVocab: [
      'attack', 'invasion', 'strike', 'deploy', 'deployment', 'retaliate',
      'retaliation', 'escalate', 'escalation', 'mobilize', 'mobilization',
      'threat', 'threaten', 'destroy', 'annihilate', 'war', 'bomb',
      'offensive', 'launch', 'confront', 'provoke', 'aggression'
    ],
    deescalationVocab: [
      'ceasefire', 'treaty', 'negotiate', 'negotiation', 'diplomacy',
      'diplomatic', 'peace', 'peaceful', 'withdraw', 'withdrawal',
      'truce', 'accord', 'agreement', 'deescalate', 'reconcile',
      'reconciliation', 'dialogue', 'summit', 'cooperation'
    ],
    marketSymbol: 'GLD',
    assetName: 'Gold ETF (Safe Haven)',
    bentoIcon: '⚔️'
  },

  'Economic Volatility': {
    keywords: {
      tariff: 3, tariffs: 3, trade: 2, deficit: 3, inflation: 3,
      rates: 2, fed: 3, gdp: 2, recession: 3, economy: 2,
      jobs: 2, unemployment: 3, tax: 2, taxes: 2, debt: 2,
      spending: 2, budget: 2, treasury: 2, dollar: 2, currency: 2,
      stock: 2, market: 1, crash: 3, bubble: 3, growth: 1,
      interest: 2, stimulus: 3, bailout: 3, default: 3, bond: 2,
      yield: 2, wall: 1, street: 1, dow: 2, nasdaq: 2, sp500: 2
    },
    directMarketTriggers: ['tariff', 'tariffs', 'interest', 'rates'],
    marketSymbol: 'SPY',
    assetName: 'S&P 500 ETF',
    bentoIcon: '📈'
  },

  'Law/Justice': {
    keywords: {
      court: 3, doj: 3, fbi: 3, indictment: 3, verdict: 3,
      judge: 3, subpoena: 3, trial: 3, attorney: 2, lawyer: 2,
      prosecution: 3, defendant: 2, guilty: 3, innocent: 2,
      supreme: 3, constitutional: 2, amendment: 2, impeach: 3,
      impeachment: 3, investigation: 2, testimony: 3, witness: 2,
      evidence: 2, law: 1, legal: 1, justice: 2, crime: 2,
      criminal: 2, fraud: 3, corruption: 3, witch: 2, hunt: 1,
      hoax: 2, rigged: 3, stolen: 2, election: 2
    },
    marketSymbol: '^VIX',
    assetName: 'VIX Volatility Index',
    bentoIcon: '⚖️'
  }
};

/**
 * Get all keywords across all domains as a flat set.
 */
export function getAllKeywords() {
  const all = new Set();
  for (const domain of Object.values(DOMAINS)) {
    for (const keyword of Object.keys(domain.keywords)) {
      all.add(keyword);
    }
  }
  return all;
}

/**
 * Score text against all domains, return sorted results with confidence.
 */
export function scoreDomains(terms) {
  const scores = {};

  for (const [domainName, domain] of Object.entries(DOMAINS)) {
    let totalWeight = 0;
    let maxPossible = 0;
    const matchedTerms = [];

    for (const term of terms) {
      const lower = term.toLowerCase();
      if (domain.keywords[lower]) {
        totalWeight += domain.keywords[lower];
        matchedTerms.push(lower);
      }
    }

    // Max possible = sum of top N keyword weights (N = terms.length)
    const sortedWeights = Object.values(domain.keywords).sort((a, b) => b - a);
    for (let i = 0; i < Math.min(terms.length, sortedWeights.length); i++) {
      maxPossible += sortedWeights[i];
    }

    scores[domainName] = {
      score: totalWeight,
      confidence: maxPossible > 0 ? Math.round((totalWeight / maxPossible) * 100) / 100 : 0,
      matchedTerms,
      marketSymbol: domain.marketSymbol,
      assetName: domain.assetName
    };
  }

  // Sort by score descending
  const sorted = Object.entries(scores).sort((a, b) => b[1].score - a[1].score);
  return sorted.map(([name, data]) => ({ domain: name, ...data }));
}
