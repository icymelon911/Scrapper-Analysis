/**
 * Analysis Pipeline — Master orchestrator that chains all phases.
 *
 * Phase 1: Forensic Fingerprinting (device + timestamp classification)
 * Phase 2: Thematic Extraction (TF-IDF + domain mapping)
 * Phase 2.5: Z-Score Statistical Signal Detection
 * Phase 3: Sentiment Scoring (AFINN-165)
 * Phase 4: Market Correlation + Divergence Detection
 *
 * Output: Both internal detailed report AND spec-compliant JSON schema.
 */

import { classifySource, calculateSignalToNoise } from './forensicFingerprint.js';
import { analyzeThemes } from './thematicExtractor.js';
import { detectSignal, hasSignal } from './zScoreDetector.js';
import { scoreSentiment, calculateMarketUrgency } from './sentimentScorer.js';
import { correlateMarket } from './marketCorrelator.js';
import { BASELINE_CORPUS } from '../data/baselineCorpus.js';

let reportCounter = 0;

/**
 * Generate a unique report ID.
 */
function generateReportId() {
  reportCounter++;
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `VP-${dateStr}-${String(reportCounter).padStart(3, '0')}`;
}

/**
 * Generate a forensic note based on analysis results.
 */
function generateForensicNote(forensicProfile, themes, sentiment, market, zScore) {
  const parts = [];

  // Check if this is a known pattern or breaking divergence
  if (forensicProfile.signalToNoise.isNovel) {
    parts.push('BREAKING DIVERGENCE:');
    parts.push('Post deviates from 30-day campaign baseline.');
  } else {
    parts.push('KNOWN PATTERN:');
    parts.push('Post follows established rhetorical baseline.');
  }

  // Source behavior note
  if (forensicProfile.source.classification === 'Primary Persona Signal') {
    parts.push(`Late-night ${forensicProfile.source.device} post — high probability of personal, unfiltered communication.`);
  } else if (forensicProfile.source.classification === 'Staff/Campaign Signal') {
    parts.push(`Scheduled ${forensicProfile.source.device} post during market hours — consistent with managed content.`);
  }

  // Z-Score signal note
  if (zScore.isUrgent) {
    parts.push(`STATISTICAL ANOMALY: Keyword "${zScore.peakKeyword}" at Z=${zScore.peakZScore} (threshold: 3.0). Frequency spike exceeds 30-day baseline by >3σ.`);
  } else if (zScore.aggregateZScore > 2.0) {
    parts.push(`Elevated keyword deviation detected (aggregate Z=${zScore.aggregateZScore}).`);
  }

  // Thematic combination note
  const primary = themes.domainMapping.primary.domain;
  const secondary = themes.domainMapping.secondary.domain;
  if (themes.domainMapping.secondary.confidence > 0.1) {
    parts.push(`Novel thematic combination: ${primary} + ${secondary}.`);
  }

  // Escalation status for conflict posts
  if (themes.escalationStatus) {
    parts.push(`Conflict vector: ${themes.escalationStatus}.`);
  }

  // Direct market trigger
  if (themes.directMarketTrigger) {
    parts.push('DIRECT MARKET TRIGGER: Explicit tariff/interest-rate rhetoric detected.');
  }

  // Market divergence note
  if (market.data?.divergence?.divergenceDetected) {
    parts.push(`UNDERPRICED RISK: Sentiment (${sentiment.score}) diverges from VIX (${market.data.vix?.currentPrice}). Market is not pricing in this rhetoric.`);
  }

  // Market urgency note
  if (market.urgency?.level === 'HIGH') {
    parts.push(`HIGH URGENCY: Extreme sentiment (${sentiment.score}) with elevated market volatility (${market.data?.volatilityPct || 0}%). Historical pattern match suggests market-moving event within 48hrs.`);
  } else if (market.urgency?.level === 'MEDIUM') {
    parts.push(`Moderate market signal — monitor for price reaction in correlated asset.`);
  }

  return parts.join(' ');
}

/**
 * Build the spec-compliant output schema (Section III of the protocol).
 */
function buildSpecOutput(forensicProfile, themes, zScore, sentiment, market, forensicNote) {
  const primaryDomain = themes.domainMapping.primary;
  const zScoreValue = zScore.aggregateZScore;

  // Build intelligence summary
  const summaryParts = [];
  summaryParts.push(`${forensicProfile.source.classification} detected.`);
  summaryParts.push(`Primary theme: ${primaryDomain.domain} (${Math.round(primaryDomain.confidence * 100)}% confidence).`);

  if (zScore.isUrgent) {
    summaryParts.push(`URGENT: Z-Score ${zScore.peakZScore} on "${zScore.peakKeyword}" exceeds 3σ threshold.`);
  }

  if (market.data?.divergence?.divergenceDetected) {
    summaryParts.push('Divergence: Underpriced Risk detected.');
  }

  summaryParts.push(`Sentiment: ${sentiment.label} (${sentiment.score}).`);

  // Determine discord title
  let discordTitle;
  if (zScore.isUrgent) {
    discordTitle = '🚨 THEME SPIKE DETECTED';
  } else if (market.data?.divergence?.divergenceDetected) {
    discordTitle = '⚡ UNDERPRICED RISK — DIVERGENCE ALERT';
  } else if (zScore.aggregateZScore > 2.0) {
    discordTitle = '⚠️ ELEVATED SIGNAL DETECTED';
  } else {
    discordTitle = 'ℹ️ SIGNAL PROCESSED — NOMINAL';
  }

  return {
    intelligence_summary: summaryParts.join(' '),
    classification: {
      source_authenticity: forensicProfile.source.sourceAuthenticity,
      primary_theme: primaryDomain.domain,
      z_score: zScoreValue
    },
    market_impact: {
      correlated_asset: market.data?.assetName || 'Unknown',
      expected_volatility: market.data?.expectedVolatility || 'Low',
      divergence_detected: market.data?.divergence?.divergenceDetected || false
    },
    alert_payload: {
      discord_title: discordTitle,
      bento_icon: primaryDomain.bentoIcon || '📊',
      forensic_note: forensicNote
    }
  };
}

/**
 * Run the full analysis pipeline on a single post.
 * @param {object} post - Standardized post object { text, device, timestamp, engagement, baseline_metrics?, market_data? }
 * @returns {object} Complete intelligence report with spec_output
 */
export async function analyzePost(post) {
  const startTime = Date.now();

  // Phase 1: Forensic Fingerprinting
  const sourceClassification = classifySource(post.device, post.timestamp);
  const signalToNoise = calculateSignalToNoise(post.text, BASELINE_CORPUS);

  const forensicProfile = {
    source: sourceClassification,
    signalToNoise
  };

  // Phase 2: Thematic Extraction
  const thematicAnalysis = analyzeThemes(post.text, BASELINE_CORPUS);

  // Phase 2.5: Z-Score Statistical Signal Detection
  const zScoreAnalysis = detectSignal(post.text, post.baseline_metrics || null);

  // Early termination check: if no signal at all, short-circuit
  const noSignal = zScoreAnalysis.totalTrackedKeywords === 0 &&
                   thematicAnalysis.domainMapping.primary.confidence < 0.05;

  // Phase 3: Sentiment Scoring
  const sentimentAnalysis = scoreSentiment(post.text);

  // Phase 4: Market Correlation (now receives sentiment for divergence detection)
  const marketData = await correlateMarket(thematicAnalysis.domainMapping, sentimentAnalysis.score);
  const marketUrgency = calculateMarketUrgency(sentimentAnalysis.score, marketData.volatilityPct || 0);

  const market = {
    data: marketData,
    urgency: marketUrgency
  };

  // Generate forensic note
  const forensicNote = noSignal
    ? 'NO VOLATILITY SIGNAL DETECTED'
    : generateForensicNote(forensicProfile, thematicAnalysis, sentimentAnalysis, market, zScoreAnalysis);

  // Build the spec-compliant output
  const specOutput = noSignal
    ? {
        intelligence_summary: 'NO VOLATILITY SIGNAL DETECTED',
        classification: {
          source_authenticity: sourceClassification.sourceAuthenticity,
          primary_theme: 'None',
          z_score: 0
        },
        market_impact: {
          correlated_asset: 'None',
          expected_volatility: 'Low',
          divergence_detected: false
        },
        alert_payload: {
          discord_title: '○ NO SIGNAL',
          bento_icon: '⬜',
          forensic_note: 'NO VOLATILITY SIGNAL DETECTED'
        }
      }
    : buildSpecOutput(forensicProfile, thematicAnalysis, zScoreAnalysis, sentimentAnalysis, market, forensicNote);

  // Assemble final report
  const report = {
    id: generateReportId(),
    timestamp: new Date().toISOString(),
    input: {
      text: post.text,
      device: post.device || 'unknown',
      postTime: post.timestamp || new Date().toISOString(),
      engagement: post.engagement || {}
    },
    forensicProfile: {
      sourceClassification: sourceClassification.classification,
      sourceAuthenticity: sourceClassification.sourceAuthenticity,
      sourceConfidence: sourceClassification.confidence,
      device: sourceClassification.device,
      postingHourET: sourceClassification.postingHourET,
      reasoning: sourceClassification.reasoning,
      signalToNoiseRatio: signalToNoise.ratio,
      isNovel: signalToNoise.isNovel,
      noveltyLabel: signalToNoise.label,
      novelTerms: signalToNoise.novelTerms
    },
    zScoreAnalysis: {
      peakKeyword: zScoreAnalysis.peakKeyword,
      peakZScore: zScoreAnalysis.peakZScore,
      aggregateZScore: zScoreAnalysis.aggregateZScore,
      isUrgent: zScoreAnalysis.isUrgent,
      label: zScoreAnalysis.label,
      elevatedSignals: zScoreAnalysis.elevatedSignals,
      topScores: zScoreAnalysis.allScores
    },
    thematicAnalysis: {
      highImpactTerms: thematicAnalysis.highImpactTerms,
      tfidfScores: thematicAnalysis.tfidfScores,
      escalationStatus: thematicAnalysis.escalationStatus,
      directMarketTrigger: thematicAnalysis.directMarketTrigger,
      domainMapping: {
        primary: {
          domain: thematicAnalysis.domainMapping.primary.domain,
          confidence: thematicAnalysis.domainMapping.primary.confidence,
          matchedTerms: thematicAnalysis.domainMapping.primary.matchedTerms,
          bentoIcon: thematicAnalysis.domainMapping.primary.bentoIcon
        },
        secondary: {
          domain: thematicAnalysis.domainMapping.secondary.domain,
          confidence: thematicAnalysis.domainMapping.secondary.confidence,
          matchedTerms: thematicAnalysis.domainMapping.secondary.matchedTerms,
          bentoIcon: thematicAnalysis.domainMapping.secondary.bentoIcon
        }
      }
    },
    sentimentAnalysis: {
      score: sentimentAnalysis.score,
      label: sentimentAnalysis.label,
      emoji: sentimentAnalysis.emoji,
      positiveTerms: sentimentAnalysis.positiveTerms,
      negativeTerms: sentimentAnalysis.negativeTerms
    },
    marketCorrelation: {
      symbol: marketData.symbol,
      assetName: marketData.assetName,
      currentPrice: marketData.currentPrice,
      dailyDelta: marketData.dailyDelta,
      volatilityPct: marketData.volatilityPct,
      dataSource: marketData.source,
      expectedVolatility: marketData.expectedVolatility,
      marketUrgency: marketUrgency.level,
      urgencyEmoji: marketUrgency.emoji,
      urgencyReasoning: marketUrgency.reasoning,
      vix: marketData.vix || null,
      divergence: marketData.divergence || null
    },
    forensicNote,
    spec_output: specOutput,
    meta: {
      version: '2.0.0',
      protocol: 'Antigravity Forensic Processing Protocol',
      processedAt: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime
    }
  };

  return report;
}

/**
 * Run the pipeline on multiple posts.
 * @param {object[]} posts - Array of standardized post objects
 * @returns {object[]} Array of intelligence reports
 */
export async function analyzePosts(posts) {
  const reports = [];
  for (const post of posts) {
    const report = await analyzePost(post);
    reports.push(report);
  }
  return reports;
}

export default { analyzePost, analyzePosts };
