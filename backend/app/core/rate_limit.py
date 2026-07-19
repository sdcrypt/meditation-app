from collections import defaultdict, deque
from time import time

from fastapi import HTTPException, Request


_requests_by_key: dict[str, deque[float]] = defaultdict(deque)


def rate_limit_key(request: Request, scope: str) -> str:
    """Build a basic client key for in-memory rate limiting."""
    forwarded_for = request.headers.get("x-forwarded-for", "")
    ip_address = forwarded_for.split(",", 1)[0].strip()
    if not ip_address and request.client:
        ip_address = request.client.host
    return f"{scope}:{ip_address or 'unknown'}"


def check_rate_limit(request: Request, *, scope: str, limit: int, window_seconds: int) -> None:
    """Allow only a fixed number of requests in a short time window."""
    key = rate_limit_key(request, scope)
    now = time()
    requests = _requests_by_key[key]
    while requests and now - requests[0] > window_seconds:
        requests.popleft()
    if len(requests) >= limit:
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Please wait and try again.",
        )
    requests.append(now)
