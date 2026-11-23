"""챗봇 규칙 기반 해석기 (참고 구현). 외부 라이브러리 없이 동작한다.
질문 문장 -> {intent, query, action}. LLM이 없거나 실패했을 때의 대체 경로(mode="rule")이자,
LLM이 돌려준 JSON을 검사하는 기준(허용 키·값)으로도 쓴다.
"""
import re
from datetime import date, timedelta

CATEGORIES = ["질의", "불만", "건의", "교육 내용", "기타 문의"]
ALLOWED_QUERY_KEYS = {"category", "agent", "company", "follow_up", "needs_review", "status", "from", "to", "q"}
ID_RE = re.compile(r"CALL-\d{8}-\d{3,}")

def _cat(t):
    if "기타" in t: return "기타 문의"
    if "교육" in t: return "교육 내용"
    if re.search(r"불만|클레임|항의", t): return "불만"
    if re.search(r"건의|제안", t): return "건의"
    if "질의" in t: return "질의"
    return None

def _dates(t, today):
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})", t)
    if m:
        d = date(int(m[1]), int(m[2]), int(m[3])); return d.isoformat(), d.isoformat()
    m = re.search(r"(\d{1,2})월\s*(\d{1,2})일", t)
    if m:
        d = date(today.year, int(m[1]), int(m[2])); return d.isoformat(), d.isoformat()
    if "오늘" in t: return today.isoformat(), today.isoformat()
    if "어제" in t:
        d = today - timedelta(days=1); return d.isoformat(), d.isoformat()
    m = re.search(r"최근\s*(\d+)\s*일", t)
    if m: return (today - timedelta(days=int(m[1]) - 1)).isoformat(), today.isoformat()
    if re.search(r"최근\s*(일주일|1주일|한\s*주)", t): return (today - timedelta(days=6)).isoformat(), today.isoformat()
    if "이번 주" in t or "금주" in t: return (today - timedelta(days=today.weekday())).isoformat(), today.isoformat()
    if "이번 달" in t or "이번달" in t: return today.replace(day=1).isoformat(), today.isoformat()
    return None, None

def _done(r):
    """통계·엑셀과 숫자를 맞추기 위해, 실패(FAILED)를 묻지 않으면 분석이 끝난 통화(DONE)만 조회한다."""
    r["query"].setdefault("status", "DONE")
    return r

def parse(message, today, agents=(), companies=()):
    t = message.strip()
    q = {}
    m = ID_RE.search(t)
    if m:
        return {"intent": "detail", "call_id": m.group(0), "query": {}, "action": None}
    c = _cat(t)
    if c: q["category"] = c
    for a in agents:
        if a in t: q["agent"] = a
    for co in companies:
        if co.replace("(주)", "") in t: q["company"] = co
    if re.search(r"후속", t):
        q["follow_up"] = not re.search(r"없는|불필요|필요 없", t)
    if "검토" in t: q["needs_review"] = True
    if "실패" in t: q["status"] = "FAILED"   # "오류"는 고객 불만 내용에도 흔한 말이라 실패로 보지 않는다
    f, to = _dates(t, today)
    if f: q["from"], q["to"] = f, to
    km = re.search(r"([가-힣A-Za-z0-9]{2,})\s*(관련|에 대한|를 문의|을 문의|언급)", t)
    if km and km.group(1) not in agents and not any(km.group(1) in c for c in companies) and not _cat(km.group(1)):
        q["q"] = km.group(1)

    action = None
    if re.search(r"(확인|검토)\s*(완료|처리)|검토\s*해제", t) and q.get("needs_review"):
        action = {"label": "AI 결과 검토 완료 처리", "body": {"needs_review": False}}
    elif re.search(r"후속조치?\s*(완료|처리|해제)", t) or (q.get("follow_up") and re.search(r"완료\s*처리", t)):
        action = {"label": "후속조치 완료 처리", "body": {"follow_up_needed": False}}
        q["follow_up"] = True
    if action: return _done({"intent": "action", "query": q, "action": action})

    if re.search(r"유형별|담당자별|일별|일자별|추이", t):
        return _done({"intent": "stats", "query": q, "action": None, "breakdown": True})
    if re.search(r"몇\s*건|건수|통계|비율|현황|얼마나|몇 개|몇개", t):
        return _done({"intent": "stats", "query": q, "action": None, "breakdown": False})
    if q:
        return _done({"intent": "list", "query": q, "action": None})
    return {"intent": "help", "query": {}, "action": None}

def validate_llm_query(q):
    """LLM이 돌려준 조회 조건 검사: 허용 키만, 값 형식 확인. 어긋나면 ValueError -> 규칙 모드로 대체."""
    bad = set(q) - ALLOWED_QUERY_KEYS
    if bad: raise ValueError(f"허용되지 않는 키: {bad}")
    if "category" in q and q["category"] not in CATEGORIES: raise ValueError("category")
    for k in ("from", "to"):
        if k in q: date.fromisoformat(q[k])
    for k in ("follow_up", "needs_review"):
        if k in q and not isinstance(q[k], bool): raise ValueError(k)
    if "status" in q and q["status"] not in ("DONE", "FAILED"): raise ValueError("status")
    return q
