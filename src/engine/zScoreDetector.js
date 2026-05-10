/**
 * Z-Score Statistical Signal Detector
 * 
 * Implements the Antigravity formula:
 *   Z = (x - μ) / σ
 * 
 * Where:
 *   x = current mention frequency of a theme in the post
 *   μ = 30-day mean mention frequency
 *   σ = 30-day standard deviation
 * 
 * If Z > 3.0, triggers an Urgent Trend Alert.
 */

import { BASELINE_METRICS } from '../data/baselineMetrics.js';

/**
 * Tokenize and count keyword frequencies in a text.
 * @param {string} text - Raw post text
 * @returns {Map<string, number>} Keyword frequency map
 */
function countKeywordFrequencies(text) {
  const frequencies = new Map();
  const cleaned = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/@\w+/g, '')
    .replace(/#(\w+)/g, '$1')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = cleaned.split(' ').filter(t => t.length > 2);

  for (const token of tokens) {
    frequencies.set(token, (frequencies.get(token) || 0) + 1);
  }

  return frequencies;
}

/**
 * Calculate Z-Score for a single keyword.
 * @param {number} observed - Current frequency (x)
 * @param {number} mean - 30-day average (μ)
 * @param {number} stdDev - 30-day standard deviation (σ)
 * @returns {number} Z-Score value
 */
function calculateZScore(observed, mean, stdDev) {
  if (stdDev === 0 || stdDev === undefined) return 0;
  return (observed - mean) / stdDev;
}

/**
 * Run Z-Score analysis on a post against baseline metrics.
 * Returns the highest-scoring theme and its Z-Score.
 *
 * @param {string} text - The post text to analyze
 * @param {object} [customBaseline] - Optional override baseline metrics
 *   { '30d_avg_mentions': { keyword: mean }, 'standard_deviation': { keyword: σ } }
 * @returns {object} Z-Score analysis result
 */
export function detectSignal(text, customBaseline = null) {
  const baseline = customBaseline || BASELINE_METRICS;
  const means = baseline['30d_avg_mentions'] || {};
  const stdDevs = baseline['standard_deviation'] || {};

  const frequencies = countKeywordFrequencies(text);

  const zScores = [];

  for (const [keyword, count] of frequencies) {
    const mean = means[keyword];
    const stdDev = stdDevs[keyword];

    // Only calculate Z-Score for keywords that exist in our baseline
    if (mean !== undefined && stdDev !== undefined && stdDev > 0) {
      const z = calculateZScore(count, mean, stdDev);
      zScores.push({
        keyword,
        observed: count,
        mean: Math.round(mean * 100) / 100,
        stdDev: Math.round(stdDev * 100) / 100,
        zScore: Math.round(z * 100) / 100
      });
    }
  }

  // Sort by absolute Z-Score descending — highest deviation first
  zScores.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));

  // Determine the peak signal
  const peak = zScores[0] || null;
  const peakZ = peak ? peak.zScore : 0;
  const isUrgent = Math.abs(peakZ) > 3.0;

  // Collect all keywords that exceeded the Z > 2.0 threshold (elevated signals)
  const elevatedSignals = zScores.filter(z => Math.abs(z.zScore) > 2.0);

  // Aggregate Z-Score: weighted average of top-3 signals
  const topN = zScores.slice(0, 3);
  const aggregateZ = topN.length > 0
    ? Math.round((topN.reduce((sum, z) => sum + Math.abs(z.zScore), 0) / topN.length) * 100) / 100
    : 0;

  return {
    peakKeyword: peak?.keyword || null,
    peakZScore: Math.round(peakZ * 100) / 100,
    aggregateZScore: aggregateZ,
    isUrgent,
    urgentThreshold: 3.0,
    label: isUrgent
      ? '🚨 URGENT TREND ALERT'
      : aggregateZ > 2.0
        ? '⚠️ ELEVATED SIGNAL'
        : aggregateZ > 1.0
          ? 'ℹ️ MODERATE DEVIATION'
          : '○ BASELINE NOMINAL',
    elevatedSignals,
    allScores: zScores.slice(0, 10), // Top 10 for report detail
    totalTrackedKeywords: zScores.length
  };
}

/**
 * Quick check: does this post contain any signal at all?
 * Used for early termination per spec: "NO VOLATILITY SIGNAL DETECTED"
 * @param {string} text - Post text
 * @param {object} [customBaseline] - Optional baseline override
 * @returns {boolean} True if any signal detected
 */
export function hasSignal(text, customBaseline = null) {
  const result = detectSignal(text, customBaseline);
  return result.aggregateZScore > 0.5 || result.totalTrackedKeywords > 0;
}

export default { detectSignal, hasSignal };
