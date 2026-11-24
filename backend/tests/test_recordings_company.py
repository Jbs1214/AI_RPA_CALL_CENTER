"""파일 이름에서 고객사를 못 읽으면 '미확인'으로 저장한다(통합본 7.4). DB가 없으면 건너뛴다. 서버 PC(실제 DB)에서는 돌리지 않는다."""
import uuid

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.db import connect
from app.main import app

client = TestClient(app)


def _upload(name):
    wav = b"RIFF\x00\x00\x00\x00WAVE" + uuid.uuid4().bytes
    r = client.post("/api/recordings", files={"file": (name, wav, "audio/wav")})
    assert r.status_code == 201
    client.delete(f"/api/calls/{r.json()['call_id']}")
    return r.json()


@pytest.mark.parametrize("name, agent, company", [
    ("call_013_20261118_1347_A01.wav", "미확인", "미확인"),
    ("20261102_0914_김하늘_한울물산.wav", "김하늘", "한울물산"),
])
def test_고객사를_못_읽으면_미확인(name, agent, company):
    try:
        with connect() as c:
            c.execute("SELECT 1")
    except psycopg.OperationalError:
        pytest.skip("DB 없음")
    d = _upload(name)
    assert (d["agent_name"], d["customer_company"]) == (agent, company)
