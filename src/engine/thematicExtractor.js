/**
 * Phase 2: Thematic Extraction & Weighting
 * Uses TF-IDF to isolate high-impact terms and maps them to the domain matrix.
 */

import natural from 'natural';
import { DOMAINS, scoreDomains } from '../data/domainKeywords.js';

const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

// Stopwords to filter out
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'it', 'this', 'that', 'are', 'was',
  'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
  'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can',
  'shall', 'not', 'no', 'nor', 'so', 'too', 'very', 'just', 'about',
  'up', 'out', 'if', 'then', 'than', 'more', 'most', 'such', 'only',
  'own', 'same', 'also', 'into', 'over', 'after', 'before', 'between',
  'under', 'again', 'further', 'once', 'here', 'there', 'when', 'where',
  'why', 'how', 'all', 'each', 'every', 'both', 'few', 'some', 'any',
  'other', 'our', 'we', 'us', 'i', 'me', 'my', 'you', 'your', 'he',
  'him', 'his', 'she', 'her', 'they', 'them', 'their', 'its', 'what',
  'which', 'who', 'whom', 'these', 'those', 'am', 'going', 'like',
  'get', 'got', 'make', 'made', 'come', 'came', 'take', 'took', 'give',
  'gave', 'know', 'knew', 'think', 'thought', 'say', 'said', 'see',
  'saw', 'want', 'need', 'must', 'let', 'keep', 'never', 'ever',
  'much', 'many', 'well', 'back', 'even', 'still', 'new', 'now',
  'way', 'time', 'thing', 'people', 'great', 'good', 'bad'
]);

/**
 * Clean and tokenize text, removing stopwords and short tokens.
 * @param {string} text - Raw text to process
 * @returns {string[]} Cleaned tokens
 */
function cleanTokenize(text) {
  const cleaned = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')     // Remove URLs
    .replace(/@\w+/g, '')               // Remove mentions
    .replace(/#(\w+)/g, '$1')           // Keep hashtag text, remove #
    .replace(/[^\w\s]/g, ' ')           // Remove punctuation
    .replace(/\s+/g, ' ')               // Normalize whitespace
    .trim();

  const tokens = tokenizer.tokenize(cleaned) || [];
  return tokens.filter(t => t.length > 2 && !STOPWORDS.has(t));
}

/**
 * Extract high-impact terms from text using TF-IDF against a baseline corpus.
 * @param {string} text - The post text to analyze
 * @param {string[]} baselineCorpus - Array of baseline post texts
 * @returns {object} Thematic extraction results
 */
export function extractThemes(text, baselineCorpus) {
  const tfidf = new natural.TfIdf();

  // Add baseline corpus
  for (const doc of baselineCorpus) {
    tfidf.addDocument(cleanTokenize(doc).join(' '));
  }

  // Add the current post
  const postTokens = cleanTokenize(text);
  tfidf.addDocument(postTokens.join(' '));

  const postIndex = baselineCorpus.length;
  const terms = tfidf.listTerms(postIndex);

  // Extract top 10 high-impact terms
  const highImpactTerms = terms
    .filter(t => t.term.length > 2)
    .slice(0, 10)
    .map(t => ({
      term: t.term,
      tfidf: Math.round(t.tfidf * 100) / 100
    }));

  // Build TF-IDF scores map
  const tfidfScores = {};
  for (const t of highImpactTerms) {
    tfidfScores[t.term] = t.tfidf;
  }

  return {
    highImpactTerms: highImpactTerms.map(t => t.term),
    tfidfScores,
    tokenCount: postTokens.length,
    allTokens: postTokens
  };
}

/**
 * Map extracted themes to the 4-domain matrix.
 * @param {string[]} terms - Array of extracted terms
 * @returns {object} Domain mapping with primary/secondary and confidence
 */
export function mapToDomains(terms) {
  const domainScores = scoreDomains(terms);
  const primary = domainScores[0];
  const secondary = domainScores[1];

  // Resolve bentoIcon from DOMAINS config
  const primaryDomainConfig = DOMAINS[primary.domain];
  const secondaryDomainConfig = DOMAINS[secondary.domain];

  return {
    primary: {
      domain: primary.domain,
      confidence: primary.confidence,
      matchedTerms: primary.matchedTerms,
      marketSymbol: primary.marketSymbol,
      assetName: primary.assetName,
      bentoIcon: primaryDomainConfig?.bentoIcon || '📊'
    },
    secondary: {
      domain: secondary.domain,
      confidence: secondary.confidence,
      matchedTerms: secondary.matchedTerms,
      marketSymbol: secondary.marketSymbol,
      assetName: secondary.assetName,
      bentoIcon: secondaryDomainConfig?.bentoIcon || '📊'
    },
    allScores: domainScores
  };
}

/**
 * Full Phase 2 analysis — extract themes and map to domains.
 */
export function analyzeThemes(text, baselineCorpus) {
  const themes = extractThemes(text, baselineCorpus);
  const domainMapping = mapToDomains(themes.allTokens);

  // Step 3 Enrichment: Conflict escalation/de-escalation analysis
  let escalationStatus = null;
  if (domainMapping.primary.domain === 'Global Conflict') {
    const conflictConfig = DOMAINS['Global Conflict'];
    const lowerTokens = themes.allTokens.map(t => t.toLowerCase());
    const escCount = lowerTokens.filter(t => conflictConfig.escalationVocab?.includes(t)).length;
    const deescCount = lowerTokens.filter(t => conflictConfig.deescalationVocab?.includes(t)).length;

    if (escCount > deescCount) escalationStatus = 'Escalation';
    else if (deescCount > escCount) escalationStatus = 'De-escalation';
    else escalationStatus = 'Neutral';
  }

  // Step 3 Enrichment: Direct market trigger detection
  let directMarketTrigger = false;
  if (domainMapping.primary.domain === 'Economic Volatility') {
    const econConfig = DOMAINS['Economic Volatility'];
    const lowerTokens = themes.allTokens.map(t => t.toLowerCase());
    directMarketTrigger = lowerTokens.some(t => econConfig.directMarketTriggers?.includes(t));
  }

  return {
    ...themes,
    domainMapping,
    escalationStatus,
    directMarketTrigger
  };
}

export default { extractThemes, mapToDomains, analyzeThemes };
