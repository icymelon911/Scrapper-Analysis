import asyncio
import logging
from datetime import datetime
from pathlib import Path

import yaml

from scheduler import start_scheduler
from scraper import scrape_all_accounts, setup_logging, load_existing_posts
from mongodb import get_db_manager
from historical_engine import refresh_historical_summary

CONFIG_FILE = Path("config.yaml")
OUTPUT_FILE = Path("output/posts.json")


def load_config() -> dict:
    if not CONFIG_FILE.exists():
        raise FileNotFoundError("config.yaml is required")

    config_data = yaml.safe_load(CONFIG_FILE.read_text(encoding="utf-8")) or {}
    scraper_config = config_data.get("scraper", {})

    return {
        "accounts": config_data.get("accounts", []),
        "interval_minutes": int(scraper_config.get("interval_minutes", 5)),
        "latest_posts_limit": int(scraper_config.get("latest_posts_limit", 10)),
        "debug": bool(scraper_config.get("debug", False)),
    }


async def is_posts_empty() -> bool:
    existing = await load_existing_posts()
    return len(existing) == 0


async def sync_json_posts_to_mongo(logger: logging.Logger) -> int:
    existing_posts = await load_existing_posts(logger)
    if not existing_posts:
        return 0

    db_manager = get_db_manager()
    if not db_manager.connected:
        db_manager.connect()

    mongo_saved = 0
    for post in existing_posts:
        post_doc = dict(post)
        try:
            post_doc["scraped_at_dt"] = datetime.fromisoformat(post["scraped_at"])
        except Exception:
            pass
        if db_manager.save_post(post_doc):
            mongo_saved += 1

    if mongo_saved > 0:
        logger.info("Synced %d existing posts from JSON to MongoDB", mongo_saved)
    return mongo_saved


async def main() -> None:
    logger = setup_logging()
    config = load_config()

    # Connect to MongoDB
    db_manager = get_db_manager()
    if db_manager.connect():
        logger.info("Connected to MongoDB")
        await sync_json_posts_to_mongo(logger)
    else:
        logger.warning("MongoDB not available, will use JSON fallback")

    accounts = config["accounts"]
    interval = config["interval_minutes"]
    latest_posts_limit = config["latest_posts_limit"]
    debug = config["debug"]

    print(f"Loaded {len(accounts)} accounts\n")
    logger.info("Loaded %d accounts", len(accounts))

    if not accounts:
        logger.warning("No accounts configured in config.yaml")
        print("No accounts configured in config.yaml")
        return

    # Bootstrap: if posts.json is empty, do an immediate scrape with limit=10
    if await is_posts_empty():
        logger.info("posts.json is empty, bootstrapping with initial scrape (limit=10)")
        print("Bootstrapping initial data collection (scraping up to 10 posts)...\n")
        await scrape_all_accounts(accounts, 10, debug, logger)
        refresh_historical_summary(logger)
        print()

    async def job() -> None:
        logger.info("Scheduler scraping run started")
        try:
            await scrape_all_accounts(accounts, latest_posts_limit, debug, logger)
            refresh_historical_summary(logger)
        except Exception as exc:
            logger.exception("Scheduler job failed: %s", exc)

    scheduler = start_scheduler(job, interval)
    print(f"Scheduler started with interval {interval} minutes")
    print(f"Scheduler sleeping for {interval} minutes...\n")
    logger.info("Scheduler started with interval %s minutes", interval)

    run_event = asyncio.Event()
    try:
        await run_event.wait()
    except asyncio.CancelledError:
        logger.info("Shutdown requested, stopping scheduler")
    finally:
        try:
            scheduler.shutdown(wait=False)
            logger.info("Scheduler shut down")
        except Exception as exc:
            logger.warning("Error shutting down scheduler: %s", exc)
        db_manager.disconnect()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Shutdown requested, exiting cleanly.")

