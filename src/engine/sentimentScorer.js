/**
 * Phase 3: Sentiment Scoring
 * Uses AFINN-165 lexicon via the `sentiment` npm package.
 * Normalizes to a -10 to +10 scale.
 */

import Sentiment from 'sentiment';

const analyzer = new Sentiment();

// Sentiment label thresholds
const LABELS = [
  { min: -10, max: -7, label: 'Strongly Negative', emoji: '🔴' },
  { min: -7,  max: -3, label: 'Negative', emoji: '🟠' },
  { min: -3,  max: 3,  label: 'Neutral', emoji: '⚪' },
  { min: 3,   max: 7,  label: 'Positive', emoji: '🟢' },
  { min: 7,   max: 10, label: 'Strongly Positive', emoji: '🔵' },
];

/**
 * Score sentiment of text on a -10 to +10 scale.
 * @param {string} text - The text to analyze
 * @returns {object} Sentiment analysis result
 */
export function scoreSentiment(text) {
  const result = analyzer.analyze(text);

  // Normalize the comparative score to -10 to +10 range
  // AFINN comparative scores typically range from -1 to +1
  // We multiply by 10 and clamp to get our -10 to +10 scale
  let score = Math.round(result.comparative * 10 * 100) / 100;
  score = Math.max(-10, Math.min(10, score));

  // Find label
  const labelObj = LABELS.find(l => score >= l.min && score <= l.max) || LABELS[2];

  // Extract positive and negative words
  const positiveTerms = [...new Set(result.positive || [])];
  const negativeTerms = [...new Set(result.negative || [])];

  return {
    score,
    rawScore: result.score,
    comparative: result.comparative,
    label: labelObj.label,
    emoji: labelObj.emoji,
    positiveTerms,
    negativeTerms,
    wordCount: result.tokens?.length || 0
  };
}

/**
 * Determine market urgency based on sentiment extremity and price volatility.
 * @param {number} sentimentScore - Normalized sentiment score (-10 to +10)
 * @param {number} volatilityPct - Price volatility percentage
 * @returns {object} Market urgency classification
 */
export function calculateMarketUrgency(sentimentScore, volatilityPct = 0) {
  const absSentiment = Math.abs(sentimentScore);

  let level = 'LOW';
  let emoji = '🟢';
  let reasoning = '';

  if (absSentiment > 7 && volatilityPct > 1) {
    level = 'HIGH';
    emoji = '🔴';
    reasoning = `Extreme sentiment (${sentimentScore}) combined with elevated volatility (${volatilityPct}%). Immediate market impact likely.`;
  } else if (absSentiment > 4 || volatilityPct > 1) {
    level = 'MEDIUM';
    emoji = '🟡';
    reasoning = absSentiment > 4
      ? `Notable sentiment intensity (${sentimentScore}). Monitor for market reaction.`
      : `Market volatility elevated (${volatilityPct}%). External factors at play.`;
  } else {
    reasoning = `Sentiment within normal bounds (${sentimentScore}). No immediate market urgency.`;
  }

  return {
    level,
    emoji,
    reasoning,
    sentimentIntensity: absSentiment,
    volatilityPct
  };
}

export default { scoreSentiment, calculateMarketUrgency };
