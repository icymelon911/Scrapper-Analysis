from datetime import datetime


def get_local_timestamp() -> str:
    """Return the current local machine time as an aware ISO 8601 string.

    This uses the local system timezone from the running laptop by calling
    datetime.now().astimezone(), which preserves the OS local timezone and
    includes the offset in the returned ISO format.
    """
    local_datetime = datetime.now().astimezone().replace(microsecond=0)
    return local_datetime.isoformat()


def parse_iso_timestamp(timestamp: str) -> datetime:
    """Parse an ISO 8601 timestamp string into a timezone-aware datetime.
    
    If the parsed datetime is naive (no timezone), this function attaches
    the local system timezone to ensure all returned datetimes are aware.
    """
    dt = datetime.fromisoformat(timestamp)
    
    # If the datetime is naive (no timezone info), attach the local timezone
    if dt.tzinfo is None:
        dt = dt.astimezone()
    
    return dt
