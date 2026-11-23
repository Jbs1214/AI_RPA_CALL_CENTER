"""파일 이름 해석, 저장 경로, 내용 확인, 해시."""
import hashlib, re
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .. import config
from ..errors import ApiError

KST = timezone(timedelta(hours=9))
MIME = {".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4"}
ALLOWED_EXT = {".wav", ".mp3", ".m4a"}
_FILENAME = re.compile(r"^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})_([^_/\\\\]+)_([^_/\\\\]+)\.(wav|mp3|m4a)$", re.I)
_CALL_ID = re.compile(r"^CALL-\d{8}-\d{3,}$")


def parse_filename(name: str):
    """'YYYYMMDD_HHmm_담당자_고객사.wav' -> (called_at, agent, company). 규칙에 안 맞으면 None."""
    m = _FILENAME.match(name)
    if not m:
        return None
    y, mo, d, h, mi, agent, company, _ = m.groups()
    try:
        called_at = datetime(int(y), int(mo), int(d), int(h), int(mi), tzinfo=KST)
    except ValueError:
        return None
    return called_at, agent.strip(), company.strip()


def audio_rel_path(call_id: str, original_name: str, saved_at: datetime) -> str:
    """저장 경로. 사용자가 보낸 파일 이름은 확장자만 쓴다(경로 조작 방지)."""
    if not _CALL_ID.match(call_id):
        raise ValueError("call_id 형식 오류")
    ext = "." + original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""
    if ext not in ALLOWED_EXT:
        raise ValueError("허용하지 않는 확장자")
    return f"{saved_at.astimezone(KST):%Y/%m}/{call_id}{ext}"


def looks_like_audio(head: bytes, ext: str) -> bool:
    """앞부분 바이트로 확장자와 내용이 맞는지 확인(완전한 검증은 아니다)."""
    ext = ext.lower()
    if ext == ".wav":
        return head[:4] == b"RIFF" and head[8:12] == b"WAVE"
    if ext == ".mp3":
        return head[:3] == b"ID3" or (len(head) > 1 and head[0] == 0xFF and (head[1] & 0xE0) == 0xE0)
    if ext == ".m4a":
        return head[4:8] == b"ftyp"
    return False


def sha256_stream(chunks) -> str:
    h = hashlib.sha256()
    for c in chunks:
        h.update(c)
    return h.hexdigest()


def storage_path(rel: str) -> Path:
    """저장소 밖으로 나가는 경로는 거부한다."""
    root = config.STORAGE_DIR.resolve()
    p = (root / rel).resolve()
    if root != p and root not in p.parents:
        raise ApiError(404, "NOT_FOUND", "음성 파일이 없습니다.")
    return p
