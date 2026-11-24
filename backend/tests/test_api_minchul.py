"""민철 담당 API(1·6) DB 시험과 인수 테스트 1·3·6(PRD v3 11절). 로컬 DB(.env의 DATABASE_URL)가 없으면 건너뛴다.

주의: 이 시험은 .env의 DB에 통화를 넣었다 지운다. 서버 PC(실제 DB)에서는 돌리지 않는다.
    python -X utf8 -m pytest tests
smoke 점검(tests/smoke_check.py)은 pytest 시험이 아니다. 서버를 띄운 뒤 따로 돌린다.
    python tests/smoke_check.py http://localhost:8000
"""
import hashlib
import io
import os
import uuid
import wave
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db import connect
from app.services.calls_repo import compute_stats
from app.services import reconciler

client = TestClient(app)


def _db_ok():
    try:
        with connect() as c:
            c.execute("SELECT 1")
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _db_ok(), reason="DB 없음")


def _body(**kw):
    h = hashlib.sha256(uuid.uuid4().bytes).hexdigest()
    return {"called_at": "2026-11-23T10:30:00+09:00", "agent_name": "시험담당",
            "source_filename": f"20261123_1030_시험담당_시험고객사_{h[:6]}.wav", "file_hash": h, **kw}


@pytest.fixture
def created():
    ids = []
    yield ids
    for cid in ids:
        client.delete(f"/api/calls/{cid}")


def test_FAILED_사유없으면_422():
    r = client.post("/api/calls", json=_body(status="FAILED"))
    assert r.status_code == 422
    assert r.json() == {"error": "VALIDATION_ERROR", "message": "FAILED에는 error_message가 필요합니다."}


def test_FAILED_저장해도_검토필요_통계_그대로(created):
    before = client.get("/api/stats").json()
    r = client.post("/api/calls", json=_body(status="FAILED", error_message="STT_TIMEOUT: 시험",
                                             category="불만", needs_review=True, confidence=0.1))
    assert r.status_code == 201
    created.append(r.json()["call_id"])
    after = client.get("/api/stats").json()
    assert after["needs_review"] == before["needs_review"]
    assert after["failed"] == before["failed"] + 1


def test_DONE_검토필요_true_유지(created):
    r = client.post("/api/calls", json=_body(category="질의", confidence=0.95, needs_review=True))
    assert r.status_code == 201
    created.append(r.json()["call_id"])
    assert client.get(f"/api/calls/{r.json()['call_id']}").json()["needs_review"] is True


def test_API_KEY_비어있으면_헤더_무시(created):
    r = client.post("/api/calls", json=_body(category="질의", confidence=0.9), headers={"X-API-Key": "any-temp-value"})
    assert r.status_code == 201
    created.append(r.json()["call_id"])


def test_422_필수값_문구():
    b = _body()
    del b["called_at"]
    assert client.post("/api/calls", json=b).json()["message"] == "필수값이 없습니다: called_at"


# ---------- 인수 테스트(PRD v3 11절) ----------
def _seed_stats(f: dict) -> dict:
    """DB를 비우고 seed.sql만 넣은 상태의 통계. 한 트랜잭션 안에서 하고 되돌리므로 DB는 그대로다.
    setval은 되돌려지지 않아 관리번호 순서가 꼬이므로 빼고 넣는다."""
    sql = (Path(__file__).resolve().parents[1] / "seed.sql").read_text(encoding="utf-8")
    sql = "\n".join(l for l in sql.splitlines() if "setval" not in l)
    with connect() as conn:
        conn.execute("DELETE FROM calls")
        conn.execute(sql)
        s = compute_stats(conn, f)
        conn.rollback()
    return s


def test_인수1_seed_통계():
    s = _seed_stats({})
    assert (s["total_calls"], s["analyzed"], s["follow_up_needed"], s["needs_review"], s["failed"],
            s["in_progress"]) == (15, 14, 6, 2, 1, 0)


def test_인수3_FAILED_다시_저장하면_같은_관리번호(created):
    b = _body(status="FAILED", error_message="STT_TIMEOUT: 시험")
    r1 = client.post("/api/calls", json=b)
    assert r1.status_code == 201
    created.append(r1.json()["call_id"])
    ok = {k: v for k, v in b.items() if k not in ("status", "error_message")}
    r2 = client.post("/api/calls", json={**ok, "category": "질의", "confidence": 0.9})
    assert r2.status_code == 201
    assert r2.json() == {"call_id": r1.json()["call_id"], "status": "DONE"}
    d = client.get(f"/api/calls/{r1.json()['call_id']}").json()
    assert d["retry_count"] == 1 and d["error_message"] is None


def test_인수6_하루_조회():
    s = _seed_stats({"from": "2026-11-23", "to": "2026-11-23"})
    assert (s["total_calls"], s["failed"], s["analyzed"]) == (6, 1, 5)


# ---------- 흐름 B: 올리기 → 가져가기 → 음성 받기 → 결과 (API 9·12·10·11) ----------
def _wav() -> bytes:
    b = io.BytesIO()
    with wave.open(b, "wb") as w:                  # 1초 잡음(자체 제작, 매번 해시가 다름)
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(8000); w.writeframes(os.urandom(16000))
    return b.getvalue()


def _upload(created, minute: str, audio: bytes = None) -> str:
    r = client.post("/api/recordings",
                    files={"file": (f"20261124_11{minute}_시험담당_시험고객사.wav", audio or _wav(), "audio/wav")})
    assert r.status_code == 201 and r.json()["status"] == "RECEIVED"
    if r.json()["call_id"] not in created:
        created.append(r.json()["call_id"])
    return r.json()["call_id"]


def test_흐름B_가져가기부터_결과까지(created):
    cid = _upload(created, "00")
    r = client.post(f"/api/calls/{cid}/process")
    assert r.json() == {"call_id": cid, "status": "PROCESSING", "job_key": None}   # 가져가기(ORCH_ENABLED=false)
    assert client.post(f"/api/calls/{cid}/process").status_code == 409             # 두 봇이 같은 건을 못 가져간다
    assert client.get(f"/api/calls/{cid}/audio").status_code == 200
    r = client.put(f"/api/calls/{cid}/result", json={"status": "DONE", "category": "불만", "follow_up_needed": True,
                                                      "needs_review": False, "confidence": 0.95})
    assert r.json() == {"call_id": cid, "status": "DONE", "needs_review": False}
    assert client.put(f"/api/calls/{cid}/result", json={"status": "DONE", "category": "질의"}).status_code == 409


def test_Job시작방식_실패_후_다시_시작(created):
    """Job 시작(ORCH_ENABLED=true)에서 웹의 '처리 시작' 버튼이 FAILED 통화에 API 12를 다시 부르는 경로(prd.md 5.3)."""
    cid = _upload(created, "01")
    client.post(f"/api/calls/{cid}/process")
    r = client.put(f"/api/calls/{cid}/result", json={"status": "FAILED"})   # API 11은 사유가 없어도 기본 사유로 저장
    assert r.json()["status"] == "FAILED"
    assert client.post(f"/api/calls/{cid}/process").status_code == 200
    d = client.get(f"/api/calls/{cid}").json()
    assert (d["status"], d["retry_count"], d["error_message"]) == ("PROCESSING", 1, None)


def test_가져가기방식_실패_후_같은_파일_다시_올리기(created):
    """가져가기에서 FAILED는 봇의 대기 목록에 안 나온다. 같은 파일을 다시 올리면 RECEIVED로 돌아온다
    (prd.md 5.2, 통합본 5장, 인수 10)."""
    audio = _wav()
    cid = _upload(created, "02", audio)
    client.post(f"/api/calls/{cid}/process")
    client.put(f"/api/calls/{cid}/result", json={"status": "FAILED", "error_message": "STT_TIMEOUT: 시험"})
    waiting = lambda: [i["call_id"] for i in client.get("/api/calls", params={"status": "RECEIVED", "size": 200}).json()["items"]]
    assert cid not in waiting()                                   # 실패 건은 대기 목록에 없다
    r = client.post("/api/recordings", files={"file": ("20261124_1102_시험담당_시험고객사.wav", audio, "audio/wav")})
    assert r.status_code == 201
    assert (r.json()["call_id"], r.json()["status"], r.json()["retry_count"]) == (cid, "RECEIVED", 1)   # 같은 관리번호
    d = client.get(f"/api/calls/{cid}").json()
    assert d["error_message"] is None
    assert cid in waiting()                                       # 다시 대기 목록에 보인다
    assert client.post(f"/api/calls/{cid}/process").status_code == 200   # 봇이 다시 가져갈 수 있다


# ---------- 인수 15: 처리 중 30분 넘으면 FAILED(TIMEOUT) ----------
def test_인수15_처리중_시간초과_정리(monkeypatch):
    """updated_at을 과거로 넣은 통화로 확인하고 되돌린다(INSERT에는 updated_at 자동 갱신이 걸리지 않는다)."""
    monkeypatch.setattr(reconciler, "_last_expire", 0.0)          # 1분에 한 번 제한을 푼다
    rows = {"old": ("PROCESSING", "40 minutes"), "new": ("PROCESSING", "5 minutes"), "recv": ("RECEIVED", "40 minutes")}
    with connect() as conn:
        ids = {}
        for k, (st, ago) in rows.items():
            ids[k] = conn.execute(
                "INSERT INTO calls (called_at, agent_name, source_filename, file_hash, status, audio_path, updated_at) "
                "VALUES (now(), '시험담당', 'x.wav', %s, %s, 'test/x.wav', now() - %s::interval) RETURNING call_id",
                (hashlib.sha256(uuid.uuid4().bytes).hexdigest(), st, ago)).fetchone()["call_id"]
        reconciler.expire_stuck(conn)
        got = {k: conn.execute("SELECT status, error_message FROM calls WHERE call_id = %s", (v,)).fetchone()
               for k, v in ids.items()}
        conn.rollback()
    assert got["old"]["status"] == "FAILED" and got["old"]["error_message"].startswith("TIMEOUT:")
    assert got["new"]["status"] == "PROCESSING"      # 30분 안 된 건은 그대로
    assert got["recv"]["status"] == "RECEIVED"       # 처리 중이 아닌 건은 건드리지 않는다
