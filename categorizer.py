import re

from typing import Any

THEMES = {
    "crypto": ["bitcoin", "btc", "crypto", "ethereum", "eth", "dogecoin", "doge"],
    "oil": ["oil", "opec", "gas", "crude"],
    "china": ["china", "beijing", "xi", "people's republic"],
    "tariffs": ["tariff", "import tax", "trade war"],
    "energy": ["energy", "nuclear", "solar", "wind", "coal"],
    "ai": ["ai", "artificial intelligence", "machine learning", "ml"],
    "defense": ["war", "military", "missile", "defense", "navy", "air force"],
}

COMPANIES = {
    "Tesla": ["tesla"],
    "Apple": ["apple"],
    "Nvidia": ["nvidia", "nvda"],
    "Amazon": ["amazon"],
    "Microsoft": ["microsoft", "msft"],
    "Google": ["google", "alphabet", "googl", "goog"],
    "Meta": ["meta", "facebook"],
    "Boeing": ["boeing"],
    "JPMorgan": ["jpmorgan", "jpm"],
    "Goldman Sachs": ["goldman sachs", "goldman"],
}

COUNTRIES = {
    "China": ["china", "beijing", "xi"],
    "United States": ["united states", "usa", "us", "america"],
    "Russia": ["russia", "kremlin"],
    "Ukraine": ["ukraine"],
    "Iran": ["iran"],
    "India": ["india"],
    "Germany": ["germany"],
    "France": ["france"],
}

COMMODITIES = {
    "Oil": ["oil", "opec", "crude", "barrel"],
    "Gas": ["gas", "natural gas", "ng"],
    "Gold": ["gold", "precious metal"],
    "Silver": ["silver"],
    "Wheat": ["wheat"],
}

CRYPTO = {
    "Bitcoin": ["bitcoin", "btc"],
    "Ethereum": ["ethereum", "eth"],
    "Dogecoin": ["dogecoin", "doge"],
    "Solana": ["solana", "sol"],
}

ORGANIZATIONS = {
    "Fed": ["fed", "federal reserve"],
    "NATO": ["nato"],
    "IMF": ["imf"],
    "World Bank": ["world bank"],
    "SEC": ["sec", "securities and exchange commission"],
    "EPA": ["epa"],
    "DOJ": ["doj", "department of justice"],
    "White House": ["white house"],
    "Congress": ["congress"],
}

COMPANY_TICKER_MAP = {
    "Tesla": "TSLA",
    "Apple": "AAPL",
    "Nvidia": "NVDA",
    "Amazon": "AMZN",
    "Microsoft": "MSFT",
    "Google": "GOOGL",
    "Meta": "META",
    "Boeing": "BA",
    "JPMorgan": "JPM",
    "Goldman Sachs": "GS",
}

COMMODITY_TICKER_MAP = {
    "Oil": "CL=F",
    "Gas": "NG=F",
    "Gold": "GC=F",
    "Silver": "SI=F",
    "Wheat": "ZW=F",
}

CRYPTO_PAIR_MAP = {
    "Bitcoin": "BTC-USD",
    "Ethereum": "ETH-USD",
    "Dogecoin": "DOGE-USD",
    "Solana": "SOL-USD",
}

ETF_MAP = {
    "tech": "XLK",
    "energy": "XLE",
    "defense": "ITA",
    "financials": "XLF",
    "commodities": "DBC",
}

SECTOR_MAP = {
    "Tesla": "tech",
    "Apple": "tech",
    "Nvidia": "tech",
    "Amazon": "tech",
    "Microsoft": "tech",
    "Google": "tech",
    "Meta": "tech",
    "Boeing": "defense",
    "JPMorgan": "financials",
    "Goldman Sachs": "financials",
    "Fed": "financials",
    "NATO": "defense",
    "SEC": "financials",
}

SENTIMENT_SETS = {
    "bullish": ["buy", "rally", "bullish", "uptrend", "gain", "soaring", "positive"],
    "bearish": ["sell", "drop", "bearish", "down", "weak", "loss", "recession", "inflation"],
}

TONE_SETS = {
    "aggressive": ["attack", "fight", "fire", "crooked", "fake news", "stupid", "enemy"],
    "supportive": ["support", "strong", "proud", "great", "honor", "win", "successful"],
    "informational": ["report", "news", "info", "update", "announce", "policy", "plan"],
}

RISK_SETS = {
    "high": ["war", "crisis", "sanction", "attack", "security", "threat", "nuclear", "recession"],
    "medium": ["tariff", "trade", "policy", "regulation", "inflation", "uncertain", "deficit"],
    "low": ["meeting", "economy", "report", "plan", "future"],
}


def normalize_text(text: str) -> str:
    return " ".join(text.lower().split())


def find_keywords(text: str, lookup: dict[str, list[str]]) -> list[str]:
    found = []
    for label, keywords in lookup.items():
        for keyword in keywords:
            pattern = r"\b" + re.escape(keyword.lower()) + r"\b"
            if re.search(pattern, text):
                found.append(label)
                break
    return sorted(set(found))


def categorize_text(text: str) -> list[str]:
    normalized = normalize_text(text)
    return find_keywords(normalized, THEMES)


def analyze_sentiment(text: str) -> dict[str, Any]:
    normalized = normalize_text(text)
    sentiment = {"market": "neutral", "tone": "informational", "risk_level": "low", "confidence": 0.5}

    bullish_matches = [w for w in SENTIMENT_SETS["bullish"] if f" {w}" in f" {normalized}"]
    bearish_matches = [w for w in SENTIMENT_SETS["bearish"] if f" {w}" in f" {normalized}"]

    if bullish_matches and not bearish_matches:
        sentiment["market"] = "bullish"
    elif bearish_matches and not bullish_matches:
        sentiment["market"] = "bearish"

    tone_matches = {tone: [w for w in keywords if f" {w}" in f" {normalized}"] for tone, keywords in TONE_SETS.items()}
    if tone_matches["aggressive"]:
        sentiment["tone"] = "aggressive"
    elif tone_matches["supportive"]:
        sentiment["tone"] = "supportive"

    risk_matches = {level: [w for w in keywords if f" {w}" in f" {normalized}"] for level, keywords in RISK_SETS.items()}
    if risk_matches["high"]:
        sentiment["risk_level"] = "high"
    elif risk_matches["medium"]:
        sentiment["risk_level"] = "medium"

    score = len(bullish_matches) + len(tone_matches["supportive"]) + len(risk_matches["low"]) - len(bearish_matches) - len(tone_matches["aggressive"]) - len(risk_matches["high"])
    confidence = min(1.0, max(0.4, 0.5 + abs(score) * 0.1))
    sentiment["confidence"] = round(confidence, 2)

    return sentiment


def extract_entities(text: str) -> dict[str, list[str]]:
    normalized = normalize_text(text)
    return {
        "companies": find_keywords(normalized, COMPANIES),
        "countries": find_keywords(normalized, COUNTRIES),
        "commodities": find_keywords(normalized, COMMODITIES),
        "crypto": find_keywords(normalized, CRYPTO),
        "organizations": find_keywords(normalized, ORGANIZATIONS),
    }


def map_market(entities: dict[str, list[str]]) -> dict[str, list[str]]:
    tickers = []
    sectors = set()
    for company in entities.get("companies", []):
        ticker = COMPANY_TICKER_MAP.get(company)
        if ticker:
            tickers.append(ticker)
        sector = SECTOR_MAP.get(company)
        if sector:
            sectors.add(sector)

    commodities = [COMMODITY_TICKER_MAP[commodity] for commodity in entities.get("commodities", []) if commodity in COMMODITY_TICKER_MAP]
    crypto_pairs = [CRYPTO_PAIR_MAP[asset] for asset in entities.get("crypto", []) if asset in CRYPTO_PAIR_MAP]
    etfs = [ETF_MAP[sector] for sector in sectors if sector in ETF_MAP]

    for org in entities.get("organizations", []):
        sector = SECTOR_MAP.get(org)
        if sector:
            sectors.add(sector)

def map_market(entities: dict[str, list[str]]) -> dict[str, list[str]]:
    tickers = []
    sectors = set()
    for company in entities.get("companies", []):
        ticker = COMPANY_TICKER_MAP.get(company)
        if ticker:
            tickers.append(ticker)
        sector = SECTOR_MAP.get(company)
        if sector:
            sectors.add(sector)

    commodities = [COMMODITY_TICKER_MAP[commodity] for commodity in entities.get("commodities", []) if commodity in COMMODITY_TICKER_MAP]
    crypto_pairs = [CRYPTO_PAIR_MAP[asset] for asset in entities.get("crypto", []) if asset in CRYPTO_PAIR_MAP]
    etfs = [ETF_MAP[sector] for sector in sectors if sector in ETF_MAP]

    for org in entities.get("organizations", []):
        sector = SECTOR_MAP.get(org)
        if sector:
            sectors.add(sector)

    return {
        "tickers": sorted(set(tickers)),
        "commodities": sorted(set(commodities)),
        "crypto_pairs": sorted(set(crypto_pairs)),
        "etfs": sorted(set(etfs)),
        "sectors": sorted(sectors),
    }


# Market Impact Scoring
IMPACT_KEYWORDS = {
    "high": ["war", "sanctions", "nuclear", "crisis", "attack", "recession", "inflation", "tariff", "trade war"],
    "medium": ["policy", "election", "regulation", "fed", "interest rate", "oil", "gas", "china", "russia"],
    "low": ["meeting", "report", "update", "plan", "economy"]
}

ENTITY_IMPACT_WEIGHTS = {
    "companies": 15,
    "countries": 20,
    "commodities": 25,
    "crypto": 30,
    "organizations": 10
}

SECTOR_IMPACT_WEIGHTS = {
    "crypto": 30,
    "energy": 25,
    "defense": 20,
    "financials": 15,
    "tech": 10
}


def calculate_market_impact(content: str, entities: dict[str, list[str]], themes: list[str]) -> dict[str, Any]:
    normalized = normalize_text(content)
    score = 0
    drivers = []

    # Keyword intensity
    for level, keywords in IMPACT_KEYWORDS.items():
        matches = [kw for kw in keywords if f" {kw}" in f" {normalized}"]
        if matches:
            if level == "high":
                score += 30
                drivers.extend(matches)
            elif level == "medium":
                score += 15
                drivers.extend(matches)
            elif level == "low":
                score += 5
                drivers.extend(matches)

    # Entity presence
    for entity_type, entity_list in entities.items():
        if entity_list:
            weight = ENTITY_IMPACT_WEIGHTS.get(entity_type, 5)
            score += len(entity_list) * weight
            drivers.extend(entity_list)

    # Theme-based weighting
    for theme in themes:
        if theme in SECTOR_IMPACT_WEIGHTS:
            score += SECTOR_IMPACT_WEIGHTS[theme]
            drivers.append(theme)

    # Cap score at 100
    score = min(100, score)

    # Determine level
    if score >= 80:
        level = "extreme"
    elif score >= 60:
        level = "high"
    elif score >= 30:
        level = "medium"
    else:
        level = "low"

    return {
        "score": score,
        "level": level,
        "drivers": sorted(set(drivers))
    }

