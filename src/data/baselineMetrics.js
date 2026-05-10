/**
 * Baseline Metrics — 30-day rolling averages and standard deviations for Z-Score computation.
 * These represent the statistical baseline of keyword mention frequency across
 * the monitoring window. Seeded with realistic values; the scraper's corpus
 * can auto-update these over time.
 *
 * Schema:
 *   30d_avg_mentions: Map<keyword, mean_daily_frequency>
 *   standard_deviation: Map<keyword, σ>
 */

export const BASELINE_METRICS = {
  '30d_avg_mentions': {
    // Oil/Energy
    oil: 12.4, drill: 8.1, drilling: 6.7, opec: 4.9, pipeline: 3.8,
    energy: 9.2, lng: 2.1, barrel: 3.5, fracking: 2.8, petroleum: 2.3,
    crude: 4.1, gasoline: 3.0, gas: 7.6, fuel: 4.2, shale: 2.5,
    keystone: 1.9, dominance: 5.3, reserves: 2.7,

    // Global Conflict
    nato: 6.8, military: 9.5, troops: 5.2, sanctions: 5.8, war: 4.3,
    defense: 7.1, allies: 4.6, nuclear: 3.1, missile: 2.4, invasion: 1.8,
    ceasefire: 1.2, treaty: 1.5, weapons: 3.3, terror: 2.0, terrorist: 1.7,
    security: 8.9, border: 7.4, iran: 3.6, china: 11.2, russia: 5.9,
    ukraine: 4.7, taiwan: 2.8, korea: 2.2, deployment: 1.6, pentagon: 2.9,

    // Economic Volatility
    tariff: 7.3, tariffs: 7.3, trade: 8.6, deficit: 4.8, inflation: 6.1,
    rates: 5.4, fed: 4.2, gdp: 2.3, recession: 3.1, economy: 10.8,
    jobs: 8.2, unemployment: 4.5, tax: 6.9, taxes: 6.9, debt: 5.0,
    spending: 4.7, treasury: 2.1, dollar: 3.8, currency: 2.4,
    stock: 5.6, market: 9.3, crash: 1.4, growth: 6.5, interest: 4.9,
    stimulus: 2.8, bailout: 1.1, default: 0.9,

    // Law/Justice
    court: 4.2, doj: 4.8, fbi: 3.9, indictment: 2.1, verdict: 1.3,
    judge: 3.7, subpoena: 1.5, trial: 3.2, attorney: 2.8, prosecution: 2.0,
    guilty: 1.8, supreme: 2.4, impeach: 1.6, impeachment: 1.6,
    investigation: 3.5, testimony: 1.4, evidence: 2.9, justice: 4.1,
    crime: 5.3, fraud: 2.7, corruption: 2.3, witch: 3.8, hunt: 3.5,
    hoax: 3.2, rigged: 2.9, stolen: 2.6, election: 5.8
  },

  'standard_deviation': {
    // Oil/Energy
    oil: 3.2, drill: 2.1, drilling: 1.8, opec: 1.6, pipeline: 1.2,
    energy: 2.5, lng: 0.8, barrel: 1.1, fracking: 0.9, petroleum: 0.7,
    crude: 1.3, gasoline: 1.0, gas: 2.0, fuel: 1.3, shale: 0.8,
    keystone: 0.6, dominance: 1.5, reserves: 0.9,

    // Global Conflict
    nato: 2.0, military: 2.8, troops: 1.6, sanctions: 1.9, war: 1.5,
    defense: 2.1, allies: 1.4, nuclear: 1.1, missile: 0.9, invasion: 0.7,
    ceasefire: 0.5, treaty: 0.6, weapons: 1.1, terror: 0.8, terrorist: 0.7,
    security: 2.4, border: 2.1, iran: 1.2, china: 3.1, russia: 1.8,
    ukraine: 1.5, taiwan: 1.0, korea: 0.8, deployment: 0.6, pentagon: 1.0,

    // Economic Volatility
    tariff: 2.3, tariffs: 2.3, trade: 2.4, deficit: 1.5, inflation: 1.9,
    rates: 1.7, fed: 1.4, gdp: 0.8, recession: 1.1, economy: 2.9,
    jobs: 2.3, unemployment: 1.4, tax: 2.0, taxes: 2.0, debt: 1.6,
    spending: 1.5, treasury: 0.8, dollar: 1.2, currency: 0.9,
    stock: 1.7, market: 2.6, crash: 0.5, growth: 1.9, interest: 1.5,
    stimulus: 1.0, bailout: 0.4, default: 0.4,

    // Law/Justice
    court: 1.4, doj: 1.6, fbi: 1.3, indictment: 0.8, verdict: 0.5,
    judge: 1.2, subpoena: 0.6, trial: 1.1, attorney: 0.9, prosecution: 0.7,
    guilty: 0.7, supreme: 0.9, impeach: 0.6, impeachment: 0.6,
    investigation: 1.2, testimony: 0.6, evidence: 1.0, justice: 1.3,
    crime: 1.7, fraud: 0.9, corruption: 0.8, witch: 1.2, hunt: 1.1,
    hoax: 1.1, rigged: 1.0, stolen: 0.9, election: 1.8
  }
};

export default BASELINE_METRICS;
