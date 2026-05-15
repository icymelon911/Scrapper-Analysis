from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler


def start_scheduler(job, interval_minutes: int):
    scheduler = AsyncIOScheduler()
    scheduler.add_job(job, trigger="interval", minutes=interval_minutes, next_run_time=datetime.now())
    scheduler.start()
    return scheduler
