"""calls 표 SQL: 관리번호 발급, 업서트, 한 건 조회, 통계."""
from ..errors import ApiError
from .logic import DETAIL_COLS, ITEM_COLS, build_stats, to_item, where_sql

NEXT_ID_SQL = ("SELECT 'CALL-' || to_char(now() AT TIME ZONE 'Asia/Seoul', 'YYYYMMDD') || '-' || "
               "lpad(nextval('call_no_seq')::text, 3, '0') AS call_id")

# API 1: 새 파일은 넣고, 같은 파일이 FAILED면 덮어쓰고, DONE·처리 중이면 0행(→ 409)
UPSERT_SQL = """
INSERT INTO calls (called_at, agent_name, customer_company, customer_phone, category, customer_question,
                   action_taken, follow_up_needed, confidence, needs_review, source_filename, file_hash,
                   transcript, analysis_json, status, error_message)
VALUES (%(called_at)s, %(agent_name)s, %(customer_company)s, %(customer_phone)s, %(category)s, %(customer_question)s,
        %(action_taken)s, %(follow_up_needed)s, %(confidence)s, %(needs_review)s, %(source_filename)s, %(file_hash)s,
        %(transcript)s, %(analysis_json)s, %(status)s, %(error_message)s)
ON CONFLICT (file_hash) DO UPDATE SET
    called_at=EXCLUDED.called_at, agent_name=EXCLUDED.agent_name, customer_company=EXCLUDED.customer_company,
    customer_phone=EXCLUDED.customer_phone, category=EXCLUDED.category,
    customer_question=EXCLUDED.customer_question, action_taken=EXCLUDED.action_taken,
    follow_up_needed=EXCLUDED.follow_up_needed, confidence=EXCLUDED.confidence,
    needs_review=EXCLUDED.needs_review, source_filename=EXCLUDED.source_filename,
    transcript=EXCLUDED.transcript, analysis_json=EXCLUDED.analysis_json, status=EXCLUDED.status,
    error_message=EXCLUDED.error_message, retry_count=calls.retry_count + 1
WHERE calls.status = 'FAILED'
RETURNING call_id
"""


def get_item(conn, call_id: str, detail: bool = False) -> dict:
    cols = DETAIL_COLS if detail else ITEM_COLS
    r = conn.execute(f"SELECT {cols} FROM calls WHERE call_id = %s", (call_id,)).fetchone()
    if not r:
        raise ApiError(404, "NOT_FOUND", "없는 관리번호입니다.")
    return to_item(r, detail=detail)


def compute_stats(conn, f: dict) -> dict:
    where, args = where_sql(f)
    done_where, done_args = where_sql(f, extra=["status = 'DONE'"])
    totals = conn.execute(
        "SELECT COUNT(*) AS total_calls, COUNT(*) FILTER (WHERE status = 'DONE') AS analyzed, "
        "COUNT(*) FILTER (WHERE follow_up_needed) AS follow_up_needed, COUNT(*) FILTER (WHERE needs_review) AS needs_review, "
        "COUNT(*) FILTER (WHERE status = 'FAILED') AS failed, "
        f"COUNT(*) FILTER (WHERE status IN ('RECEIVED','PROCESSING')) AS in_progress FROM calls {where}", args).fetchone()
    cats = conn.execute(f"SELECT category, COUNT(*) AS n FROM calls {done_where} GROUP BY category", done_args).fetchall()
    agents = conn.execute(
        "SELECT agent_name, COUNT(*) AS n, COUNT(*) FILTER (WHERE follow_up_needed) AS fu "
        f"FROM calls {done_where} GROUP BY agent_name ORDER BY n DESC, agent_name", done_args).fetchall()
    days = conn.execute(
        "SELECT (called_at AT TIME ZONE 'Asia/Seoul')::date AS d, category, COUNT(*) AS n "
        f"FROM calls {done_where} GROUP BY d, category ORDER BY d", done_args).fetchall()
    cw, ca = where_sql(f, extra=["status = 'DONE'", "customer_company IS NOT NULL"])
    companies = conn.execute(
        "SELECT customer_company, COUNT(*) AS n, COUNT(*) FILTER (WHERE category = '불만') AS complaints "
        f"FROM calls {cw} GROUP BY customer_company ORDER BY complaints DESC, n DESC, customer_company LIMIT 10",
        ca).fetchall()
    return build_stats(totals, cats, agents, days, companies)
