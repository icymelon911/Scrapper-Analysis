/**
 * Phase 4: Market Correlation
 * Fetches market data from Alpha Vantage and correlates with domain analysis.
 */

import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.ALPHA_VANTAGE_API_KEY || 'demo';
const BASE_URL = 'https://www.alphavantage.co/query';

// Map domain symbols to Alpha Vantage-compatible symbols
const SYMBOL_MAP = {
  'CL=F':  { av: 'USO',  name: 'WTI Crude Oil (USO ETF proxy)', type: 'equity' },
  'GLD':   { av: 'GLD',  name: 'Gold ETF (Safe Haven)',         type: 'equity' },
  'SPY':   { av: 'SPY',  name: 'S&P 500 ETF',                  type: 'equity' },
  '^VIX':  { av: 'VXX',  name: 'VIX Volatility (VXX proxy)',    type: 'equity' },
  'BTC':   { av: 'BTC',  name: 'Bitcoin',                       type: 'crypto' },
};

// Mock data as fallback when API is unavailable
const MOCK_DATA = {
  'CL=F':  { currentPrice: 72.45, previousClose: 71.80, dailyDelta: 0.91, volatilityPct: 0.91 },
  'GLD':   { currentPrice: 188.30, previousClose: 186.50, dailyDelta: 0.97, volatilityPct: 0.97 },
  'SPY':   { currentPrice: 528.40, previousClose: 525.10, dailyDelta: 0.63, volatilityPct: 0.63 },
  '^VIX':  { currentPrice: 18.75, previousClose: 17.90, dailyDelta: 4.75, volatilityPct: 4.75 },
  'BTC':   { currentPrice: 68200, previousClose: 67500, dailyDelta: 1.04, volatilityPct: 1.04 },
};

/**
 * Fetch market data for a given symbol.
 * Falls back to mock data if API is unavailable.
 * @param {string} symbol - Market symbol (e.g., 'CL=F', 'SPY')
 * @returns {object} Market data with price, delta, and volatility
 */
export async function fetchMarketData(symbol) {
  const mapping = SYMBOL_MAP[symbol];
  if (!mapping) {
    return {
      symbol,
      assetName: 'Unknown Asset',
      currentPrice: 0,
      previousClose: 0,
      dailyDelta: 0,
      volatilityPct: 0,
      source: 'none',
      error: `Unknown symbol: ${symbol}`
    };
  }

  try {
    if (API_KEY === 'demo') {
      throw new Error('Using demo key — fallback to mock data');
    }

    let data;

    if (mapping.type === 'crypto') {
      const url = `${BASE_URL}?function=CURRENCY_EXCHANGE_RATE&from_currency=${mapping.av}&to_currency=USD&apikey=${API_KEY}`;
      const response = await fetch(url);
      data = await response.json();

      if (data['Realtime Currency Exchange Rate']) {
        const rate = data['Realtime Currency Exchange Rate'];
        const price = parseFloat(rate['5. Exchange Rate']);
        const mockPrev = MOCK_DATA[symbol]?.previousClose || price * 0.99;
        const delta = ((price - mockPrev) / mockPrev) * 100;

        return {
          symbol,
          assetName: mapping.name,
          currentPrice: Math.round(price * 100) / 100,
          previousClose: Math.round(mockPrev * 100) / 100,
          dailyDelta: Math.round(delta * 100) / 100,
          volatilityPct: Math.round(Math.abs(delta) * 100) / 100,
          source: 'alpha_vantage_live'
        };
      }
    } else {
      const url = `${BASE_URL}?function=GLOBAL_QUOTE&symbol=${mapping.av}&apikey=${API_KEY}`;
      const response = await fetch(url);
      data = await response.json();

      if (data['Global Quote']) {
        const quote = data['Global Quote'];
        const price = parseFloat(quote['05. price']);
        const prevClose = parseFloat(quote['08. previous close']);
        const changePct = parseFloat(quote['10. change percent']);

        return {
          symbol,
          assetName: mapping.name,
          currentPrice: Math.round(price * 100) / 100,
          previousClose: Math.round(prevClose * 100) / 100,
          dailyDelta: Math.round(changePct * 100) / 100,
          volatilityPct: Math.round(Math.abs(changePct) * 100) / 100,
          source: 'alpha_vantage_live'
        };
      }
    }

    // If API response is malformed, fall back
    throw new Error('Malformed API response');

  } catch (err) {
    // Fallback to mock data
    const mock = MOCK_DATA[symbol] || { currentPrice: 0, previousClose: 0, dailyDelta: 0, volatilityPct: 0 };

    return {
      symbol,
      assetName: mapping.name,
      currentPrice: mock.currentPrice,
      previousClose: mock.previousClose,
      dailyDelta: mock.dailyDelta,
      volatilityPct: mock.volatilityPct,
      source: 'mock_fallback',
      note: `Using mock data. Reason: ${err.message}`
    };
  }
}

/**
 * Fetch VIX data specifically for divergence analysis.
 * @returns {object} VIX market data
 */
export async function fetchVIXData() {
  return fetchMarketData('^VIX');
}

/**
 * Determine expected volatility level from sentiment + VIX data.
 * @param {number} sentimentScore - Normalized sentiment (-10 to +10)
 * @param {number} vixLevel - Current VIX level
 * @returns {string} 'Low' | 'Medium' | 'High'
 */
function classifyExpectedVolatility(sentimentScore, vixLevel) {
  const absSentiment = Math.abs(sentimentScore);

  if (absSentiment > 7 || vixLevel > 25) return 'High';
  if (absSentiment > 4 || vixLevel > 18) return 'Medium';
  return 'Low';
}

/**
 * Detect divergence between sentiment and market volatility.
 * If sentiment is aggressive/negative but VIX is low → "Underpriced Risk".
 * @param {number} sentimentScore - Normalized sentiment score
 * @param {object} vixData - VIX market data object
 * @returns {object} Divergence analysis
 */
export function detectDivergence(sentimentScore, vixData) {
  const vixLevel = vixData?.currentPrice || 0;
  const isAggressiveSentiment = sentimentScore < -4;  // Strongly negative
  const isLowVIX = vixLevel < 20;                     // Market complacent

  const divergenceDetected = isAggressiveSentiment && isLowVIX;

  return {
    divergenceDetected,
    label: divergenceDetected ? 'Underpriced Risk' : 'No Divergence',
    reasoning: divergenceDetected
      ? `Sentiment is aggressively negative (${sentimentScore}) but VIX is low (${vixLevel}). Market may be underpricing political risk.`
      : `Sentiment (${sentimentScore}) and VIX (${vixLevel}) are aligned. No divergence detected.`,
    sentimentScore,
    vixLevel
  };
}

/**
 * Correlate domain mapping with market data.
 * Also fetches VIX for divergence analysis.
 * @param {object} domainMapping - Result from thematic extraction
 * @param {number} [sentimentScore] - Sentiment score for divergence detection
 * @returns {object} Market correlation data with divergence analysis
 */
export async function correlateMarket(domainMapping, sentimentScore = 0) {
  const primarySymbol = domainMapping.primary?.marketSymbol;
  if (!primarySymbol) {
    return {
      error: 'No primary domain detected for market correlation',
      divergence: { divergenceDetected: false, label: 'No Divergence' },
      expectedVolatility: 'Low'
    };
  }

  // Fetch primary asset + VIX in parallel
  const [marketData, vixData] = await Promise.all([
    fetchMarketData(primarySymbol),
    primarySymbol !== '^VIX' ? fetchVIXData() : fetchMarketData('^VIX')
  ]);

  // Divergence analysis
  const divergence = detectDivergence(sentimentScore, vixData);

  // Expected volatility classification
  const expectedVolatility = classifyExpectedVolatility(
    sentimentScore,
    vixData?.currentPrice || 0
  );

  return {
    ...marketData,
    correlatedDomain: domainMapping.primary.domain,
    correlationConfidence: domainMapping.primary.confidence,
    vix: {
      currentPrice: vixData.currentPrice,
      dailyDelta: vixData.dailyDelta,
      source: vixData.source
    },
    divergence,
    expectedVolatility
  };
}

export default { fetchMarketData, fetchVIXData, detectDivergence, correlateMarket };
