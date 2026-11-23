"""콜센터 AI·RPA 비서 백엔드. 실행: uvicorn app.main:app --host 0.0.0.0 --port 8000
앱 시작, 로그, CORS, 오류 형식 변환, 라우터 등록만 한다. API 는 routers/, 규칙·SQL·도구는 services/ 에 있다."""
import logging
from pathlib import Path

import psycopg
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import config
from .errors import ApiError
from .routers import calls, chat, export, health, orchestrator, recordings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("app")


class _DropQuery(logging.Filter):
    """접속 로그에서 ?뒤(검색어, api_key)를 지운다. uvicorn 접속 로그 인자: (주소, 메서드, 경로, 버전, 상태)."""
    def filter(self, r: logging.LogRecord) -> bool:
        if isinstance(r.args, tuple) and len(r.args) >= 3 and isinstance(r.args[2], str):
            r.args = (*r.args[:2], r.args[2].split("?", 1)[0], *r.args[3:])
        return True


def _file_logs(log_dir: Path = Path("logs")) -> None:
    """접속 로그(logs/access.log)와 오류 로그(logs/error.log)를 파일로도 남긴다.
    접속 로그는 메서드·경로·상태만 남는다(요청 본문·쿼리 = 대화 원문·전화번호·키는 남지 않는다)."""
    log_dir.mkdir(exist_ok=True)
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    access = logging.FileHandler(log_dir / "access.log", encoding="utf-8")
    access.setFormatter(fmt)
    access_log = logging.getLogger("uvicorn.access")
    access_log.addFilter(_DropQuery())
    access_log.addHandler(access)
    error = logging.FileHandler(log_dir / "error.log", encoding="utf-8")
    error.setLevel(logging.WARNING)
    error.setFormatter(fmt)
    for name in ("", "uvicorn.error"):                # 앱 로그(루트) + uvicorn 오류
        logging.getLogger(name).addHandler(error)


_file_logs()

app = FastAPI(title="콜센터 AI·RPA 비서 API", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"],
                   expose_headers=["Content-Disposition", "Content-Range", "Accept-Ranges"])

# ======================= 오류 형식 =======================
@app.exception_handler(ApiError)
async def _api_error(_: Request, e: ApiError):
    return JSONResponse(e.body(), status_code=e.status)


@app.exception_handler(RequestValidationError)
async def _validation(_: Request, e: RequestValidationError):
    errs = e.errors()
    if not errs:
        msg = "요청 형식이 올바르지 않습니다."
    else:
        err = errs[0]
        loc = ".".join(str(x) for x in err.get("loc", ()) if x not in ("body", "query", "path")) or "요청"
        if err.get("type") == "missing":
            msg = f"필수값이 없습니다: {loc}"
        elif err.get("type") == "value_error" and err.get("ctx", {}).get("error"):
            msg = str(err["ctx"]["error"])          # 직접 만든 검사 문구는 그대로
        else:
            msg = f"{loc}: 값의 형식이 올바르지 않습니다."   # pydantic 영어 문구는 넣지 않는다
    return JSONResponse({"error": "VALIDATION_ERROR", "message": msg}, status_code=422)


@app.exception_handler(StarletteHTTPException)
async def _http(_: Request, e: StarletteHTTPException):
    code = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}.get(e.status_code, "HTTP_ERROR")
    msg = "없는 주소입니다." if e.status_code == 404 else "허용되지 않는 요청입니다."
    return JSONResponse({"error": code, "message": msg}, status_code=e.status_code)


@app.exception_handler(psycopg.OperationalError)
async def _db_down(_: Request, e: psycopg.OperationalError):
    log.error("DB 연결 오류: %s", type(e).__name__)
    return JSONResponse({"error": "DB_UNAVAILABLE", "message": "데이터베이스에 연결할 수 없습니다."}, status_code=503)


@app.exception_handler(Exception)
async def _unexpected(_: Request, e: Exception):
    log.exception("처리 중 오류(%s)", type(e).__name__)   # 요청 내용은 로그에 남기지 않는다
    return JSONResponse({"error": "INTERNAL_ERROR", "message": "서버 오류가 발생했습니다."}, status_code=500)


# ======================= 라우터 =======================
# export 는 calls 보다 먼저 등록한다. 반대면 /api/calls/export 가 /api/calls/{call_id} 로 읽혀 404 가 된다.
for r in (export, calls, chat, recordings, orchestrator, health):
    app.include_router(r.router)
