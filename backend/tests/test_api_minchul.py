"""민철 담당 API(1·6) DB 시험. 로컬 DB(.env의 DATABASE_URL)가 없으면 건너뛴다.

주의: 이 시험은 .env의 DB에 통화를 넣었다 지운다. 서버 PC(실제 DB)에서는 돌리지 않는다.
    python -X utf8 -m pytest tests
smoke 점검(tests/smoke_check.py)은 pytest 시험이 아니다. 서버를 띄운 뒤 따로 돌린다.
    python tests/smoke_check.py http://localhost:8000
"""
import hashlib
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db import connect

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
