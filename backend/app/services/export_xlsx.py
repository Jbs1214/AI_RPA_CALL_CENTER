"""API 7(엑셀 다운로드) 참고 구현. 통화 목록(딕셔너리 목록)을 엑셀 대장과 같은 12열 통화 목록 xlsx로 만든다."""
import io
from datetime import datetime, timedelta, timezone
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

KST = timezone(timedelta(hours=9))
HEADERS = ["관리번호", "통화일시", "담당자", "고객사", "연락처", "유형", "고객 질문 요지", "담당자 조치 내역",
           "후속조치", "AI 결과 검토 필요", "녹취 파일명", "통화 내용(숨김)"]
KEYS = ["call_id", "called_at", "agent_name", "customer_company", "customer_phone", "category", "customer_question",
        "action_taken", "follow_up_needed", "needs_review", "source_filename", "transcript"]
CELL_LIMIT = 32000          # 엑셀 한 칸 한도(32,767자)보다 작게 자른다
WIDTHS = [20, 17, 10, 14, 15, 10, 38, 38, 9, 14, 34, 20]


def to_kst_naive(v):
    """'2026-11-23T10:15:00+09:00' 같은 값을 엑셀 날짜(한국 시간, 시간대 없음)로 바꾼다."""
    d = v if isinstance(v, datetime) else datetime.fromisoformat(v)
    return d.astimezone(KST).replace(tzinfo=None)


def build_xlsx(items) -> bytes:
    wb = Workbook(); ws = wb.active; ws.title = "통화 목록"
    ws.append(HEADERS)
    for c in ws[1]:
        c.font = Font(name="Malgun Gothic", bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor="1F4E78")
        c.alignment = Alignment(horizontal="center", vertical="center")
    for it in items:
        row = []
        for k in KEYS:
            v = it.get(k)
            if k == "called_at": v = to_kst_naive(v) if v else None
            elif k in ("follow_up_needed", "needs_review"): v = None if v is None else ("Y" if v else "N")
            elif k == "transcript" and v: v = v[:CELL_LIMIT]
            row.append(v)
        ws.append(row)
    for i, w in enumerate(WIDTHS, 1):
        ws.column_dimensions[chr(64 + i)].width = w
    for r in ws.iter_rows(min_row=2, min_col=2, max_col=2):
        r[0].number_format = "yyyy-mm-dd hh:mm"
    ws.column_dimensions["L"].hidden = True
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:L{max(ws.max_row, 1)}"
    buf = io.BytesIO(); wb.save(buf); return buf.getvalue()
