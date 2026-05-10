/**
 * Twitter/X Scraper — Uses Puppeteer to load real Twitter pages and extract posts.
 * No API key required. Falls back gracefully if scraping fails.
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const SEEN_FILE = path.join(process.cwd(), 'output', '.seen.json');
const CORPUS_FILE = path.join(process.cwd(), 'output', '.corpus.json');

/**
 * Load the set of already-seen post IDs.
 */
function loadSeen() {
  try {
    if (fs.existsSync(SEEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(SEEN_FILE, 'utf-8'));
      return new Set(data);
    }
  } catch { /* ignore */ }
  return new Set();
}

/**
 * Save the set of seen post IDs.
 */
function saveSeen(seenSet) {
  const dir = path.dirname(SEEN_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const arr = [...seenSet].slice(-1000);
  fs.writeFileSync(SEEN_FILE, JSON.stringify(arr, null, 2));
}

/**
 * Append scraped posts to the growing corpus file (for TF-IDF baseline enrichment).
 */
function appendToCorpus(posts) {
  let corpus = [];
  try {
    if (fs.existsSync(CORPUS_FILE)) {
      corpus = JSON.parse(fs.readFileSync(CORPUS_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }

  for (const post of posts) {
    corpus.push(post.text);
  }

  // Keep last 500 entries
  if (corpus.length > 500) {
    corpus = corpus.slice(-500);
  }

  const dir = path.dirname(CORPUS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CORPUS_FILE, JSON.stringify(corpus, null, 2));
}

/**
 * Scrape latest posts from a Twitter/X user using Puppeteer.
 * Opens a headless browser, navigates to the user's profile, and extracts tweets.
 *
 * @param {string} username - Target username (without @)
 * @param {number} count - Max number of posts to fetch
 * @returns {object} { posts: [], error: null|string, message: string }
 */
export async function scrapeLatest(username, count = 10) {
  const seen = loadSeen();
  const cleanUsername = username.replace('@', '');
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1280,800',
      ]
    });

    const page = await browser.newPage();

    // Set a realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    );

    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate to user's Twitter/X profile
    const url = `https://x.com/${cleanUsername}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for tweet articles to load
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 15000 });

    // Scroll down a bit to load more tweets
    await page.evaluate(() => window.scrollBy(0, 1000));
    await new Promise(r => setTimeout(r, 2000));

    // Extract tweet data from the page
    const tweets = await page.evaluate((maxCount) => {
      const articles = document.querySelectorAll('article[data-testid="tweet"]');
      const results = [];

      for (const article of articles) {
        if (results.length >= maxCount) break;

        try {
          // Extract tweet text
          const textEl = article.querySelector('[data-testid="tweetText"]');
          const text = textEl ? textEl.innerText.trim() : '';
          if (!text) continue;

          // Extract timestamp
          const timeEl = article.querySelector('time');
          const timestamp = timeEl ? timeEl.getAttribute('datetime') : null;

          // Extract link (for unique ID)
          const linkEl = article.querySelector('a[href*="/status/"]');
          const link = linkEl ? linkEl.getAttribute('href') : '';
          const statusId = link ? link.split('/status/')[1]?.split('?')[0] : '';

          // Extract engagement metrics
          const getMetric = (testId) => {
            const el = article.querySelector(`[data-testid="${testId}"]`);
            if (!el) return 0;
            const text = el.getAttribute('aria-label') || el.innerText || '0';
            const match = text.match(/[\d,]+/);
            return match ? parseInt(match[0].replace(/,/g, '')) : 0;
          };

          const likes = getMetric('like');
          const retweets = getMetric('retweet');
          const replies = getMetric('reply');

          // Extract source/device (usually in the detail view, not timeline — default to 'unknown')
          const sourceEl = article.querySelector('a[href*="source"]');
          const device = sourceEl ? sourceEl.innerText : 'unknown';

          results.push({
            id: statusId || `tweet-${Date.now()}-${results.length}`,
            text,
            timestamp: timestamp || new Date().toISOString(),
            device,
            engagement: { likes, retweets, replies, views: 0 },
            link: link ? `https://x.com${link}` : ''
          });
        } catch {
          // Skip malformed tweets
          continue;
        }
      }

      return results;
    }, count);

    await browser.close();
    browser = null;

    // Filter out already-seen tweets
    const newPosts = [];
    for (const tweet of tweets) {
      if (seen.has(tweet.id)) continue;
      seen.add(tweet.id);

      newPosts.push({
        id: tweet.id,
        text: tweet.text,
        device: tweet.device || 'unknown',
        timestamp: tweet.timestamp,
        engagement: tweet.engagement,
        author: cleanUsername,
        link: tweet.link,
        isRetweet: false,
        isReply: false
      });
    }

    // Save state
    saveSeen(seen);
    if (newPosts.length > 0) {
      appendToCorpus(newPosts);
    }

    return {
      posts: newPosts,
      error: null,
      message: newPosts.length > 0
        ? `Scraped ${newPosts.length} new post(s) from @${cleanUsername}`
        : `No new posts from @${cleanUsername} (${tweets.length} total seen)`
    };

  } catch (err) {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }

    return {
      posts: [],
      error: err.message,
      message: `Scraping failed for @${cleanUsername}: ${err.message}`
    };
  }
}

/**
 * Get scraper info.
 */
export function getInfo() {
  return {
    name: 'twitter',
    description: 'Twitter/X scraper using Puppeteer (headless browser, no API key)',
    requiresAuth: false
  };
}

export default { scrapeLatest, getInfo };
