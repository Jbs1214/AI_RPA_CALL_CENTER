"""여러 라우터가 같이 쓰는 요청 처리: API 키 확인, 조회 조건."""
import hmac
from typing import Optional

from fastapi import Query, Request

from . import config
from .errors import ApiError
from .services.logic import normalize_filters


def check_key(request: Request, allow_query: bool = False) -> None:
    """API_KEY 가 설정된 때만 음성 관련 API 에서 X-API-Key 를 확인한다. 비어 있으면 헤더가 와도 무시한다."""
    if not config.API_KEY:
        return
    got = request.headers.get("x-api-key") or (request.query_params.get("api_key") if allow_query else None) or ""
    if not hmac.compare_digest(got.encode("utf-8"), config.API_KEY.encode("utf-8")):
        raise ApiError(401, "INVALID_API_KEY", "API 키가 없거나 올바르지 않습니다.")


def common_filters(
    q: Optional[str] = Query(None), category: Optional[str] = Query(None), agent: Optional[str] = Query(None),
    company: Optional[str] = Query(None), status: Optional[str] = Query(None),
    follow_up: Optional[bool] = Query(None), needs_review: Optional[bool] = Query(None),
    from_: Optional[str] = Query(None, alias="from"), to: Optional[str] = Query(None),
) -> dict:
    return normalize_filters({"q": q, "category": category, "agent": agent, "company": company, "status": status,
                              "follow_up": follow_up, "needs_review": needs_review, "from": from_, "to": to})


def date_filters(from_: Optional[str] = Query(None, alias="from"), to: Optional[str] = Query(None)) -> dict:
    return normalize_filters({"from": from_, "to": to})
