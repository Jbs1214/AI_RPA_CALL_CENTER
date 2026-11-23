"""API 12: 처리 시작(가져가기 / Orchestrator Job 시작). API 13 Webhook 은 아직 없다(설계서 6.4)."""
from fastapi import APIRouter

from .. import config
from ..db import connect
from ..errors import ApiError
from ..services import orch_client

router = APIRouter()


# ======================= API 12: 처리 시작(가져가기 / Job 시작) =======================
@router.post("/api/calls/{call_id}/process", tags=["처리"], summary="처리 시작(가져가기 또는 Orchestrator Job 시작)")
def process_call(call_id: str):
    with connect() as conn:
        r = conn.execute("SELECT status, audio_path FROM calls WHERE call_id = %s", (call_id,)).fetchone()
        if not r:
            raise ApiError(404, "NOT_FOUND", "없는 관리번호입니다.")
        if r["status"] not in ("RECEIVED", "FAILED"):
            raise ApiError(409, "INVALID_STATE", "지금 상태에서는 처리를 시작할 수 없습니다.")
        if not r["audio_path"]:
            raise ApiError(409, "INVALID_STATE", "음성 파일이 없는 통화는 처리를 시작할 수 없습니다.")
        job_key = None
        if config.ORCH_ENABLED:
            try:
                job_key = orch_client.start_job(call_id)
            except orch_client.OrchestratorError:
                raise ApiError(502, "ORCHESTRATOR_ERROR", "Orchestrator에 작업을 시작하지 못했습니다. 잠시 후 다시 시도하세요.")
        u = conn.execute(
            "UPDATE calls SET status='PROCESSING', job_key=%s, job_state=%s, error_message=NULL, "
            "retry_count = retry_count + (CASE WHEN status='FAILED' THEN 1 ELSE 0 END) "
            "WHERE call_id=%s AND status IN ('RECEIVED','FAILED') RETURNING call_id",
            (job_key, "Pending" if job_key else None, call_id)).fetchone()
        if not u:                                   # 그 사이 다른 곳에서 먼저 가져갔다
            raise ApiError(409, "INVALID_STATE", "이미 다른 곳에서 처리를 시작했습니다.")
    return {"call_id": call_id, "status": "PROCESSING", "job_key": job_key}
