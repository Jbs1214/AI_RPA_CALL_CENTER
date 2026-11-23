"""API 1~6: 통화 저장·목록·상세·수정·삭제, 통계."""
import logging
import re

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from psycopg.types.json import Jsonb

from .. import config
from ..db import connect
from ..deps import common_filters, date_filters
from ..errors import ApiError, validation_error
from ..models import CallIn, CallPatch
from ..services.calls_repo import UPSERT_SQL, compute_stats, get_item
from ..services.logic import CATEGORIES, ITEM_COLS, clean, prepare_analysis, require_tz, to_item, where_sql
from ..services.masking import mask_text
from ..services.reconciler import expire_stuck
from ..services.storage import storage_path

log = logging.getLogger("app")
router = APIRouter()


# ======================= API 1: 통화 저장 =======================
@router.post("/api/calls", status_code=201, tags=["통화"], summary="통화 저장(결과 포함)")
def create_call(body: CallIn):
    require_tz(body.called_at)
    # prd.md R1: API 1은 FAILED에 실패 사유가 없으면 422로 돌려보낸다.
    # API 11(결과 받기)은 봇이 실패 처리되지 않게 기본 사유를 넣는 기존 방식(logic.prepare_analysis)을 그대로 쓴다.
    if (body.status or "DONE") == "FAILED" and not clean(body.error_message):
        raise validation_error("FAILED에는 error_message가 필요합니다.")
    agent = clean(body.agent_name)
    filename = clean(body.source_filename)
    if not agent or not filename:
        raise validation_error("agent_name과 source_filename은 비어 있을 수 없습니다.")
    fh = body.file_hash.strip().lower()
    if not re.fullmatch(r"[0-9a-f]{64}", fh):
        raise validation_error("file_hash는 SHA-256(소문자 16진수 64자)이어야 합니다.")
    a = prepare_analysis(body.model_dump(), config.CONFIDENCE_THRESHOLD)
    params = {
        **a,
        "called_at": body.called_at, "agent_name": agent, "source_filename": filename[:255], "file_hash": fh,
        "customer_company": clean(body.customer_company),
        "customer_phone": mask_text(clean(body.customer_phone)),
        "analysis_json": Jsonb(a["analysis_json"]) if a["analysis_json"] is not None else None,
    }
    with connect() as conn:
        row = conn.execute(UPSERT_SQL, params).fetchone()
        if row:
            return {"call_id": row["call_id"], "status": a["status"]}
        ex = conn.execute("SELECT call_id, status FROM calls WHERE file_hash = %s", (fh,)).fetchone()
    raise ApiError(409, "DUPLICATE_FILE", "이미 저장된 파일입니다.",
                   existing_call_id=ex["call_id"] if ex else None, existing_status=ex["status"] if ex else None)


# ======================= API 2: 목록 =======================
@router.get("/api/calls", tags=["통화"], summary="통화 목록·검색")
def list_calls(f: dict = Depends(common_filters), page: int = Query(1, ge=1), size: int = Query(20, ge=1),
               include_transcript: bool = Query(False)):
    size = min(size, 200)
    where, args = where_sql(f)
    cols = ITEM_COLS + (", transcript" if include_transcript else "")
    with connect() as conn:
        expire_stuck(conn)
        total = conn.execute(f"SELECT COUNT(*) AS n FROM calls {where}", args).fetchone()["n"]
        rows = conn.execute(
            f"SELECT {cols} FROM calls {where} ORDER BY called_at DESC, call_id DESC LIMIT %s OFFSET %s",
            args + [size, (page - 1) * size]).fetchall()
    return {"total": total, "page": page, "size": size,
            "items": [to_item(r, with_transcript=include_transcript) for r in rows]}


# ======================= API 3, 4, 5 =======================
@router.get("/api/calls/{call_id}", tags=["통화"], summary="통화 상세")
def get_call(call_id: str):
    with connect() as conn:
        return get_item(conn, call_id, detail=True)


@router.patch("/api/calls/{call_id}", tags=["통화"], summary="통화 수정")
def patch_call(call_id: str, body: CallPatch):
    sent = {k: getattr(body, k) for k in body.model_fields_set}
    if not sent:
        raise validation_error("수정할 항목이 없습니다.")
    if "category" in sent and sent["category"] not in CATEGORIES:
        raise validation_error("category는 질의, 불만, 건의, 교육 내용, 기타 문의 중 하나여야 합니다.")
    for k in ("follow_up_needed", "needs_review"):
        if k in sent and sent[k] is None:
            raise validation_error(f"{k}는 true 또는 false여야 합니다(null 불가).")
    for k in ("customer_question", "action_taken", "customer_company", "customer_phone"):
        if k in sent:
            sent[k] = clean(sent[k])
    if sent.get("customer_phone"):
        sent["customer_phone"] = mask_text(sent["customer_phone"])
    for k in ("customer_question", "action_taken"):
        if sent.get(k):
            sent[k] = mask_text(sent[k])
    cols = list(sent)                              # body 모델에 있는 항목만 들어오므로 열 이름은 안전하다
    sets = ", ".join(f"{c} = %s" for c in cols)
    with connect() as conn:
        r = conn.execute(f"UPDATE calls SET {sets} WHERE call_id = %s RETURNING call_id",
                         [sent[c] for c in cols] + [call_id]).fetchone()
        if not r:
            raise ApiError(404, "NOT_FOUND", "없는 관리번호입니다.")
        return get_item(conn, call_id)


@router.delete("/api/calls/{call_id}", status_code=204, tags=["통화"], summary="통화 삭제(음성 포함)")
def delete_call(call_id: str):
    with connect() as conn:
        r = conn.execute("DELETE FROM calls WHERE call_id = %s RETURNING audio_path", (call_id,)).fetchone()
    if not r:
        raise ApiError(404, "NOT_FOUND", "없는 관리번호입니다.")
    if r["audio_path"]:
        try:
            storage_path(r["audio_path"]).unlink(missing_ok=True)
        except Exception as e:                      # 행은 이미 지워졌다. 남은 파일은 나중에 정리한다.
            log.error("음성 파일 삭제 실패(%s): %s", call_id, type(e).__name__)
    return Response(status_code=204)


# ======================= API 6: 통계 =======================
@router.get("/api/stats", tags=["통계"], summary="통계")
def stats(f: dict = Depends(date_filters)):
    with connect() as conn:
        expire_stuck(conn)
        return compute_stats(conn, f)
