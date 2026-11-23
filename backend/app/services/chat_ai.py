"""챗봇 AI 방식(Groq, OpenAI 호환). 질문 글과 오늘 날짜만 보내고, 돌아온 조건은 검사한 뒤에만 쓴다.
어떤 실패든(키 없음, 시간 초과, 429, 형식 오류) None 을 돌려주고 호출한 쪽이 규칙 방식으로 대체한다."""
import json
import logging
import urllib.request
from datetime import date
from typing import Optional

from .. import config
from .chat_parser import CATEGORIES, validate_llm_query

log = logging.getLogger("chat_ai")

SYSTEM = (
    "너는 콜센터 통화 기록 조회 조건 변환기다. 사용자의 한국어 질문을 JSON 객체 하나로만 답한다.\n"
    '형식: {"intent": "list" 또는 "stats" 또는 "help", "query": {...}}\n'
    "list=통화 목록 보기, stats=건수·통계 묻기, help=통화 조회와 관계없거나 이해할 수 없는 질문.\n"
    "query 허용 키(해당할 때만 넣는다): category(" + ", ".join(CATEGORIES) + " 중 하나), agent(담당자 이름), "
    "company(고객사 이름), follow_up(후속조치 필요 여부 true/false), needs_review(AI 결과 검토 필요 여부 true/false), "
    "from·to(YYYY-MM-DD 한국 날짜), q(검색어 한 단어).\n"
    "오늘 날짜는 {today} 이다. 상대 날짜는 이 날짜 기준으로 계산한다. 다른 설명은 쓰지 않는다.\n"
    "'이전 질문'이 함께 오면 '그중', '그 건' 같은 말은 이전 질문의 조건에 이어서 해석한다."
)


def _user_text(message: str, history=()) -> str:
    """AI 에 보낼 글. history 중 사용자 질문만 쓴다(답변에는 고객사·건수 같은 통화 데이터가 있어 보내지 않는다)."""
    prev = [t.content.strip()[:500] for t in history if t.role == "user" and t.content.strip()]
    if not prev:
        return message[:500]
    return "이전 질문:\n" + "\n".join("- " + p for p in prev) + "\n\n질문: " + message[:500]


def interpret(message: str, today: date, history=()) -> Optional[dict]:
    if not (config.CHAT_AI_ENABLED and config.CHAT_AI_API_KEY):
        return None
    payload = {
        "model": config.CHAT_AI_MODEL,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM.replace("{today}", today.isoformat())},
            {"role": "user", "content": _user_text(message, history)},
        ],
    }
    req = urllib.request.Request(
        config.CHAT_AI_BASE_URL + "/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + config.CHAT_AI_API_KEY},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=config.CHAT_AI_TIMEOUT_SEC) as r:
            data = json.loads(r.read().decode("utf-8"))
        return check(json.loads(data["choices"][0]["message"]["content"]))
    except Exception as e:  # 키·본문은 로그에 남기지 않는다
        log.warning("챗봇 AI 사용 못함, 규칙 방식으로 대체: %s", type(e).__name__)
        return None


def check(obj) -> Optional[dict]:
    """AI 응답 검사. 맞지 않으면 None(= 규칙 방식 결과를 그대로 쓴다)."""
    if not isinstance(obj, dict):
        return None
    intent, q = obj.get("intent"), obj.get("query") or {}
    if intent not in ("list", "stats") or not isinstance(q, dict):
        return None
    try:
        validate_llm_query(q)
    except (ValueError, TypeError):
        return None
    for k in ("agent", "company", "q"):
        if k in q and (not isinstance(q[k], str) or not (0 < len(q[k]) <= 50)):
            return None
    q = dict(q)
    q.setdefault("status", "DONE")
    return {"intent": intent, "query": q, "action": None, "breakdown": False}
