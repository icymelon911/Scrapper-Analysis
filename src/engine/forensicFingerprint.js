/**
 * Phase 1: Forensic Fingerprinting
 * Classifies source signal type and calculates signal-to-noise ratio.
 */

import natural from 'natural';

const tokenizer = new natural.WordTokenizer();

/**
 * Classify the source of a post based on device + timestamp.
 * @param {string} device - Device type (e.g., "iPhone", "Web Client", "Android")
 * @param {string} timestamp - ISO 8601 timestamp
 * @returns {object} Classification result
 */
export function classifySource(device, timestamp) {
  const date = new Date(timestamp);
  const hour = date.getUTCHours();

  // Convert to ET (UTC-4 / UTC-5 depending on DST, approximate with UTC-4)
  const etHour = (hour - 4 + 24) % 24;

  const deviceLower = (device || '').toLowerCase();
  const isPhone = deviceLower.includes('iphone') || deviceLower.includes('android');
  const isWebClient = deviceLower.includes('web') || deviceLower.includes('client') || deviceLower.includes('browser');
  const isLateNight = etHour >= 22 || etHour < 4;  // Spec: 22:00–04:00 target local time
  const isMarketHours = etHour >= 9 && etHour < 17; // Standard working hours: 09:00–17:00 ET

  let classification = 'Unclassified Signal';
  let confidence = 0.5;
  let reasoning = '';
  let sourceAuthenticity = 'Low'; // Default: Low signal value

  if (isPhone && isLateNight) {
    classification = 'Primary Persona Signal';
    confidence = 0.92;
    sourceAuthenticity = 'High';
    reasoning = `Mobile device (${device}) used during late-night hours (${etHour}:00 ET). High probability of personal, unfiltered communication.`;
  } else if (isWebClient && isMarketHours) {
    classification = 'Staff/Campaign Signal';
    confidence = 0.78;
    reasoning = `Web client used during market hours (${etHour}:00 ET). Pattern consistent with staff-managed/scheduled content.`;
  } else if (isPhone && isMarketHours) {
    classification = 'Executive Override Signal';
    confidence = 0.65;
    sourceAuthenticity = 'High';
    reasoning = `Mobile device used during market hours. Possible real-time reaction to breaking news.`;
  } else if (isWebClient && isLateNight) {
    classification = 'Scheduled/Bot Signal';
    confidence = 0.70;
    reasoning = `Web client used late-night. Likely pre-scheduled content or automated posting.`;
  } else {
    reasoning = `Device: ${device || 'unknown'}, Hour: ${etHour}:00 ET. No strong pattern match.`;
  }

  return {
    classification,
    confidence,
    sourceAuthenticity,
    device: device || 'unknown',
    postingHourET: etHour,
    isLateNight,
    isMarketHours,
    reasoning
  };
}

/**
 * Calculate Signal-to-Noise ratio by comparing post against baseline corpus.
 * Higher ratio = more novel/unique content (thematic shift).
 * Lower ratio = repetitive/boilerplate content.
 *
 * @param {string} text - The post text to analyze
 * @param {string[]} baselineCorpus - Array of baseline post texts
 * @returns {object} Signal-to-noise analysis
 */
export function calculateSignalToNoise(text, baselineCorpus) {
  const tfidf = new natural.TfIdf();

  // Add baseline corpus documents
  for (const doc of baselineCorpus) {
    tfidf.addDocument(doc.toLowerCase());
  }

  // Add the current post as the last document
  tfidf.addDocument(text.toLowerCase());

  const postIndex = baselineCorpus.length; // Index of the current post
  const postTerms = tfidf.listTerms(postIndex);

  // Calculate how many terms are "novel" (high TF-IDF = not common in baseline)
  let novelTermCount = 0;
  let totalTermCount = postTerms.length;
  let novelTerms = [];
  let boilerplateTerms = [];

  // Threshold: terms with TF-IDF score above median are "novel"
  const scores = postTerms.map(t => t.tfidf);
  const median = scores.length > 0
    ? scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)]
    : 0;

  for (const term of postTerms) {
    if (term.tfidf > median * 1.5) {
      novelTermCount++;
      novelTerms.push({ term: term.term, score: Math.round(term.tfidf * 100) / 100 });
    } else {
      boilerplateTerms.push(term.term);
    }
  }

  // Limit to top 5 novel terms
  novelTerms = novelTerms.sort((a, b) => b.score - a.score).slice(0, 5);

  const ratio = totalTermCount > 0
    ? Math.round((novelTermCount / totalTermCount) * 100) / 100
    : 0;

  const isNovel = ratio > 0.4; // More than 40% novel terms = thematic shift

  return {
    ratio,
    isNovel,
    label: isNovel ? 'Thematic Shift' : 'Baseline Repetition',
    novelTerms,
    boilerplateTermCount: boilerplateTerms.length,
    totalTermCount
  };
}

export default { classifySource, calculateSignalToNoise };
