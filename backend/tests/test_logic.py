import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from datetime import date, datetime, timezone, timedelta
import pytest
from app.errors import ApiError
from app.services import logic, chat_ai
from app.services import storage as helpers

KST = timezone(timedelta(hours=9))

NAMES = {"agent_name": "김민수", "customer_company": "대한유통"}
OK = {"category": "질의", "customer_question": "문의", "action_taken": "안내", "follow_up_needed": False, "confidence": 0.9}

def prep(d, **names):
    return logic.prepare_analysis(d, 0.7, **{**NAMES, **names})

def test_done_normal():
    a = prep({**OK, "category": "불만", "follow_up_needed": True, "transcript": "전화 010-1234-5678",
              "customer_phone": "010-1234-5678"})
    assert a["status"] == "DONE" and a["needs_review"] is False and a["follow_up_needed"] is True
    assert a["transcript"] == "전화 010-****-5678" and a["customer_phone"] == "010-****-5678"

def test_low_confidence_flags_review():
    assert prep({**OK, "confidence": 0.62})["needs_review"] is True
    assert prep({**OK, "confidence": 0.7})["needs_review"] is False
    assert prep({**OK, "confidence": None})["needs_review"] is True      # 신뢰도 없음

def test_unknown_category_becomes_other():
    a = prep({**OK, "category": "AAA"})
    assert a["category"] == "기타 문의" and a["needs_review"] is True
    assert prep({**OK, "category": None})["category"] == "기타 문의"

def test_follow_up_missing_fills_false_and_flags_review():
    a = prep({k: v for k, v in OK.items() if k != "follow_up_needed"})
    assert a["follow_up_needed"] is False and a["needs_review"] is True

def test_review_rules():
    assert prep(OK)["needs_review"] is False                               # 모두 갖추면 검토 필요 아님
    assert prep(OK, agent_name="미확인")["needs_review"] is True
    assert prep(OK, customer_company="미확인")["needs_review"] is True
    assert prep(OK, customer_company=None)["needs_review"] is True
    assert prep(OK, customer_company=" ")["needs_review"] is True
    assert prep({**OK, "category": "불만", "follow_up_needed": False})["needs_review"] is True
    assert prep({**OK, "customer_question": " "})["needs_review"] is True
    assert prep({**OK, "action_taken": None})["needs_review"] is False    # 조치 내역은 비어도 정상일 수 있다

def test_failed_keeps_reason_and_clears_result():
    a = prep({"status": "FAILED", "category": "불만", "error_message": " STT_TIMEOUT: x "}, agent_name="미확인")
    assert a["status"] == "FAILED" and a["error_message"] == "STT_TIMEOUT: x" and a["category"] is None
    assert a["needs_review"] is None                                        # 실패에는 검토 규칙을 쓰지 않는다
    assert prep({"status": "FAILED"})["error_message"]                     # 사유 없어도 채운다

def test_bad_status():
    with pytest.raises(ApiError) as e: prep({"status": "PROCESSING"})
    assert e.value.status == 422

def test_tz_required():
    with pytest.raises(ApiError): logic.require_tz(datetime(2026, 11, 23, 10, 0))
    logic.require_tz(datetime(2026, 11, 23, 10, 0, tzinfo=KST))

def test_filters_validation():
    with pytest.raises(ApiError): logic.normalize_filters({"category": "없음"})
    with pytest.raises(ApiError): logic.normalize_filters({"status": "X"})
    with pytest.raises(ApiError): logic.normalize_filters({"from": "2026/11/01"})
    with pytest.raises(ApiError): logic.normalize_filters({"from": "2026-11-05", "to": "2026-11-01"})
    f = logic.normalize_filters({"q": " 세금 ", "from": "2026-11-23", "to": "2026-11-23", "follow_up": False, "agent": ""})
    assert f == {"q": "세금", "from": date(2026, 11, 23), "to": date(2026, 11, 23), "follow_up": False}

def test_where_sql_params_only():
    f = logic.normalize_filters({"q": "50%_x", "category": "불만", "follow_up": True, "from": "2026-11-23", "to": "2026-11-23"})
    sql, args = logic.where_sql(f, extra=["status = 'DONE'"])
    assert sql.startswith("WHERE status = 'DONE' AND ")
    assert sql.count("%s") == len(args)
    assert "50" not in sql and "불만" not in sql                   # 값이 SQL 문장에 들어가지 않는다
    assert args[0] == "%50\\%\\_x%"
    assert logic.where_sql({}) == ("", [])

def test_stats_fixed_category_order_and_zero():
    s = logic.build_stats({"total_calls": 1, "analyzed": 1, "follow_up_needed": 0, "needs_review": 0, "failed": 0, "in_progress": 0},
                          [{"category": "불만", "n": 2}], [], [{"d": date(2026, 11, 20), "category": "불만", "n": 2}], [])
    assert [c["category"] for c in s["by_category"]] == logic.CATEGORIES
    assert [c["count"] for c in s["by_category"]] == [0, 2, 0, 0, 0]
    assert s["by_day"] == [{"date": "2026-11-20", "count": 2, "by_category": {"질의": 0, "불만": 2, "건의": 0, "교육 내용": 0, "기타 문의": 0}}]

def test_range():
    assert logic.parse_range(None, 100) is None
    assert logic.parse_range("bytes=0-9", 100) == (0, 9)
    assert logic.parse_range("bytes=90-", 100) == (90, 99)
    assert logic.parse_range("bytes=-10", 100) == (90, 99)
    assert logic.parse_range("bytes=0-999", 100) == (0, 99)
    assert logic.parse_range("bytes=100-", 100) == "bad"
    assert logic.parse_range("bytes=5-2", 100) == "bad"
    assert logic.parse_range("bytes=0-1,5-6", 100) is None          # 여러 구간은 전체로 응답
    assert logic.parse_range("garbage", 100) is None

def test_to_item_kst_and_hidden_path():
    utc = datetime(2026, 11, 23, 1, 15, 30, tzinfo=timezone.utc)
    r = dict(call_id="C", called_at=utc, agent_name="a", customer_company=None, customer_phone=None, category=None,
             customer_question=None, action_taken=None, follow_up_needed=None, needs_review=None, source_filename="f",
             file_hash="h", status="RECEIVED", error_message=None, retry_count=0, audio_available=True, job_state=None,
             created_at=utc, updated_at=utc, confidence=None)
    it = logic.to_item(r)
    assert it["called_at"] == "2026-11-23T10:15:30+09:00" and "audio_path" not in it and "confidence" not in it
    assert logic.to_item(r, detail=True)["confidence"] is None

def test_ai_check():
    ok = chat_ai.check({"intent": "list", "query": {"category": "불만", "agent": "김민수"}})
    assert ok["query"]["status"] == "DONE" and ok["intent"] == "list"
    assert chat_ai.check({"intent": "list", "query": {"sql": "x"}}) is None
    assert chat_ai.check({"intent": "delete", "query": {}}) is None
    assert chat_ai.check({"intent": "list", "query": {"category": "아무거나"}}) is None
    assert chat_ai.check({"intent": "list", "query": {"agent": "x" * 80}}) is None
    assert chat_ai.check("x") is None

def test_ai_off_without_key(monkeypatch):
    monkeypatch.setattr(chat_ai.config, "CHAT_AI_ENABLED", True); monkeypatch.setattr(chat_ai.config, "CHAT_AI_API_KEY", "")
    assert chat_ai.interpret("안녕", date(2026, 11, 23)) is None

def test_ai_failure_returns_none(monkeypatch):
    monkeypatch.setattr(chat_ai.config, "CHAT_AI_ENABLED", True); monkeypatch.setattr(chat_ai.config, "CHAT_AI_API_KEY", "k")
    def boom(*a, **k): raise TimeoutError()
    monkeypatch.setattr(chat_ai.urllib.request, "urlopen", boom)
    assert chat_ai.interpret("안녕", date(2026, 11, 23)) is None

def test_ai_history_sends_user_questions_only(monkeypatch):
    """history 는 AI 방식에서만 쓰고, 사용자 질문만 보낸다(답변 속 통화 데이터는 보내지 않는다)."""
    import json as _json
    from app.models import ChatTurn
    monkeypatch.setattr(chat_ai.config, "CHAT_AI_ENABLED", True); monkeypatch.setattr(chat_ai.config, "CHAT_AI_API_KEY", "k")
    sent = {}
    class R:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def read(self): return _json.dumps({"choices": [{"message": {"content": _json.dumps(
            {"intent": "list", "query": {"category": "불만", "agent": "김민수"}})}}]}).encode()
    def fake(req, timeout):
        sent.update(_json.loads(req.data.decode("utf-8"))); return R()
    monkeypatch.setattr(chat_ai.urllib.request, "urlopen", fake)
    hist = [ChatTurn(role="user", content="불만 통화 보여줘"),
            ChatTurn(role="assistant", content="새봄물산 010-****-4410 등 3건입니다")]
    r = chat_ai.interpret("그중 김민수 건은?", date(2026, 11, 23), hist)
    assert r["query"]["agent"] == "김민수" and r["query"]["status"] == "DONE"
    user = sent["messages"][-1]["content"]
    assert "불만 통화 보여줘" in user and "그중 김민수 건은?" in user
    assert "새봄물산" not in _json.dumps(sent, ensure_ascii=False)
    assert chat_ai._user_text("안녕") == "안녕"                 # history 없으면 질문만

def test_describe():
    assert logic.describe_query({}) == "전체 통화"
    assert "유형: 불만" in logic.describe_query({"category": "불만", "follow_up": True, "status": "DONE"})
