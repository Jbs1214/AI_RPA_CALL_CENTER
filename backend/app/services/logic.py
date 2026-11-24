"""DB·웹 프레임워크와 상관없는 순수 규칙(검증, 값 보정, 조회 조건, 응답 모양). 여기만 따로 시험한다."""
import re
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from ..errors import ApiError, validation_error
from .masking import mask_text

KST = timezone(timedelta(hours=9))
CATEGORIES = ["질의", "불만", "건의", "교육 내용", "기타 문의"]
STATUSES = ("RECEIVED", "PROCESSING", "DONE", "FAILED")
DEFAULT_FAIL_MESSAGE = "UNKNOWN: 실패 사유가 전달되지 않았습니다."

# 목록·상세·수정 응답 공통 항목(audio_path 는 내부 경로라 내보내지 않고 audio_available 로 대신한다)
ITEM_COLS = (
    "call_id, called_at, agent_name, customer_company, customer_phone, category, customer_question, "
    "action_taken, follow_up_needed, needs_review, source_filename, file_hash, status, error_message, "
    "retry_count, (audio_path IS NOT NULL) AS audio_available, job_state, created_at, updated_at"
)
DETAIL_COLS = ITEM_COLS + ", confidence, audio_size_bytes, job_key, transcript, analysis_json"


# ---------- 값 정리 ----------
def clean(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    s = s.strip()
    return s or None


def iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.astimezone(KST).isoformat(timespec="seconds") if dt else None


def require_tz(dt: datetime, field: str = "called_at") -> datetime:
    if dt.tzinfo is None or dt.utcoffset() is None:
        raise validation_error(f"{field}에 시간대(+09:00)가 없습니다.")
    return dt


def to_item(r: dict, detail: bool = False, with_transcript: bool = False) -> dict:
    """DB 행 -> 응답 항목. 시각은 +09:00, 신뢰도는 숫자."""
    out = {
        "call_id": r["call_id"],
        "called_at": iso(r["called_at"]),
        "agent_name": r["agent_name"],
        "customer_company": r["customer_company"],
        "customer_phone": r["customer_phone"],
        "category": r["category"],
        "customer_question": r["customer_question"],
        "action_taken": r["action_taken"],
        "follow_up_needed": r["follow_up_needed"],
        "needs_review": r["needs_review"],
        "source_filename": r["source_filename"],
        "file_hash": r["file_hash"],
        "status": r["status"],
        "error_message": r["error_message"],
        "retry_count": r["retry_count"],
        "audio_available": bool(r["audio_available"]),
        "job_state": r["job_state"],
        "created_at": iso(r["created_at"]),
        "updated_at": iso(r["updated_at"]),
    }
    if detail:
        c = r.get("confidence")
        out["confidence"] = float(c) if c is not None else None
        out["audio_size_bytes"] = r.get("audio_size_bytes")
        out["job_key"] = r.get("job_key")
        out["transcript"] = r.get("transcript")
        out["analysis_json"] = r.get("analysis_json")
    elif with_transcript:
        out["transcript"] = r.get("transcript")
    return out


# ---------- 분석 결과 값 보정 (API 1, 11 공통) ----------
def prepare_analysis(d: dict, threshold: float, *, agent_name: Optional[str], customer_company: Optional[str]) -> dict:
    """분석 결과를 저장할 값으로 바꾼다. 거부하지 않고 고쳐서 저장한다(봇이 실패 처리되지 않게)."""
    status = d.get("status") or "DONE"
    if status not in ("DONE", "FAILED"):
        raise validation_error("status는 DONE 또는 FAILED여야 합니다.")
    out: dict[str, Any] = {
        "status": status,
        "transcript": mask_text(d["transcript"]) if d.get("transcript") else None,
        "analysis_json": d.get("analysis_json"),
        "customer_phone": mask_text(clean(d.get("customer_phone"))),
    }
    if status == "FAILED":
        out.update(category=None, customer_question=None, action_taken=None, follow_up_needed=None,
                   needs_review=None, confidence=None,
                   error_message=(clean(d.get("error_message")) or DEFAULT_FAIL_MESSAGE)[:500])
        return out
    category = clean(d.get("category"))
    review = bool(d.get("needs_review"))
    if category not in CATEGORIES:        # 없거나 5개 밖이면 '기타 문의' + 검토 필요
        category, review = "기타 문의", True
    conf = d.get("confidence")
    if conf is None or conf < threshold:  # 신뢰도가 없거나 낮으면 검토 필요
        review = True
    follow_up = d.get("follow_up_needed")
    question = clean(d.get("customer_question"))
    # 저장할 때만 판정한다. 웹에서 '확인 완료'한 건(API 4)은 다시 켜지 않는다
    if (clean(agent_name) in (None, "미확인") or clean(customer_company) in (None, "미확인")
            or (category == "불만" and not follow_up)    # 불만인데 후속조치 N
            or follow_up is None                         # 후속조치를 안 보냄
            or not question):                            # 질문 요지가 빔(조치 내역은 비어도 정상일 수 있다)
        review = True
    out.update(
        category=category,
        customer_question=mask_text(question),
        action_taken=mask_text(clean(d.get("action_taken"))),
        follow_up_needed=bool(follow_up),
        needs_review=review,
        confidence=conf,
        error_message=None,
    )
    return out


# ---------- 조회 조건 ----------
def _to_date(v: Any, name: str) -> date:
    if isinstance(v, date):
        return v
    try:
        return date.fromisoformat(str(v))
    except ValueError:
        raise validation_error(f"{name}은 YYYY-MM-DD 형식의 날짜여야 합니다.")


def normalize_filters(f: dict) -> dict:
    """조회 조건 검사. 잘못된 값은 422. 빈 값은 없는 것으로 본다."""
    out: dict[str, Any] = {}
    for k in ("q", "agent", "company"):
        v = clean(f.get(k))
        if v is not None:
            out[k] = v
    if f.get("category") not in (None, ""):
        if f["category"] not in CATEGORIES:
            raise validation_error("category는 질의, 불만, 건의, 교육 내용, 기타 문의 중 하나여야 합니다.")
        out["category"] = f["category"]
    if f.get("status") not in (None, ""):
        if f["status"] not in STATUSES:
            raise validation_error("status는 RECEIVED, PROCESSING, DONE, FAILED 중 하나여야 합니다.")
        out["status"] = f["status"]
    for k in ("follow_up", "needs_review"):
        if f.get(k) is not None:
            out[k] = bool(f[k])
    for k in ("from", "to"):
        if f.get(k) not in (None, ""):
            out[k] = _to_date(f[k], k)
    if "from" in out and "to" in out and out["from"] > out["to"]:
        raise validation_error("from은 to보다 늦을 수 없습니다.")
    return out


def _like(s: str) -> str:
    return "%" + s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def where_sql(f: dict, extra: Optional[list[str]] = None) -> tuple[str, list]:
    """normalize_filters 를 거친 조건 -> ('WHERE ...' 또는 '', 바인딩 값). 값은 항상 파라미터로만 넣는다."""
    conds: list[str] = list(extra or [])
    args: list = []
    if f.get("q"):
        conds.append("(agent_name ILIKE %s OR customer_company ILIKE %s OR customer_question ILIKE %s "
                     "OR action_taken ILIKE %s)")
        args += [_like(f["q"])] * 4
    for key, col in (("category", "category"), ("agent", "agent_name"), ("company", "customer_company"),
                     ("status", "status")):
        if f.get(key) is not None:
            conds.append(f"{col} = %s")
            args.append(f[key])
    for key, col in (("follow_up", "follow_up_needed"), ("needs_review", "needs_review")):
        if f.get(key) is not None:
            conds.append(f"{col} = %s")
            args.append(bool(f[key]))
    if f.get("from"):
        conds.append("called_at >= ((%s::date)::timestamp AT TIME ZONE 'Asia/Seoul')")
        args.append(f["from"])
    if f.get("to"):
        conds.append("called_at < (((%s::date) + 1)::timestamp AT TIME ZONE 'Asia/Seoul')")
        args.append(f["to"])
    return ("WHERE " + " AND ".join(conds)) if conds else "", args


# ---------- 통계 조립 ----------
def build_stats(totals: dict, cat_rows: list, agent_rows: list, day_rows: list, company_rows: list) -> dict:
    counts = {r["category"]: r["n"] for r in cat_rows}
    by_day: dict[str, dict] = {}
    for r in day_rows:
        d = r["d"].isoformat()
        e = by_day.setdefault(d, {"date": d, "count": 0, "by_category": {c: 0 for c in CATEGORIES}})
        e["by_category"][r["category"]] = r["n"]
        e["count"] += r["n"]
    return {
        "total_calls": totals["total_calls"],
        "analyzed": totals["analyzed"],
        "follow_up_needed": totals["follow_up_needed"],
        "needs_review": totals["needs_review"],
        "failed": totals["failed"],
        "in_progress": totals["in_progress"],
        "by_category": [{"category": c, "count": counts.get(c, 0)} for c in CATEGORIES],
        "by_agent": [{"agent_name": r["agent_name"], "count": r["n"], "follow_up_count": r["fu"]}
                     for r in agent_rows],
        "by_day": [by_day[k] for k in sorted(by_day)],
        "by_company": [{"customer_company": r["customer_company"], "count": r["n"],
                        "complaint_count": r["complaints"]} for r in company_rows],
    }


# ---------- 음성 Range ----------
def parse_range(header: Optional[str], size: int):
    """None=전체, 'bad'=범위 오류(416), (시작, 끝)=부분. 여러 구간은 지원하지 않고 전체로 응답한다."""
    if not header:
        return None
    m = re.fullmatch(r"bytes=(\d*)-(\d*)", header.strip())
    if not m or (m.group(1) == "" and m.group(2) == ""):
        return None
    s, e = m.groups()
    if s == "":
        n = int(e)
        if n == 0:
            return "bad"
        start, end = max(size - n, 0), size - 1
    else:
        start = int(s)
        end = min(int(e), size - 1) if e else size - 1
    if size == 0 or start >= size or start > end:
        return "bad"
    return start, end


# ---------- 챗봇 응답 문장 ----------
HELP_TEXT = ("질문을 이해하지 못했습니다. 이렇게 물어보세요: '불만 중 후속조치 필요한 통화 보여줘', "
             "'새봄물산 불만 몇 건이야?', '김민수 담당 통화', '세금계산서 관련 통화', '검토 필요한 건 확인 완료 처리해줘'")


def describe_query(q: dict) -> str:
    parts = []
    if q.get("from"):
        a, b = str(q["from"]), str(q.get("to") or q["from"])
        parts.append(f"기간: {a}" if a == b else f"기간: {a}~{b}")
    if q.get("agent"):
        parts.append(f"담당자: {q['agent']}")
    if q.get("company"):
        parts.append(f"고객사: {q['company']}")
    if q.get("category"):
        parts.append(f"유형: {q['category']}")
    if "follow_up" in q:
        parts.append("후속조치: " + ("필요" if q["follow_up"] else "불필요"))
    if "needs_review" in q:
        parts.append("AI 결과 검토: " + ("필요" if q["needs_review"] else "완료"))
    if q.get("q"):
        parts.append(f"검색어: {q['q']}")
    if q.get("status") == "FAILED":
        parts.append("처리 실패")
    return "조건(" + ", ".join(parts) + ")에 맞는 통화" if parts else "전체 통화"
