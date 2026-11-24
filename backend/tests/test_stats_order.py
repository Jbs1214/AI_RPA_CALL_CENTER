"""통계의 동률 순서 시험(통합본 33번). 엑셀과 같이 첫 통화가 빠른 순이어야 한다. DB에 저장하지 않고 되돌린다."""
import hashlib

import psycopg
import pytest

from app.db import connect
from app.services.calls_repo import compute_stats


def test_동률이면_첫_통화가_빠른_순():
    try:
        with connect() as conn:
            for i, name in enumerate(["다", "나", "가"]):     # 이름순과 반대로 넣는다
                conn.execute(
                    "INSERT INTO calls (called_at, agent_name, customer_company, source_filename, file_hash, "
                    "status, category, follow_up_needed, needs_review) "
                    "VALUES (%s, %s, %s, 'x.wav', %s, 'DONE', '질의', false, false)",
                    (f"2099-01-01T0{i + 1}:00:00+09:00", name, name, hashlib.sha256(name.encode()).hexdigest()))
            s = compute_stats(conn, {"from": "2099-01-01", "to": "2099-01-01"})
            conn.rollback()
    except psycopg.OperationalError:
        pytest.skip("DB 없음")
    assert [r["customer_company"] for r in s["by_company"]] == ["다", "나", "가"]
    assert [r["agent_name"] for r in s["by_agent"]] == ["다", "나", "가"]
