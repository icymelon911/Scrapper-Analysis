import os
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import BulkWriteError, ConnectionFailure, DuplicateKeyError, OperationFailure

load_dotenv()


class MongoDBManager:
    def __init__(self, uri: Optional[str] = None, database_name: Optional[str] = None):
        self.uri = uri or os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
        self.database_name = database_name or os.getenv("DATABASE_NAME", "truthsocial_intelligence")
        self.client: Optional[MongoClient] = None
        self.db = None
        self.posts = None
        self.connected = False
        self.connect()

    def connect(self) -> bool:
        try:
            self.client = MongoClient(self.uri, serverSelectionTimeoutMS=5000)
            self.client.admin.command("ping")
            self.db = self.client[self.database_name]
            self.posts = self.db["posts"]
            self.posts.create_index("post_id", unique=True, background=True)
            self.connected = True
            return True
        except (ConnectionFailure, OperationFailure, Exception) as exc:
            print(f"MongoDB connection failed: {exc}")
            self.connected = False
            return False

    def disconnect(self) -> None:
        if self.client:
            self.client.close()
        self.connected = False

    def save_post(self, post: Dict[str, Any]) -> bool:
        if not self.connected and not self.connect():
            return False
        try:
            self.posts.insert_one(post)
            print(f"Saved to MongoDB: {post.get('post_id')}")
            return True
        except DuplicateKeyError:
            print(f"Duplicate skipped: {post.get('post_id')}")
            return False
        except Exception as exc:
            print(f"MongoDB Error: {exc}")
            return False

    def insert_posts(self, posts: List[Dict[str, Any]]) -> int:
        if not self.connected and not self.connect():
            return 0
        try:
            result = self.posts.insert_many(posts, ordered=False)
            return len(result.inserted_ids)
        except BulkWriteError as bwe:
            inserted_count = bwe.details.get("nInserted", 0) if bwe.details else 0
            duplicate_count = sum(
                1
                for error in bwe.details.get("writeErrors", [])
                if error.get("code") == 11000
            ) if bwe.details else 0
            print(
                f"MongoDB bulk write completed with {inserted_count} inserts and {duplicate_count} duplicate key conflicts"
            )
            return inserted_count
        except DuplicateKeyError:
            return 0
        except Exception as exc:
            print(f"Failed to insert posts: {exc}")
            return 0

    def get_posts(self, limit: int = 100, account: Optional[str] = None) -> List[Dict[str, Any]]:
        if not self.connected and not self.connect():
            return []
        query: Dict[str, Any] = {}
        if account:
            query["account"] = account
        try:
            return list(self.posts.find(query, {"_id": 0}).sort("scraped_at_dt", -1).limit(limit))
        except Exception as exc:
            print(f"Failed to fetch posts: {exc}")
            return []

    def get_posts_by_account(self, account: str, limit: int = 100) -> List[Dict[str, Any]]:
        return self.get_posts(limit=limit, account=account)

    def get_posts_by_theme(self, theme: str, limit: int = 100) -> List[Dict[str, Any]]:
        if not self.connected and not self.connect():
            return []
        try:
            return list(self.posts.find({"themes": theme}, {"_id": 0}).sort("scraped_at_dt", -1).limit(limit))
        except Exception as exc:
            print(f"Failed to fetch posts by theme: {exc}")
            return []

    def get_recent_narratives(self, limit: int = 50) -> List[str]:
        if not self.connected and not self.connect():
            return []
        try:
            posts = list(
                self.posts.find(
                    {"historical_analysis.narratives": {"$exists": True, "$ne": []}},
                    {"_id": 0, "historical_analysis.narratives": 1},
                )
                .sort("scraped_at_dt", -1)
                .limit(limit)
            )
            narratives: List[str] = []
            for post in posts:
                narratives.extend(post.get("historical_analysis", {}).get("narratives", []))
            return sorted({n for n in narratives}, key=lambda n: narratives.count(n), reverse=True)
        except Exception as exc:
            print(f"Failed to fetch recent narratives: {exc}")
            return []

    def get_high_impact_posts(self, limit: int = 50) -> List[Dict[str, Any]]:
        if not self.connected and not self.connect():
            return []
        try:
            return list(
                self.posts
                .find({"market_impact.level": {"$in": ["high", "extreme"]}}, {"_id": 0})
                .sort("scraped_at_dt", -1)
                .limit(limit)
            )
        except Exception as exc:
            print(f"Failed to fetch high impact posts: {exc}")
            return []

    def get_stats(self) -> Dict[str, Any]:
        if not self.connected and not self.connect():
            return {"total_posts": 0, "posts_per_account": {}, "avg_market_impact": 0.0}
        try:
            total_posts = self.posts.count_documents({})
            pipeline = [
                {"$group": {"_id": "$account", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
            ]
            account_counts = {doc["_id"]: doc["count"] for doc in self.posts.aggregate(pipeline)}
            avg_pipeline = [{"$group": {"_id": None, "avg_score": {"$avg": "$market_impact.score"}}}]
            avg_result = list(self.posts.aggregate(avg_pipeline))
            avg_score = avg_result[0]["avg_score"] if avg_result else 0.0
            return {
                "total_posts": total_posts,
                "posts_per_account": account_counts,
                "avg_market_impact": round(avg_score or 0.0, 2),
            }
        except Exception as exc:
            print(f"Failed to get stats: {exc}")
            return {"total_posts": 0, "posts_per_account": {}, "avg_market_impact": 0.0}

    def count_documents(self, query: Dict[str, Any]) -> int:
        if not self.connected and not self.connect():
            return 0
        try:
            return self.posts.count_documents(query)
        except Exception as exc:
            print(f"Failed to count documents: {exc}")
            return 0


db_manager = MongoDBManager()


def get_db_manager() -> MongoDBManager:
    return db_manager
