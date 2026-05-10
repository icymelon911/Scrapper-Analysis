#!/usr/bin/env node

/**
 * VantagePoint CLI — Forensic Social Media Intelligence Bot
 * 
 * Usage:
 *   node src/cli.js                     — Start auto-scraping monitor (default)
 *   node src/cli.js analyze -t "..."    — One-shot analysis of a post
 *   node src/cli.js monitor             — Auto-scrape with custom options
 *   node src/cli.js history             — View past analysis reports
 *   node src/cli.js demo                — Run analysis on sample posts
 */

import { Command } from 'commander';
import cron from 'node-cron';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

import { analyzePost, analyzePosts } from './engine/pipeline.js';
import { getScraper } from './scraper/index.js';
import { createPost } from './scraper/manual.js';
import { outputReport, outputReports, consoleRenderer, jsonWriter } from './output/index.js';
import { SAMPLE_POSTS } from './data/samplePosts.js';

dotenv.config();

const program = new Command();

program
  .name('vantagepoint')
  .description('🔍 Forensic Social Media Intelligence Bot — Project VantagePoint')
  .version('1.0.0');

// ═══════════════════════════════════════════════════════════════════
// MONITOR — The core auto-scraping loop
// ═══════════════════════════════════════════════════════════════════

async function startMonitor(options) {
  consoleRenderer.renderBanner();

  const target = (options.target || process.env.SCRAPE_TARGET || 'realDonaldTrump').replace('@', '');
  const platform = options.platform || process.env.SCRAPE_PLATFORM || 'truthsocial';
  const interval = parseInt(options.interval || process.env.POLL_INTERVAL_MINUTES || '5');
  const count = parseInt(options.count || '10');

  // CLEAR HISTORY ON STARTUP
  const outDir = path.join(process.cwd(), 'output');
  try {
    fs.rmSync(path.join(outDir, 'reports'), { recursive: true, force: true });
    fs.rmSync(path.join(outDir, 'index.json'), { force: true });
    fs.rmSync(path.join(outDir, '.seen_truthsocial.json'), { force: true });
    consoleRenderer.renderStatus('Cleared previous session history and reports.', 'info');
  } catch(e) {}

  consoleRenderer.renderStatus(`Target: @${target}`, 'info');
  consoleRenderer.renderStatus(`Platform: ${platform}`, 'info');
  consoleRenderer.renderStatus(`Interval: Every ${interval} minute(s)`, 'info');
  consoleRenderer.renderStatus(`Fetch count: ${count} posts/poll`, 'info');
  consoleRenderer.renderStatus(`Output: ./output/reports/`, 'info');
  console.log('');

  const activeScraper = getScraper(platform);

  let pollCount = 0;

  async function pollAndAnalyze() {
    pollCount++;
    const now = new Date().toLocaleTimeString();
    consoleRenderer.renderStatus(`[Poll #${pollCount} @ ${now}] Scraping @${target}...`, 'info');

    try {
      const result = await activeScraper.scrapeLatest(target, count);

      if (result.error) {
        consoleRenderer.renderStatus(`Scraper: ${result.message}`, 'warn');
      }

      if (result.posts.length === 0) {
        consoleRenderer.renderStatus('No new posts detected. Waiting for next poll...', 'info');
        return;
      }

      consoleRenderer.renderStatus(`Found ${result.posts.length} new post(s). Running analysis pipeline...`, 'success');
      console.log('');

      const reports = await analyzePosts(result.posts);
      outputReports(reports);

      consoleRenderer.renderStatus(`✅ ${reports.length} intelligence report(s) generated and saved.`, 'success');
    } catch (err) {
      consoleRenderer.renderStatus(`Poll error: ${err.message}`, 'error');
    }

    console.log('');
  }

  // Run immediately on start
  await pollAndAnalyze();

  if (options.once) {
    consoleRenderer.renderStatus('Single run complete. Exiting.', 'info');
    process.exit(0);
  }

  // Schedule recurring polls
  const cronExpr = `*/${interval} * * * *`;
  consoleRenderer.renderStatus(`⏰ Scheduler active (${cronExpr}). Bot is running.`, 'info');
  consoleRenderer.renderStatus('Press Ctrl+C to stop the bot.', 'info');
  console.log('');

  let isRunning = false;
  cron.schedule(cronExpr, async () => {
    if (isRunning) {
      consoleRenderer.renderStatus('Previous poll still running, skipping...', 'warn');
      return;
    }
    isRunning = true;
    try {
      await pollAndAnalyze();
    } finally {
      isRunning = false;
    }
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('');
    consoleRenderer.renderStatus('Shutting down VantagePoint bot...', 'info');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    consoleRenderer.renderStatus('Received SIGTERM. Shutting down...', 'info');
    process.exit(0);
  });
}

// ═══════════════════════════════════════════════════════════════════
// CLI COMMANDS
// ═══════════════════════════════════════════════════════════════════

// ─── ANALYZE ────────────────────────────────────────────────────────
program
  .command('analyze')
  .description('One-shot analysis of a single post')
  .requiredOption('-t, --text <text>', 'Post text content to analyze')
  .option('-d, --device <device>', 'Device type (e.g., iPhone, "Web Client")', 'unknown')
  .option('--time <timestamp>', 'Post timestamp (ISO 8601)', new Date().toISOString())
  .option('-e, --engagement <metrics>', 'Engagement metrics (format: likes:1000,retweets:500)')
  .option('--no-json', 'Skip saving JSON file')
  .action(async (options) => {
    consoleRenderer.renderBanner();
    consoleRenderer.renderStatus('Analyzing post...', 'info');

    try {
      const post = createPost({
        text: options.text,
        device: options.device,
        time: options.time,
        engagement: options.engagement
      });

      const report = await analyzePost(post);
      outputReport(report, { json: options.json !== false, console: true });

      if (options.json !== false) {
        consoleRenderer.renderStatus(`Report saved to output/reports/${report.id}.json`, 'success');
      }
    } catch (err) {
      consoleRenderer.renderStatus(`Analysis failed: ${err.message}`, 'error');
      process.exit(1);
    }
  });

// ─── MONITOR ────────────────────────────────────────────────────────
program
  .command('monitor')
  .description('Start auto-scraping monitor with custom options')
  .option('-u, --target <username>', 'Twitter/X or Truth Social username to monitor', process.env.SCRAPE_TARGET || 'realDonaldTrump')
  .option('-p, --platform <platform>', 'Platform to scrape (twitter, truthsocial)', process.env.SCRAPE_PLATFORM || 'truthsocial')
  .option('-i, --interval <minutes>', 'Polling interval in minutes', process.env.POLL_INTERVAL_MINUTES || '5')
  .option('-c, --count <number>', 'Number of posts to fetch per poll', '10')
  .option('--once', 'Run once and exit (no cron loop)')
  .action(async (options) => {
    await startMonitor(options);
  });

// ─── HISTORY ────────────────────────────────────────────────────────
program
  .command('history')
  .description('View past analysis reports')
  .option('-n, --last <count>', 'Number of recent reports to show', '10')
  .option('--id <reportId>', 'Show a specific report by ID')
  .action((options) => {
    consoleRenderer.renderBanner();

    if (options.id) {
      const report = jsonWriter.loadReport(options.id);
      if (report) {
        consoleRenderer.renderReport(report);
      } else {
        consoleRenderer.renderStatus(`Report ${options.id} not found.`, 'error');
      }
      return;
    }

    const entries = jsonWriter.loadIndex(parseInt(options.last) || 10);
    consoleRenderer.renderHistoryTable(entries);
  });

// ─── DEMO ───────────────────────────────────────────────────────────
program
  .command('demo')
  .description('Run analysis on all sample posts for demonstration')
  .option('--sample <number>', 'Run only a specific sample (1-5)')
  .action(async (options) => {
    consoleRenderer.renderBanner();
    consoleRenderer.renderStatus('Running demo analysis on sample posts...', 'info');
    console.log('');

    let posts = SAMPLE_POSTS;

    if (options.sample) {
      const idx = parseInt(options.sample) - 1;
      if (idx >= 0 && idx < SAMPLE_POSTS.length) {
        posts = [SAMPLE_POSTS[idx]];
      } else {
        consoleRenderer.renderStatus(`Invalid sample number. Use 1-${SAMPLE_POSTS.length}.`, 'error');
        process.exit(1);
      }
    }

    try {
      const reports = await analyzePosts(posts);
      outputReports(reports);
      consoleRenderer.renderStatus(`Demo complete: ${reports.length} report(s) generated.`, 'success');
    } catch (err) {
      consoleRenderer.renderStatus(`Demo failed: ${err.message}`, 'error');
      process.exit(1);
    }
  });

// ═══════════════════════════════════════════════════════════════════
// DEFAULT: If no command given, auto-start the monitor
// ═══════════════════════════════════════════════════════════════════

// Check if a known subcommand was provided
const knownCommands = ['analyze', 'monitor', 'history', 'demo', 'help'];
const args = process.argv.slice(2);
const hasCommand = args.length > 0 && knownCommands.includes(args[0]);

if (!hasCommand && args.length === 0) {
  // No arguments at all → auto-start monitor with defaults
  console.log('');
  startMonitor({
    target: process.env.SCRAPE_TARGET || 'realDonaldTrump',
    platform: process.env.SCRAPE_PLATFORM || 'truthsocial',
    interval: process.env.POLL_INTERVAL_MINUTES || '5',
    count: '10',
    once: false
  });
} else {
  // Parse normally for subcommands
  program.parse();
}
