/**
 * Scraper Registry — Pluggable interface for different scraper backends.
 */

import * as twitter from './twitter.js';
import * as truthsocial from './truthsocial.js';
import * as manual from './manual.js';

const scrapers = {
  twitter,
  truthsocial,
  manual
};

/**
 * Get a scraper by name.
 * @param {string} type - Scraper type ('twitter', 'truthsocial', 'manual')
 * @returns {object} Scraper module
 */
export function getScraper(type) {
  const scraper = scrapers[type];
  if (!scraper) {
    throw new Error(`Unknown scraper type: ${type}. Available: ${Object.keys(scrapers).join(', ')}`);
  }
  return scraper;
}

/**
 * List available scrapers.
 */
export function listScrapers() {
  return Object.entries(scrapers).map(([name, mod]) => ({
    name,
    ...mod.getInfo()
  }));
}

export default { getScraper, listScrapers };
