import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

from categorizer import THEMES
from mongodb import get_db_manager
from utils.time_utils import get_local_timestamp, parse_iso_timestamp

OUTPUT_DIR = Path("output")
POSTS_FILE = OUTPUT_DIR / "posts.json"
SUMMARY_FILE = OUTPUT_DIR / "historical_summary.json"

NARRATIVE_PATTERNS = [
    (
        "Increasing anti-China trade rhetoric",
        [r"china", r"trade war", r"tariff", r"sanction", r"import tax", r"beijing", r"xi"],
    ),
    (
        "Growing energy independence narrative",
        [r"energy independence", r"energy security", r"energy nationalism", r"domestic energy"],
    ),
    (
        "Tariffs escalation narrative",
        [r"tariff", r"trade war", r"import tax", r"customs duty"],
    ),
    (
        "Election and leadership narrative",
        [r"election", r"vote", r"president", r"campaign", r"ballot"],
    ),
    (
        "Crypto market speculation narrative",
        [r"bitcoin", r"crypto", r"ethereum", r"btc", r"eth", r"dogecoin"],
    ),
    (
        "Geopolitical tension narrative",
        [r"war", r"attack", r"nuclear", r"sanction", r"conflict", r"security"],
    ),
]

THEME_LABELS = list(THEMES.keys())


def ensure_output_path() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def safe_write_json_file(path: Path, data: Any) -> None:
    temp_path = path.with_suffix(path.suffix + ".tmp")
    with open(temp_path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
    temp_path.replace(path)


def _load_json_posts() -> List[Dict[str, Any]]:
    ensure_output_path()
    if not POSTS_FILE.exists():
        return []

    try:
        raw_posts = json.loads(POSTS_FILE.read_text(encoding="utf-8"))
        if not isinstance(raw_posts, list):
            return []
        return raw_posts
    except Exception:
        return []


def _parse_post_time(post: Dict[str, Any]) -> Optional[datetime]:
    try:
        return parse_iso_timestamp(str(post.get("scraped_at", "")))
    except Exception:
        return None


def _count_posts_in_range(posts: List[Dict[str, Any]], start: datetime, end: datetime) -> int:
    return sum(1 for post in posts if (dt := _parse_post_time(post)) is not None and start <= dt < end)


def _get_posts_from_mongo(query: Dict[str, Any], limit: int = 100) -> List[Dict[str, Any]]:
    db_manager = get_db_manager()
    if not db_manager.connected and not db_manager.connect():
        return []

    try:
        return list(db_manager.posts.find(query, {"_id": 0}).sort("scraped_at_dt", -1).limit(limit))
    except Exception:
        return []


def _get_recent_posts(limit: int = 100) -> List[Dict[str, Any]]:
    db_manager = get_db_manager()
    if db_manager.connected or db_manager.connect():
        posts = db_manager.get_posts(limit)
        if posts:
            return posts
    return list(sorted(_load_json_posts(), key=lambda p: _parse_post_time(p) or datetime.min, reverse=True))[:limit]


def get_posts_by_theme(theme: str, limit: int = 100) -> List[Dict[str, Any]]:
    db_manager = get_db_manager()
    if db_manager.connected or db_manager.connect():
        return _get_recent_posts(limit) if theme.lower() == "all" else db_manager.get_posts_by_theme(theme, limit)

    posts = _load_json_posts()
    return [post for post in posts if theme in post.get("themes", [])][:limit]


def get_posts_by_account(account: str, limit: int = 100) -> List[Dict[str, Any]]:
    db_manager = get_db_manager()
    if db_manager.connected or db_manager.connect():
        return db_manager.get_posts_by_account(account, limit)

    return [post for post in _load_json_posts() if post.get("account") == account][:limit]


def get_high_impact_posts(limit: int = 50) -> List[Dict[str, Any]]:
    db_manager = get_db_manager()
    if db_manager.connected or db_manager.connect():
        return db_manager.get_high_impact_posts(limit)

    posts = _load_json_posts()
    high_posts = [post for post in posts if post.get("market_impact", {}).get("level") in ["high", "extreme"]]
    return sorted(high_posts, key=lambda p: p.get("market_impact", {}).get("score", 0), reverse=True)[:limit]


def get_recent_narratives(limit: int = 50) -> List[str]:
    db_manager = get_db_manager()
    if db_manager.connected or db_manager.connect():
        return db_manager.get_recent_narratives(limit)

    posts = _load_json_posts()
    narratives = []
    for post in posts:
        narratives.extend(post.get("historical_analysis", {}).get("narratives", []))
    return sorted({n for n in narratives}, key=lambda n: narratives.count(n), reverse=True)[:limit]


def _extract_narratives_from_text(content: str, themes: List[str], entities: Dict[str, Any]) -> List[str]:
    normalized = content.lower()
    found = []

    for label, patterns in NARRATIVE_PATTERNS:
        if any(re.search(pattern, normalized) for pattern in patterns):
            found.append(label)

    if "china" in [theme.lower() for theme in themes] and "trade" in normalized:
        found.append("Anti-China economic pressure narrative")

    if "energy" in [theme.lower() for theme in themes] and "independence" in normalized:
        found.append("Energy independence narrative")

    if "tariffs" in [theme.lower() for theme in themes] and "escalation" in normalized:
        found.append("Tariffs escalation narrative")

    if "election" in normalized or "vote" in normalized:
        found.append("Election focus narrative")

    return sorted(set(found))


def _count_theme_occurrences(theme: str, start: datetime, end: datetime) -> int:
    db_manager = get_db_manager()
    if db_manager.connected or db_manager.connect():
        try:
            return db_manager.count_documents(
                {
                    "themes": theme,
                    "scraped_at_dt": {"$gte": start, "$lt": end},
                }
            )
        except Exception:
            pass

    posts = _load_json_posts()
    return sum(
        1
        for post in posts
        if theme in post.get("themes", [])
        and (dt := _parse_post_time(post)) is not None
        and start <= dt < end
    )


def _get_trend_label(current: int, previous: int) -> str:
    if previous == 0:
        return "increasing" if current > 0 else "steady"

    if current >= previous * 1.2:
        return "increasing"
    if current <= previous * 0.8:
        return "decreasing"
    return "steady"


def build_theme_trends() -> Dict[str, Dict[str, Any]]:
    now = datetime.now().astimezone()
    counts = {}
    for theme in THEME_LABELS:
        window_24h = _count_theme_occurrences(theme, now - timedelta(days=1), now)
        window_prev_24h = _count_theme_occurrences(theme, now - timedelta(days=2), now - timedelta(days=1))
        window_7d = _count_theme_occurrences(theme, now - timedelta(days=7), now)
        counts[theme] = {
            "count_24h": window_24h,
            "count_7d": window_7d,
            "trend": _get_trend_label(window_24h, window_prev_24h),
        }
    return counts


def detect_repeated_narratives(recent_hours: int = 168) -> List[str]:
    now = datetime.now().astimezone()
    start = now - timedelta(hours=recent_hours)
    posts = [post for post in _get_recent_posts(500) if (dt := _parse_post_time(post)) is not None and start <= dt <= now]
    counter = Counter()
    for post in posts:
        counter.update(post.get("historical_analysis", {}).get("narratives", []) or [])
        counter.update(_extract_narratives_from_text(post.get("content", ""), post.get("themes", []), post.get("entities", {})))
    return [narrative for narrative, count in counter.most_common(20) if count >= 2]


def account_behavior_analytics(days: int = 7) -> Dict[str, Any]:
    now = datetime.now().astimezone()
    start = now - timedelta(days=days)
    posts = [post for post in _get_recent_posts(1000) if (dt := _parse_post_time(post)) is not None and start <= dt <= now]

    accounts: Dict[str, Dict[str, Any]] = {}
    for post in posts:
        account = post.get("account", "unknown")
        account_data = accounts.setdefault(
            account,
            {
                "post_count": 0,
                "themes": Counter(),
                "total_market_impact": 0,
                "posts": [],
            },
        )
        themes = post.get("themes") if isinstance(post.get("themes"), list) else []
        primary_theme = themes[0] if themes else "unknown"
        account_data["post_count"] += 1
        account_data["themes"][primary_theme] += 1
        account_data["total_market_impact"] += post.get("market_impact", {}).get("score", 0)
        account_data["posts"].append(post)

    analytics = {}
    for account, data in accounts.items():
        post_count = data["post_count"]
        analytics[account] = {
            "post_count": post_count,
            "posting_frequency_per_day": round(post_count / max(1, days), 2),
            "most_common_themes": [theme for theme, _ in data["themes"].most_common(5)],
            "average_market_impact": round(data["total_market_impact"] / max(1, post_count), 2),
        }
    return analytics


def build_daily_summary() -> Dict[str, Any]:
    now = datetime.now().astimezone()
    start = now - timedelta(days=1)
    posts = [post for post in _get_recent_posts(500) if (dt := _parse_post_time(post)) is not None and start <= dt <= now]

    theme_counts = Counter()
    entity_counts = Counter()
    for post in posts:
        theme_counts.update(post.get("themes", []))
        for entity_list in post.get("entities", {}).values():
            entity_counts.update(entity_list)

    top_themes = [theme for theme, _ in theme_counts.most_common(10)]
    top_entities = [entity for entity, _ in entity_counts.most_common(10)]
    high_impact_posts = sorted(posts, key=lambda p: p.get("market_impact", {}).get("score", 0), reverse=True)[:10]

    recent_narratives = detect_repeated_narratives(recent_hours=24)
    previous_narratives = detect_repeated_narratives(recent_hours=48)
    narrative_changes = [n for n in recent_narratives if n not in previous_narratives]

    return {
        "top_themes": top_themes,
        "top_entities": top_entities,
        "high_impact_posts": [
            {
                "post_id": post.get("post_id"),
                "account": post.get("account"),
                "market_impact": post.get("market_impact", {}),
                "scraped_at": post.get("scraped_at"),
            }
            for post in high_impact_posts
        ],
        "narrative_changes": narrative_changes,
    }


def build_weekly_summary() -> Dict[str, Any]:
    now = datetime.now().astimezone()
    start = now - timedelta(days=7)
    posts = [post for post in _get_recent_posts(1000) if (dt := _parse_post_time(post)) is not None and start <= dt <= now]

    theme_counts = Counter()
    entity_counts = Counter()
    account_counts = Counter()
    for post in posts:
        theme_counts.update(post.get("themes", []))
        for entity_list in post.get("entities", {}).values():
            entity_counts.update(entity_list)
        account_counts.update([post.get("account")])

    top_themes = [theme for theme, _ in theme_counts.most_common(10)]
    top_entities = [entity for entity, _ in entity_counts.most_common(10)]
    top_accounts = [account for account, _ in account_counts.most_common(10)]
    high_impact_posts = sorted(posts, key=lambda p: p.get("market_impact", {}).get("score", 0), reverse=True)[:10]

    return {
        "top_themes": top_themes,
        "top_entities": top_entities,
        "top_accounts": top_accounts,
        "high_impact_posts": [
            {
                "post_id": post.get("post_id"),
                "account": post.get("account"),
                "market_impact": post.get("market_impact", {}),
                "scraped_at": post.get("scraped_at"),
            }
            for post in high_impact_posts
        ],
    }


def analyze_post_history(post: Dict[str, Any]) -> Dict[str, Any]:
    themes = post.get("themes", [])
    entities = post.get("entities", {})
    content = post.get("content", "")

    narratives = _extract_narratives_from_text(content, themes, entities)

    now = datetime.now().astimezone()
    trend_signals = []
    frequency_flags = []
    for theme in set(themes):
        count_24h = _count_theme_occurrences(theme, now - timedelta(days=1), now)
        count_prev_24h = _count_theme_occurrences(theme, now - timedelta(days=2), now - timedelta(days=1))
        trend_label = _get_trend_label(count_24h, count_prev_24h)
        trend_signals.append(f"{theme} mentions are {trend_label}")
        if count_24h >= 5:
            frequency_flags.append(f"{theme} theme high frequency")
        if count_24h >= 10:
            frequency_flags.append(f"{theme} theme spike detected")

    if not trend_signals:
        trend_signals = ["No strong trend signal detected yet"]
    if not frequency_flags:
        frequency_flags = ["No frequency flags detected yet"]

    return {
        "narratives": sorted(set(narratives)),
        "trend_signals": sorted(set(trend_signals)),
        "frequency_flags": sorted(set(frequency_flags)),
    }


def add_post_historical_analysis(post: Dict[str, Any]) -> Dict[str, Any]:
    analysis = analyze_post_history(post)
    post["historical_analysis"] = analysis
    return post


def refresh_historical_summary(logger: Optional[Any] = None) -> Dict[str, Any]:
    ensure_output_path()
    summary = {
        "generated_at": get_local_timestamp(),
        "theme_trends": build_theme_trends(),
        "narratives": detect_repeated_narratives(),
        "account_behavior": account_behavior_analytics(),
        "daily_summary": build_daily_summary(),
        "weekly_summary": build_weekly_summary(),
    }
    safe_write_json_file(SUMMARY_FILE, summary)
    if logger:
        logger.info("Updated historical summary at %s", SUMMARY_FILE)
    return summary
