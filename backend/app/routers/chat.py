"""API 8: 챗봇 질문(규칙 → AI). 조회 전용: 질문으로 SQL을 만들지 않고 통화를 수정·삭제하지 않는다."""
import re
from datetime import datetime

from fastapi import APIRouter

from ..db import connect
from ..errors import ApiError, validation_error
from ..models import ChatIn
from ..services import chat_ai
from ..services.calls_repo import compute_stats
from ..services.chat_parser import parse as parse_question
from ..services.logic import HELP_TEXT, ITEM_COLS, KST, describe_query, normalize_filters, to_item, where_sql

router = APIRouter()


def _answer(conn, parsed: dict, mode: str, message: str) -> dict:
    intent, q = parsed["intent"], parsed.get("query") or {}
    base = {"intent": intent, "mode": mode, "query": {k: (v.isoformat() if hasattr(v, "isoformat") else v)
                                                       for k, v in q.items()},
            "total": 0, "items": [], "stats": None, "suggested_actions": []}
    if intent == "help":
        return {**base, "reply": HELP_TEXT, "query": {}}
    if intent == "detail":
        r = conn.execute(f"SELECT {ITEM_COLS} FROM calls WHERE call_id = %s", (parsed["call_id"],)).fetchone()
        if not r:
            return {**base, "reply": f"{parsed['call_id']} 통화를 찾을 수 없습니다.", "query": {}}
        return {**base, "reply": f"{parsed['call_id']} 통화 정보입니다.", "query": {}, "total": 1, "items": [to_item(r)]}
    f = normalize_filters(q)
    where, args = where_sql(f)
    total = conn.execute(f"SELECT COUNT(*) AS n FROM calls {where}", args).fetchone()["n"]
    desc = describe_query(base["query"])
    if intent == "stats":
        out = {**base, "total": total, "reply": f"{desc}는 {total}건입니다."}
        if parsed.get("breakdown"):
            full = compute_stats(conn, f)
            parts = {}
            if re.search(r"담당자별", message):
                parts["by_agent"] = full["by_agent"]
            if re.search(r"일별|일자별|추이", message):
                parts["by_day"] = full["by_day"]
            if re.search(r"유형별", message) or not parts:
                parts["by_category"] = full["by_category"]
            out["stats"] = parts
        return out
    rows = conn.execute(f"SELECT {ITEM_COLS} FROM calls {where} ORDER BY called_at DESC, call_id DESC LIMIT 5",
                        args).fetchall()
    items = [to_item(r) for r in rows]
    if intent == "action" and parsed.get("action"):
        act = parsed["action"]
        sugg = [{"label": f"{act['label']}: {it['call_id']}", "method": "PATCH", "path": f"/api/calls/{it['call_id']}",
                 "body": act["body"]} for it in items]
        reply = (f"{desc}는 {total}건입니다. {act['label']}를 진행할까요?" if total
                 else f"{desc}가 없습니다.")
        return {**base, "total": total, "items": items, "suggested_actions": sugg, "reply": reply}
    reply = (f"{desc}는 {total}건입니다. 최근 순으로 {len(items)}건을 보여 드립니다." if total
             else f"{desc}가 없습니다.")
    return {**base, "total": total, "items": items, "reply": reply}


@router.post("/api/chat", tags=["챗봇"], summary="챗봇 질문(규칙 → AI)")
def chat(body: ChatIn):
    message = body.message.strip()
    if not message:
        raise validation_error("message는 비어 있을 수 없습니다.")
    today = datetime.now(KST).date()
    with connect() as conn:
        agents = [r["agent_name"] for r in conn.execute("SELECT DISTINCT agent_name FROM calls").fetchall()]
        companies = [r["customer_company"] for r in conn.execute(
            "SELECT DISTINCT customer_company FROM calls WHERE customer_company IS NOT NULL").fetchall()]
        try:
            parsed = parse_question(message, today, agents, companies)
        except Exception:                           # 예: 13월 40일 같은 날짜
            parsed = {"intent": "help", "query": {}, "action": None}
        mode = "rule"
        if parsed["intent"] == "help":              # 규칙으로 못 알아들을 때만 AI를 부른다
            ai = chat_ai.interpret(message, today, body.history[-6:])
            if ai:
                parsed, mode = ai, "ai"
        try:
            return _answer(conn, parsed, mode, message)
        except ApiError:
            if mode == "ai":                        # AI가 만든 조건이 맞지 않으면 도움말로
                return _answer(conn, {"intent": "help", "query": {}}, "rule", message)
            raise
