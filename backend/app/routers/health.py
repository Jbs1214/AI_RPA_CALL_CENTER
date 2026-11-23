"""/health: DB·저장소 상태."""
import shutil
from datetime import datetime
from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from .. import config
from ..db import connect
from ..services.logic import KST, iso

router = APIRouter()


# ======================= /health =======================
@router.get("/health", tags=["운영"], summary="서버 상태")
def health():
    db_ok = True
    try:
        with connect() as conn:
            conn.execute("SELECT 1")
    except Exception:
        db_ok = False
    storage: dict[str, Any] = {"writable": False, "free_gb": None}
    try:
        config.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        probe = config.STORAGE_DIR / ".health"
        probe.write_text("ok")
        probe.unlink()
        storage = {"writable": True, "free_gb": round(shutil.disk_usage(config.STORAGE_DIR).free / 1024 ** 3, 1)}
    except Exception:
        pass
    ok = db_ok and storage["writable"]
    body = {"status": "ok" if ok else "error", "db": "ok" if db_ok else "error", "storage": storage,
            "orchestrator": {"enabled": config.ORCH_ENABLED}, "time": iso(datetime.now(KST))}
    return JSONResponse(body, status_code=200 if ok else 503)
