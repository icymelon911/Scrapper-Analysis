/**
 * Manual Scraper — Constructs standardized post objects from CLI input.
 */

/**
 * Create a post object from manual CLI input.
 * @param {object} options - CLI flags { text, device, time, engagement }
 * @returns {object} Standardized post object
 */
export function createPost(options) {
  const engagement = {};
  if (options.engagement) {
    // Parse "likes:1000,retweets:500,replies:200"
    const parts = options.engagement.split(',');
    for (const part of parts) {
      const [key, value] = part.split(':').map(s => s.trim());
      if (key && value) {
        engagement[key] = parseInt(value) || 0;
      }
    }
  }

  return {
    id: `manual-${Date.now()}`,
    text: options.text || '',
    device: options.device || 'unknown',
    timestamp: options.time || new Date().toISOString(),
    engagement,
    author: 'manual',
    isRetweet: false,
    isReply: false
  };
}

export function getInfo() {
  return {
    name: 'manual',
    description: 'Manual input via CLI flags',
    requiresAuth: false
  };
}

export default { createPost, getInfo };
