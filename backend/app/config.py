"""설정. 모두 환경변수(.env)에서 읽는다. 비밀키를 코드에 쓰지 않는다."""
import os
from pathlib import Path


def _load_env_file() -> None:
    """작업 폴더의 .env 를 읽어 환경변수에 넣는다(이미 있는 환경변수가 우선)."""
    p = Path(os.environ.get("ENV_FILE", ".env"))
    if not p.is_file():
        return
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
            v = v[1:-1]
        os.environ.setdefault(k, v)


_load_env_file()


def _s(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _b(name: str, default: bool = False) -> bool:
    v = _s(name)
    return default if v == "" else v.lower() in ("1", "true", "yes", "on")


def _n(name: str, default: float) -> float:
    try:
        return float(_s(name) or default)
    except ValueError:
        return default


DATABASE_URL = _s("DATABASE_URL", "postgresql://callcenter:callcenter@localhost:5432/callcenter")
STORAGE_DIR = Path(_s("STORAGE_DIR", "./recordings"))
MAX_UPLOAD_MB = int(_n("MAX_UPLOAD_MB", 100))
# 올릴 수 있는 확장자. 서버가 내용을 확인할 수 있는 wav, mp3, m4a 안에서만 줄일 수 있다
ALLOWED_EXT = ["." + e.strip().lower().lstrip(".") for e in _s("ALLOWED_EXT", "wav,mp3,m4a").split(",") if e.strip()]
CONFIDENCE_THRESHOLD = _n("CONFIDENCE_THRESHOLD", 0.7)
API_KEY = _s("API_KEY")                      # 비어 있으면 키 검사를 하지 않는다
CORS_ORIGINS = [o.strip() for o in (_s("CORS_ORIGINS") or "*").split(",") if o.strip()]

CHAT_AI_ENABLED = _b("CHAT_AI_ENABLED", False)
CHAT_AI_API_KEY = _s("CHAT_AI_API_KEY")
CHAT_AI_BASE_URL = _s("CHAT_AI_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
CHAT_AI_MODEL = _s("CHAT_AI_MODEL", "llama-3.3-70b-versatile")
CHAT_AI_TIMEOUT_SEC = _n("CHAT_AI_TIMEOUT_SEC", 8)

ORCH_ENABLED = _b("ORCH_ENABLED", False)
ORCH_BASE_URL = _s("ORCH_BASE_URL").rstrip("/")
ORCH_IDENTITY_URL = _s("ORCH_IDENTITY_URL").rstrip("/")
ORCH_CLIENT_ID = _s("ORCH_CLIENT_ID")
ORCH_CLIENT_SECRET = _s("ORCH_CLIENT_SECRET")
ORCH_SCOPE = _s("ORCH_SCOPE", "OR.Jobs OR.Execution OR.Folders OR.Machines")
ORCH_FOLDER_ID = _s("ORCH_FOLDER_ID")
ORCH_RELEASE_KEY = _s("ORCH_RELEASE_KEY")
ORCH_START_STRATEGY = _s("ORCH_START_STRATEGY", "ModernJobsCount")
ORCH_TIMEOUT_MIN = int(_n("ORCH_TIMEOUT_MIN", 30))
# 봇 PC에서 접속되는 서버 주소. 기본값을 두지 않는다: 비어 있으면 Job 시작이 502로 바로 실패해 설정 누락을 알 수 있다
PUBLIC_BASE_URL = _s("PUBLIC_BASE_URL").rstrip("/")
