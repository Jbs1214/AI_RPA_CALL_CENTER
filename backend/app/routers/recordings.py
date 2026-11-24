"""API 9~11: 음성 올리기·내려받기, 처리 결과 받기. 음성 파일은 저장소에만 두고 정적 경로로 공개하지 않는다."""
import hashlib
import logging
import os
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Optional

import psycopg
from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import Response, StreamingResponse
from psycopg.types.json import Jsonb

from .. import config
from ..db import connect
from ..deps import check_key
from ..errors import ApiError, validation_error
from ..models import AnalysisIn
from ..services.calls_repo import NEXT_ID_SQL
from ..services.logic import KST, clean, iso, parse_range, prepare_analysis, require_tz
from ..services.storage import MIME, audio_rel_path, looks_like_audio, parse_filename, storage_path

log = logging.getLogger("app")
router = APIRouter()


# ======================= API 9: 음성 올리기 =======================
def _parse_input_time(v: Optional[str]) -> Optional[datetime]:
    v = clean(v)
    if v is None:
        return None
    try:
        return require_tz(datetime.fromisoformat(v.replace("Z", "+00:00")))
    except ValueError:
        raise validation_error("called_at 형식이 올바르지 않습니다(예: 2026-11-23T10:15:00+09:00).")


@router.post("/api/recordings", status_code=201, tags=["음성"], summary="음성 올리기")
def upload_recording(request: Request, file: UploadFile = File(...), called_at: Optional[str] = Form(None),
                     agent_name: Optional[str] = Form(None), customer_company: Optional[str] = Form(None)):
    check_key(request)
    original = (file.filename or "").replace("\\", "/").split("/")[-1].strip()
    ext = ("." + original.rsplit(".", 1)[-1].lower()) if "." in original else ""
    allowed = [e for e in config.ALLOWED_EXT if e in MIME]
    if ext not in allowed:
        raise ApiError(415, "UNSUPPORTED_FILE", ", ".join(e[1:] for e in allowed) + " 파일만 올릴 수 있습니다.")
    given_time = _parse_input_time(called_at)
    max_bytes = config.MAX_UPLOAD_MB * 1024 * 1024

    tmp_dir = config.STORAGE_DIR / ".tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(dir=tmp_dir, suffix=ext)
    dest: Optional[Path] = None
    try:
        h, size, head = hashlib.sha256(), 0, b""
        with os.fdopen(fd, "wb") as out:
            while True:
                chunk = file.file.read(1024 * 1024)
                if not chunk:
                    break
                if not head:
                    head = chunk[:16]
                size += len(chunk)
                if size > max_bytes:
                    raise ApiError(413, "FILE_TOO_LARGE", f"파일이 한도({config.MAX_UPLOAD_MB}MB)를 넘습니다.")
                h.update(chunk)
                out.write(chunk)
        if size == 0:
            raise validation_error("빈 파일입니다.")
        if not looks_like_audio(head, ext):
            raise ApiError(415, "UNSUPPORTED_FILE", "파일 내용이 확장자와 맞지 않습니다.")
        digest = h.hexdigest()

        parsed = parse_filename(original)
        old_rel: Optional[str] = None
        retry_count = 0

        try:
            with connect() as conn:
                ex = conn.execute("SELECT call_id, status, called_at, agent_name, customer_company, audio_path "
                                  "FROM calls WHERE file_hash = %s FOR UPDATE", (digest,)).fetchone()
                if ex and ex["status"] != "FAILED":
                    raise ApiError(409, "DUPLICATE_FILE", "이미 저장된 파일입니다. 삭제한 뒤 다시 올려 주세요.",
                                   existing_call_id=ex["call_id"], existing_status=ex["status"])
                if ex:                              # FAILED 였던 같은 파일: 새 행 없이 그 행을 RECEIVED 로 되돌린다
                    # 입력값 → 파일명 → 기존 행의 값 (못 읽었다고 기존 값을 '미확인'으로 덮지 않는다)
                    when = given_time or (parsed[0] if parsed else ex["called_at"])
                    agent = clean(agent_name) or (parsed[1] if parsed else ex["agent_name"])
                    company = clean(customer_company) or (parsed[2] if parsed else ex["customer_company"] or "미확인")
                    call_id, old_rel = ex["call_id"], ex["audio_path"]
                    rel = audio_rel_path(call_id, original, datetime.now(KST))
                    retry_count = conn.execute(
                        "UPDATE calls SET status='RECEIVED', error_message=NULL, called_at=%s, agent_name=%s, "
                        "customer_company=%s, source_filename=%s, audio_path=%s, audio_size_bytes=%s, "
                        "job_key=NULL, job_state=NULL, retry_count=retry_count + 1 "
                        "WHERE call_id=%s AND status='FAILED' RETURNING retry_count",
                        (when, agent, company, original[:255], rel, size, call_id)).fetchone()["retry_count"]
                else:
                    when = given_time or (parsed[0] if parsed else datetime.now(KST))
                    agent = clean(agent_name) or (parsed[1] if parsed else "미확인")
                    company = clean(customer_company) or (parsed[2] if parsed else "미확인")
                    call_id = conn.execute(NEXT_ID_SQL).fetchone()["call_id"]
                    rel = audio_rel_path(call_id, original, datetime.now(KST))
                    conn.execute(
                        "INSERT INTO calls (call_id, called_at, agent_name, customer_company, source_filename, "
                        "file_hash, audio_path, audio_size_bytes, status) "
                        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'RECEIVED')",
                        (call_id, when, agent, company, original[:255], digest, rel, size))
                dest = config.STORAGE_DIR / rel
                dest.parent.mkdir(parents=True, exist_ok=True)
                os.replace(tmp_name, dest)          # 같은 폴더 안이라 즉시 이동. 실패하면 행도 되돌아간다.
        except psycopg.errors.UniqueViolation:      # 같은 파일을 동시에 올린 경우
            dest = None
            with connect() as conn:
                ex = conn.execute("SELECT call_id, status FROM calls WHERE file_hash = %s", (digest,)).fetchone()
            raise ApiError(409, "DUPLICATE_FILE", "이미 저장된 파일입니다. 삭제한 뒤 다시 올려 주세요.",
                           existing_call_id=ex["call_id"] if ex else None, existing_status=ex["status"] if ex else None)
        except BaseException:
            if dest is not None and rel != old_rel:
                dest.unlink(missing_ok=True)        # 행 저장이 실패하면 옮긴 파일도 지운다(기존 행의 파일은 남긴다)
            raise
        if old_rel and old_rel != rel:              # 다시 올리며 경로가 바뀌었으면(월·확장자) 예전 파일을 지운다
            try:
                storage_path(old_rel).unlink(missing_ok=True)
            except Exception as e:
                log.error("예전 음성 파일 삭제 실패(%s): %s", call_id, type(e).__name__)
        return {"call_id": call_id, "status": "RECEIVED", "called_at": iso(when), "agent_name": agent,
                "customer_company": company, "source_filename": original[:255], "file_hash": digest,
                "audio_size_bytes": size, "retry_count": retry_count, "job_started": False}
    finally:
        try:
            os.unlink(tmp_name)                      # 옮겨졌다면 이미 없다
        except FileNotFoundError:
            pass


# ======================= API 10: 음성 내려받기 =======================
def _iter_file(path: Path, start: int, end: int, chunk: int = 1024 * 1024):
    remaining = end - start + 1
    with open(path, "rb") as f:
        f.seek(start)
        while remaining > 0:
            data = f.read(min(chunk, remaining))
            if not data:
                break
            remaining -= len(data)
            yield data


@router.get("/api/calls/{call_id}/audio", tags=["음성"], summary="음성 내려받기·재생(Range 지원)")
def get_audio(call_id: str, request: Request):
    check_key(request, allow_query=True)
    with connect() as conn:
        r = conn.execute("SELECT audio_path FROM calls WHERE call_id = %s", (call_id,)).fetchone()
    if not r or not r["audio_path"]:
        raise ApiError(404, "NOT_FOUND", "음성 파일이 없습니다.")
    path = storage_path(r["audio_path"])
    if not path.is_file():
        raise ApiError(404, "NOT_FOUND", "음성 파일이 없습니다.")
    size = path.stat().st_size
    rng = parse_range(request.headers.get("range"), size)
    headers = {"Accept-Ranges": "bytes"}
    if rng == "bad":
        return Response(status_code=416, headers={**headers, "Content-Range": f"bytes */{size}"})
    if rng is None:
        start, end, code = 0, size - 1, 200
    else:
        start, end = rng
        code = 206
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"
    headers["Content-Length"] = str(max(end - start + 1, 0))
    return StreamingResponse(_iter_file(path, start, end), status_code=code, headers=headers,
                             media_type=MIME.get(path.suffix.lower(), "application/octet-stream"))


# ======================= API 11: 결과 받기 =======================
@router.put("/api/calls/{call_id}/result", tags=["처리"], summary="처리 결과 받기(봇)")
def put_result(call_id: str, body: AnalysisIn, request: Request):
    check_key(request)
    a = prepare_analysis(body.model_dump(), config.CONFIDENCE_THRESHOLD)
    a["analysis_json"] = Jsonb(a["analysis_json"]) if a["analysis_json"] is not None else None
    with connect() as conn:
        r = conn.execute(
            "UPDATE calls SET status=%(status)s, category=%(category)s, customer_question=%(customer_question)s, "
            "action_taken=%(action_taken)s, follow_up_needed=%(follow_up_needed)s, needs_review=%(needs_review)s, "
            "confidence=%(confidence)s, transcript=COALESCE(%(transcript)s::text, transcript), "
            "analysis_json=COALESCE(%(analysis_json)s::jsonb, analysis_json), error_message=%(error_message)s "
            "WHERE call_id=%(call_id)s AND status IN ('RECEIVED','PROCESSING','FAILED') "
            "RETURNING call_id, status, needs_review", {**a, "call_id": call_id}).fetchone()
        if not r:
            ex = conn.execute("SELECT 1 FROM calls WHERE call_id = %s", (call_id,)).fetchone()
            if not ex:
                raise ApiError(404, "NOT_FOUND", "없는 관리번호입니다.")
            raise ApiError(409, "INVALID_STATE", "이미 완료된 통화라서 결과를 다시 받을 수 없습니다.")
    out = {"call_id": r["call_id"], "status": r["status"]}
    if r["status"] == "DONE":
        out["needs_review"] = r["needs_review"]
    return out
