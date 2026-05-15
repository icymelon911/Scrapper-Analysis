from mongodb import MongoDBManager

db = MongoDBManager()

test_post = {
    "post_id": "test_001",
    "account": "realDonaldTrump",
    "content": "Hello MongoDB",
    "scraped_at": "2026-05-14T22:00:00+08:00"
}

db.save_post(test_post)