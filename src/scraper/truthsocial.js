/**
 * Truth Social Scraper — Uses Puppeteer to load Truth Social profile pages
 * and extract "Truths" (posts) from the rendered DOM.
 * 
 * Truth Social is Mastodon-based. Key selectors:
 *   - Post container: div[id^="status-"]
 *   - Post text: .status__content
 *   - Timestamp: time[datetime]
 *   - Reply count: button[aria-label="Reply"] span
 *   - ReTruth count: button[aria-label="ReTruth"] span
 *   - Like count: button[aria-label="Like"] span
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const SEEN_FILE = path.join(process.cwd(), 'output', '.seen_truthsocial.json');
const CORPUS_FILE = path.join(process.cwd(), 'output', '.corpus.json');

function loadSeen() {
  try {
    if (fs.existsSync(SEEN_FILE)) {
      return new Set(JSON.parse(fs.readFileSync(SEEN_FILE, 'utf-8')));
    }
  } catch { /* ignore */ }
  return new Set();
}

function saveSeen(posts) {
  const dir = path.dirname(SEEN_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  // Map posts to their text wording and save it like corpus.json
  const wordings = posts.map(p => p.text).filter(Boolean);
  fs.writeFileSync(SEEN_FILE, JSON.stringify(wordings, null, 2));
}

function appendToCorpus(posts) {
  let corpus = [];
  try {
    if (fs.existsSync(CORPUS_FILE)) {
      corpus = JSON.parse(fs.readFileSync(CORPUS_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  for (const post of posts) corpus.push(post.text);
  if (corpus.length > 500) corpus = corpus.slice(-500);
  const dir = path.dirname(CORPUS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CORPUS_FILE, JSON.stringify(corpus, null, 2));
}

/**
 * Parse engagement count strings like "1.63k", "752", "12.4k" into numbers.
 */
function parseCount(str) {
  if (!str) return 0;
  str = str.trim().toLowerCase();
  if (str.endsWith('k')) return Math.round(parseFloat(str) * 1000);
  if (str.endsWith('m')) return Math.round(parseFloat(str) * 1000000);
  return parseInt(str.replace(/,/g, '')) || 0;
}

/**
 * Scrape latest Truths from a Truth Social user profile.
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
        '--window-size=1280,900',
      ]
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 900 });

    // Navigate to user profile
    const url = `https://truthsocial.com/@${cleanUsername}`;
    console.log(`  DEBUG: Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });

    // Initial wait for any JS to kick in
    await new Promise(r => setTimeout(r, 5000));

    // Improved Modal/Overlay Clearing
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('*'));
      
      // 1. Try to find and click "ACCEPT ALL" or "Agree" for cookies
      const cookieBtn = els.find(e => 
        e.innerText === 'ACCEPT ALL' || 
        (e.innerText && e.innerText.trim().toLowerCase() === 'accept all cookies')
      );
      if (cookieBtn) cookieBtn.click();

      // 2. Try to find and click any "Close" or "X" buttons (like ads)
      const closeBtns = els.filter(e => e.innerText === '×');
      for (const btn of closeBtns) btn.click();

      // 3. Remove any fixed overlays that might be blocking interaction
      const overlays = document.querySelectorAll('[class*="modal"], [class*="overlay"], [id*="cookie"]');
      overlays.forEach(el => {
         try { el.remove(); } catch(e) {}
      });
    });

    await new Promise(r => setTimeout(r, 2000));

    // Try to click "Show More" on any truncated posts to get full text
    try {
      await page.evaluate(() => {
        const showMore = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Show More'));
        if (showMore) showMore.click();
      });
      await new Promise(r => setTimeout(r, 1000));
    } catch { /* ignore */ }

    // Scroll multiple times to ensure posts are loaded and rendered
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 1000));
      await new Promise(r => setTimeout(r, 1500));
    }

    // Wait for post containers with a fallback
    try {
      await page.waitForSelector('a[href*="/posts/"]', { timeout: 15000 });
    } catch (err) {
      console.log(`  DEBUG: Selector wait failed, attempting to scrape anyway. Error: ${err.message}`);
    }

    // Extract truths from the DOM
    const truths = await page.evaluate((maxCount) => {
      const results = [];
      const seenIds = new Set();
      
      // Look for the exact status containers used by Truth Social React app
      const statuses = Array.from(document.querySelectorAll('[data-testid="status"]'));
      
      for (const status of statuses) {
        if (results.length >= maxCount) break;

        try {
          const contentEl = status.querySelector('[data-testid="status-content"]');
          const text = contentEl ? contentEl.innerText.trim() : '';
          if (!text) continue;
          
          const linkEl = status.querySelector('a[href*="/posts/"]');
          if (!linkEl) continue;
          
          const href = linkEl.getAttribute('href');
          const statusId = href.split('/').pop();
          
          if (!statusId || isNaN(statusId)) continue;
          if (seenIds.has(statusId)) continue;

          // Get timestamp
          const timeEl = status.querySelector('time');
          const timestamp = (timeEl && timeEl.getAttribute('datetime')) ? timeEl.getAttribute('datetime') : new Date().toISOString();

          // Get engagement metrics from the action bar
          let replies = '0', retruths = '0', likes = '0';
          const actionBar = status.querySelector('[data-testid="status-action-bar"]');
          if (actionBar) {
            // Usually 4 metrics: Replies, ReTruths, Likes, Bookmark/Share
            // They are often in spans or paragraphs inside the action bar buttons
            const spans = Array.from(actionBar.querySelectorAll('span, p, div'))
              .filter(el => el.children.length === 0 && el.innerText.trim().match(/^[0-9]+(\.[0-9]+)?[km]?$/i));
              
            if (spans.length >= 3) {
              replies = spans[0].innerText.trim();
              retruths = spans[1].innerText.trim();
              likes = spans[2].innerText.trim();
            } else if (spans.length > 0) {
               likes = spans[spans.length - 1].innerText.trim();
            }
          }

          seenIds.add(statusId);
          results.push({
            id: statusId,
            text,
            timestamp,
            replies,
            retruths,
            likes,
            link: `https://truthsocial.com${href}`
          });
        } catch (e) {
          continue;
        }
      }

      return results;
    }, count);

    await browser.close();
    browser = null;

    // DEBUG LOG
    if (truths.length === 0) {
      console.log(`  DEBUG: Scraper found 0 elements matching status selector for @${cleanUsername}`);
    } else {
      console.log(`  DEBUG: Scraper found ${truths.length} total posts on page for @${cleanUsername}`);
    }

    // Filter out already-seen posts and build standardized post objects
    const newPosts = [];
    for (const truth of truths) {
      if (seen.has(truth.id)) continue;
      seen.add(truth.id);

      newPosts.push({
        id: truth.id,
        text: truth.text,
        device: 'Truth Social',
        timestamp: truth.timestamp,
        engagement: {
          likes: parseCount(truth.likes),
          retweets: parseCount(truth.retruths),
          replies: parseCount(truth.replies),
          views: 0
        },
        author: cleanUsername,
        link: truth.link,
        platform: 'truthsocial',
        isPinned: truth.isPinned,
        isRetweet: false,
        isReply: false
      });
    }

    // Save state - save the actual post text wording to the seen file
    saveSeen(newPosts);
    
    if (newPosts.length > 0) {
      console.log(`  DEBUG: Scraped ${newPosts.length} posts (history ignored).`);
      appendToCorpus(newPosts);
    }

    return {
      posts: newPosts,
      error: null,
      message: newPosts.length > 0
        ? `Scraped ${newPosts.length} new Truth(s) from @${cleanUsername}`
        : `No new Truths from @${cleanUsername} (${truths.length} total seen)`
    };

  } catch (err) {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
    return {
      posts: [],
      error: err.message,
      message: `Truth Social scraping failed for @${cleanUsername}: ${err.message}`
    };
  }
}

export function getInfo() {
  return {
    name: 'truthsocial',
    description: 'Truth Social scraper using Puppeteer (headless browser)',
    requiresAuth: false
  };
}

export default { scrapeLatest, getInfo };
