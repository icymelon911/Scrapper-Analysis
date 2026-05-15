import hashlib
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

from playwright.async_api import async_playwright

from categorizer import analyze_sentiment, calculate_market_impact, categorize_text, extract_entities, map_market
from mongodb import get_db_manager
from historical_engine import add_post_historical_analysis
from utils.time_utils import get_local_timestamp



def setup_logging() -> logging.Logger:
    log_dir = Path("logs")
    log_dir.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger("truthsocial_scraper")
    logger.setLevel(logging.INFO)
    if logger.hasHandlers():
        logger.handlers.clear()

    formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s")

    file_handler = logging.FileHandler(log_dir / "scraper.log", encoding="utf-8")
    file_handler.setFormatter(formatter)

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    logger.propagate = False

    return logger


OUTPUT_DIR = Path("output")
OUTPUT_FILE = OUTPUT_DIR / "posts.json"
DEBUG_FILE = Path("debug.html")
SELECTORS = [
    "article",
    "div[data-testid='status']",
    "div[role='article']",
    "div.status",
]


def ensure_output_path() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    if not OUTPUT_FILE.exists():
        OUTPUT_FILE.write_text("[]", encoding="utf-8")


def clean_text(raw_text: str) -> str:
    return " ".join(raw_text.split()).strip()


def generate_post_id(account: str, raw_id: str | None, content: str) -> str:
    if raw_id:
        return f"{account}_{raw_id}"

    digest = hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]
    return f"{account}_hash_{digest}"


def normalize_post(post: dict[str, Any]) -> dict[str, Any]:
    return {
        "post_id": str(post.get("post_id", "")).strip(),
        "account": str(post.get("account", "")).strip(),
        "content": str(post.get("content", "")).strip(),
        "post_url": str(post.get("post_url", "")).strip(),
        "scraped_at": str(post.get("scraped_at", "")).strip(),
        "themes": [str(item) for item in post.get("themes") or []],
        "sentiment": {
            "market": str(post.get("sentiment", {}).get("market", "neutral")),
            "tone": str(post.get("sentiment", {}).get("tone", "informational")),
            "risk_level": str(post.get("sentiment", {}).get("risk_level", "low")),
            "confidence": float(post.get("sentiment", {}).get("confidence", 0.0) or 0.0),
        },
        "entities": {
            "companies": [str(item) for item in post.get("entities", {}).get("companies", [])],
            "countries": [str(item) for item in post.get("entities", {}).get("countries", [])],
            "commodities": [str(item) for item in post.get("entities", {}).get("commodities", [])],
            "crypto": [str(item) for item in post.get("entities", {}).get("crypto", [])],
            "organizations": [str(item) for item in post.get("entities", {}).get("organizations", [])],
        },
        "market_mapping": {
            "tickers": [str(item) for item in post.get("market_mapping", {}).get("tickers", [])],
            "commodities": [str(item) for item in post.get("market_mapping", {}).get("commodities", [])],
            "crypto_pairs": [str(item) for item in post.get("market_mapping", {}).get("crypto_pairs", [])],
            "etfs": [str(item) for item in post.get("market_mapping", {}).get("etfs", [])],
            "sectors": [str(item) for item in post.get("market_mapping", {}).get("sectors", [])],
        },
        "market_impact": {
            "score": int(post.get("market_impact", {}).get("score", 0)),
            "level": str(post.get("market_impact", {}).get("level", "low")),
            "drivers": [str(item) for item in post.get("market_impact", {}).get("drivers", [])],
        },
        "historical_analysis": {
            "narratives": [],
            "trend_signals": [],
            "frequency_flags": [],
        },
    }


def validate_post(post: dict[str, Any], logger: logging.Logger) -> bool:
    if not post["post_id"]:
        logger.warning("Invalid post skipped: missing post_id")
        return False
    if not post["account"]:
        logger.warning("Invalid post skipped: missing account for post_id %s", post.get("post_id"))
        return False
    if not post["content"]:
        logger.warning("Invalid post skipped: missing content for post_id %s", post.get("post_id"))
        return False
    if not post["post_url"]:
        logger.warning("Invalid post skipped: missing post_url for post_id %s", post.get("post_id"))
        return False
    if not post["scraped_at"]:
        logger.warning("Invalid post skipped: missing scraped_at for post_id %s", post.get("post_id"))
        return False
    if not isinstance(post["themes"], list):
        logger.warning("Invalid post skipped: themes must be a list for post_id %s", post.get("post_id"))
        return False
    if not isinstance(post["sentiment"], dict):
        logger.warning("Invalid post skipped: sentiment must be a dict for post_id %s", post.get("post_id"))
        return False
    if not isinstance(post["entities"], dict):
        logger.warning("Invalid post skipped: entities must be a dict for post_id %s", post.get("post_id"))
        return False
    if not isinstance(post["market_mapping"], dict):
        logger.warning("Invalid post skipped: market_mapping must be a dict for post_id %s", post.get("post_id"))
        return False
    if not isinstance(post["market_impact"], dict):
        logger.warning("Invalid post skipped: market_impact must be a dict for post_id %s", post.get("post_id"))
        return False
    return True


def dedupe_posts(posts: list[dict[str, Any]], logger: logging.Logger | None = None) -> list[dict[str, Any]]:
    seen = set()
    unique_posts = []
    for post in posts:
        post_id = str(post.get("post_id", "")).strip()
        if not post_id or post_id in seen:
            continue
        seen.add(post_id)
        unique_posts.append(post)

    if logger and len(unique_posts) != len(posts):
        logger.info("Removed %d duplicate existing posts", len(posts) - len(unique_posts))
    return unique_posts


async def load_existing_posts(logger: logging.Logger | None = None) -> list[dict[str, Any]]:
    if not OUTPUT_FILE.exists():
        return []

    try:
        raw_posts = json.loads(OUTPUT_FILE.read_text(encoding="utf-8"))
        if not isinstance(raw_posts, list):
            raise ValueError("Expected JSON array")
        return dedupe_posts(raw_posts, logger)
    except Exception as exc:
        if logger:
            logger.error("Failed to read existing posts.json: %s", exc)
            logger.info("Starting with a fresh posts list")
        return []


def safe_write_json_file(path: Path, data: list[dict[str, Any]]) -> None:
    temp_path = path.with_suffix(path.suffix + ".tmp")
    with open(temp_path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
    temp_path.replace(path)


def build_post_url(account: str, raw_id: str | None) -> str:
    if raw_id:
        clean_id = raw_id.replace("status-", "").strip()
        return f"https://truthsocial.com/@{account}/status/{clean_id}"
    return f"https://truthsocial.com/@{account}"


async def extract_post_data(element, account: str, selector_name: str, index: int, logger: logging.Logger) -> dict[str, Any] | None:
    raw_text = await element.inner_text()
    content = clean_text(raw_text)
    if len(content) < 30:
        return None

    raw_id = await element.get_attribute("id") or await element.get_attribute("data-testid")
    post_id = generate_post_id(account, raw_id, content)

    entities = extract_entities(content)
    themes = categorize_text(content)
    post = {
        "post_id": post_id,
        "account": account,
        "content": content,
        "post_url": build_post_url(account, raw_id),
        "scraped_at": get_local_timestamp(),
        "themes": themes,
        "sentiment": analyze_sentiment(content),
        "entities": entities,
        "market_mapping": map_market(entities),
        "market_impact": calculate_market_impact(content, entities, themes),
    }

    normalized = normalize_post(post)
    return normalized if validate_post(normalized, logger) else None


async def find_posts(page):
    for selector in SELECTORS:
        elements = await page.query_selector_all(selector)
        if elements:
            return selector, elements
    return None, []


async def save_posts(posts: list[dict[str, Any]], logger: logging.Logger) -> int:
    ensure_output_path()
    existing_posts = await load_existing_posts(logger)
    existing_ids = {post.get("post_id") for post in existing_posts if post.get("post_id")}

    new_posts = []
    for post in posts:
        if not validate_post(post, logger):
            continue
        if post["post_id"] in existing_ids:
            logger.info("Skipping duplicate post_id %s", post["post_id"])
            continue
        new_posts.append(post)

    if not new_posts:
        logger.info("No new posts")
        return 0

    enriched_posts = [add_post_historical_analysis(post) for post in new_posts]

    db_manager = get_db_manager()
    if not db_manager.connected:
        db_manager.connect()

    mongo_saved = 0
    for post in enriched_posts:
        mongo_post = dict(post)
        try:
            mongo_post["scraped_at_dt"] = datetime.fromisoformat(post["scraped_at"])
        except Exception:
            pass

        if db_manager.save_post(mongo_post):
            mongo_saved += 1

    if mongo_saved > 0:
        logger.info("Saved %d posts to MongoDB", mongo_saved)
    else:
        logger.warning("No posts were inserted into MongoDB; falling back to JSON")

    updated_posts = existing_posts + enriched_posts
    safe_write_json_file(OUTPUT_FILE, updated_posts)
    return len(enriched_posts)


async def scrape_account(page, account: str, latest_posts_limit: int, debug: bool, logger: logging.Logger) -> list[dict[str, Any]]:
    try:
        url = f"https://truthsocial.com/@{account}"
        await page.goto(url, wait_until="networkidle")
        await page.wait_for_timeout(8000)

        await page.evaluate("window.scrollBy(0, window.innerHeight * 0.7)")
        await page.wait_for_timeout(4000)

        html_content = await page.content()
        DEBUG_FILE.write_text(html_content, encoding="utf-8")

        title = await page.title()
        current_url = page.url
        print(f"Page title: {title}")
        print(f"Current URL: {current_url}\n")
        logger.info("Loaded page for %s", account)

        selector, elements = await find_posts(page)
        if not elements:
            print("No posts found with fallback selectors.")
            logger.warning("No posts found for %s", account)
            return []

        print(f"Selector '{selector}' found {len(elements)} elements")
        logger.info("Selector %s found %d elements for %s", selector, len(elements), account)

        posts = []
        for index, element in enumerate(elements):
            if len(posts) >= latest_posts_limit:
                break

            extracted = await extract_post_data(element, account, selector or "unknown", index, logger)
            if extracted:
                posts.append(extracted)

        print(f"TOTAL POSTS EXTRACTED: {len(posts)}\n")
        return posts
    except Exception as exc:
        logger.exception("Error scraping account %s", account)
        print(f"Error scraping account {account}; check logs for details.\n")
        return []


async def scrape_all_accounts(accounts: list[str], latest_posts_limit: int, debug: bool, logger: logging.Logger) -> None:
    ensure_output_path()

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=False, slow_mo=500)
        page = await browser.new_page()

        for account in accounts:
            logger.info("Scraping account %s", account)
            print(f"Scraping: {account}")

            posts = await scrape_account(page, account, latest_posts_limit, debug, logger)
            if not posts:
                print("No new posts\n")
                continue

            saved_count = await save_posts(posts, logger)
            if saved_count:
                print(f"Saved {saved_count} new posts\n")
            else:
                print("No new posts\n")

        if debug:
            logger.info("Pausing page for manual inspection")
            print("Debug pause enabled; inspect browser and resume to continue.")
            await page.pause()

        await browser.close()
