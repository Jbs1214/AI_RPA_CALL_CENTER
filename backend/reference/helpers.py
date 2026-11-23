"""백엔드 참고 구현(검증용). 설계서 6장·7장 코드가 이 파일과 같다. 실제 서버 코드에 가져다 쓴다."""
import base64, hashlib, hmac, re
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))
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


def verify_orchestrator_signature(raw_body: bytes, secret: str, header_value: str | None) -> bool:
    """X-UiPath-Signature = Base64( HMAC-SHA256(비밀키, 원문 본문) ). 헤더가 없으면 거부한다."""
    if not header_value:
        return False
    expected = base64.b64encode(hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).digest()).decode()
    return hmac.compare_digest(expected, header_value)
