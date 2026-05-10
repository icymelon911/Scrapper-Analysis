/**
 * Sample Posts — Pre-built test posts covering all domains and signal types.
 * Used for testing and demonstration of the analysis pipeline.
 *
 * Each post now includes optional baseline_metrics for Z-Score computation.
 */

export const SAMPLE_POSTS = [
  {
    id: 'sample-001',
    text: 'We will DRILL like never before. Energy DOMINANCE is coming. OPEC better watch out — America is going to flood the market with oil! 🛢️🇺🇸',
    device: 'iPhone',
    timestamp: '2026-05-07T23:14:00-04:00',
    engagement: { likes: 87200, retweets: 23100, replies: 12400, views: 4500000 },
    expectedDomain: 'Oil/Energy',
    expectedSignal: 'Primary Persona Signal'
  },
  {
    id: 'sample-002',
    text: 'NATO allies OWE us BILLIONS. They don\'t pay their fair share while our brave troops protect them. This will change FAST. Either pay up or we rethink the alliance! 🇺🇸',
    device: 'Web Client',
    timestamp: '2026-05-08T10:30:00-04:00',
    engagement: { likes: 65000, retweets: 18700, replies: 15200, views: 3800000 },
    expectedDomain: 'Global Conflict',
    expectedSignal: 'Staff/Campaign Signal'
  },
  {
    id: 'sample-003',
    text: 'MASSIVE TARIFFS coming on Chinese goods. 50% across the board! They have ripped us off for DECADES. The trade deficit is a DISASTER. Time to bring manufacturing HOME! 🏭',
    device: 'iPhone',
    timestamp: '2026-05-08T01:22:00-04:00',
    engagement: { likes: 112000, retweets: 45000, replies: 28900, views: 8200000 },
    expectedDomain: 'Economic Volatility',
    expectedSignal: 'Primary Persona Signal'
  },
  {
    id: 'sample-004',
    text: 'The CORRUPT DOJ and their WITCH HUNT will FAIL. The trial is a DISGRACE. The judge is TOTALLY BIASED! The American people see through this political PERSECUTION! ⚖️',
    device: 'iPhone',
    timestamp: '2026-05-07T22:45:00-04:00',
    engagement: { likes: 134000, retweets: 52000, replies: 41000, views: 9100000 },
    expectedDomain: 'Law/Justice',
    expectedSignal: 'Primary Persona Signal'
  },
  {
    id: 'sample-005',
    text: 'Just signed an INCREDIBLE new trade deal. The economy is BOOMING, stocks at ALL TIME HIGHS, and unemployment at RECORD LOWS. We are the envy of the WORLD! 📈🇺🇸',
    device: 'Web Client',
    timestamp: '2026-05-08T14:15:00-04:00',
    engagement: { likes: 95000, retweets: 31200, replies: 18300, views: 5600000 },
    expectedDomain: 'Economic Volatility',
    expectedSignal: 'Staff/Campaign Signal'
  },
  // New: High-Z-Score stress test — keyword repetition to trigger Z > 3.0
  {
    id: 'sample-006',
    text: 'TARIFFS TARIFFS TARIFFS! 200% tariffs on everything from China! Interest rates must come DOWN. The Fed is KILLING our economy with these insane rates! Total DISASTER!',
    device: 'iPhone',
    timestamp: '2026-05-09T02:45:00-04:00',
    engagement: { likes: 156000, retweets: 67000, replies: 45000, views: 12000000 },
    expectedDomain: 'Economic Volatility',
    expectedSignal: 'Primary Persona Signal',
    expectedZScoreUrgent: true
  },
  // New: Low-signal / no-volatility post
  {
    id: 'sample-007',
    text: 'Thank you to all the amazing supporters at the rally today. We had a wonderful time and the energy was incredible. See you all next week!',
    device: 'Web Client',
    timestamp: '2026-05-08T11:00:00-04:00',
    engagement: { likes: 42000, retweets: 8500, replies: 5200, views: 1800000 },
    expectedDomain: 'None',
    expectedSignal: 'Staff/Campaign Signal',
    expectedNoSignal: true
  }
];

export default SAMPLE_POSTS;
