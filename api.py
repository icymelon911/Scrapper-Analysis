from fastapi import FastAPI, HTTPException
from typing import List, Optional

from mongodb import get_db_manager
from historical_engine import (
    account_behavior_analytics,
    get_high_impact_posts,
    get_posts_by_account,
    get_posts_by_theme,
    get_recent_narratives,
    refresh_historical_summary,
)

app = FastAPI(title="Truth Social Intelligence API", version="1.0.0")

db_manager = get_db_manager()
if not db_manager.connect():
    print("Warning: MongoDB not available, API will return empty results")

@app.get("/posts", response_model=List[dict])
async def get_posts(limit: int = 100, account: Optional[str] = None):
    if account:
        return db_manager.get_posts_by_account(account, limit)
    return db_manager.get_posts(limit)

@app.get("/posts/{account}", response_model=List[dict])
async def get_posts_for_account(account: str, limit: int = 100):
    return db_manager.get_posts_by_account(account, limit)

@app.get("/posts/theme/{theme}", response_model=List[dict])
async def get_posts_for_theme(theme: str, limit: int = 100):
    return get_posts_by_theme(theme, limit)

@app.get("/posts/impact/high", response_model=List[dict])
async def get_high_impact_posts_endpoint(limit: int = 50):
    return get_high_impact_posts(limit)

@app.get("/analytics/narratives", response_model=List[str])
async def recent_narratives(limit: int = 50):
    return get_recent_narratives(limit)

@app.get("/analytics/account-behavior")
async def account_behavior():
    return account_behavior_analytics()

@app.get("/analytics/refresh-summary")
async def refresh_summary():
    return refresh_historical_summary()

@app.get("/stats")
async def get_stats():
    stats = db_manager.get_stats()
    return stats

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)