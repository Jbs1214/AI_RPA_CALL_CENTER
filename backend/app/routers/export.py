"""API 7: 엑셀(.xlsx) 다운로드. main.py 에서 calls 라우터보다 먼저 등록한다(/{call_id} 로 읽히지 않게)."""
import urllib.parse
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from ..db import connect
from ..deps import common_filters
from ..services.export_xlsx import build_xlsx
from ..services.logic import ITEM_COLS, KST, to_item, where_sql

router = APIRouter()


@router.get("/api/calls/export", tags=["통화"], summary="엑셀(.xlsx) 다운로드")
def export_calls(f: dict = Depends(common_filters)):
    f = {**f, "status": "DONE"}                    # 분석 완료 통화만
    where, args = where_sql(f)
    with connect() as conn:
        rows = conn.execute(
            f"SELECT {ITEM_COLS}, transcript FROM calls {where} ORDER BY called_at DESC, call_id DESC", args
        ).fetchall()
    data = build_xlsx([{**to_item(r), "transcript": r["transcript"]} for r in rows])
    name = f"콜센터_통화목록_{datetime.now(KST):%Y%m%d}.xlsx"
    disp = f"attachment; filename=\"calls_{datetime.now(KST):%Y%m%d}.xlsx\"; filename*=UTF-8''{urllib.parse.quote(name)}"
    return Response(data, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": disp})
