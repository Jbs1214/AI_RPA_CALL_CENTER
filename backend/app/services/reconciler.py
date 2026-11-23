"""처리 중 통화 점검. 지금은 시간 초과 정리만 한다(Orchestrator Job 상태 조회는 설계서 6.3, 아직 없음)."""
import time

from .. import config

_last_expire = 0.0


def expire_stuck(conn) -> None:
    """처리 중인데 ORCH_TIMEOUT_MIN 분 넘게 결과가 없는 통화를 FAILED(TIMEOUT)로 정리한다(1분에 한 번만 검사)."""
    global _last_expire
    now = time.monotonic()
    if now - _last_expire < 60:
        return
    _last_expire = now
    conn.execute(
        "UPDATE calls SET status='FAILED', error_message=%s, category=NULL, customer_question=NULL, "
        "action_taken=NULL, follow_up_needed=NULL, needs_review=NULL, confidence=NULL "
        "WHERE status='PROCESSING' AND updated_at < now() - (%s::int * interval '1 minute')",
        (f"TIMEOUT: {config.ORCH_TIMEOUT_MIN}분 넘게 결과가 오지 않았습니다.", config.ORCH_TIMEOUT_MIN))
