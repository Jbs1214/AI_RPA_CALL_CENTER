import io, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "chat"))
from datetime import datetime
from openpyxl import load_workbook
from export_xlsx import build_xlsx, HEADERS
from data import R  # seed 15건 (튜플)

def item(r):
    cid, ca, dur, ag, co, ph, cat, q, act, hd, fu, cf, rv, fn, st, er = r
    return {"call_id": cid, "called_at": ca.replace(" ", "T") + "+09:00", "agent_name": ag, "customer_company": co,
            "customer_phone": ph, "category": cat, "customer_question": q, "action_taken": act,
            "follow_up_needed": fu == "Y" if fu else None, "needs_review": rv == "Y" if rv else None,
            "source_filename": fn, "transcript": None, "status": st}

ok = 0
def check(n, c):
    global ok; assert c, n; ok += 1; print("OK  ", n)

done = [item(r) for r in R if r[14] == "DONE"]
wb = load_workbook(io.BytesIO(build_xlsx(done))); ws = wb.active
check("헤더 12열이 엑셀 대장과 같다", [c.value for c in ws[1]] == HEADERS and ws.max_column == 12)
check("DONE 14건 + 헤더", ws.max_row == 15)
check("통화일시는 엑셀 날짜(문자열 아님)", all(isinstance(ws.cell(r, 2).value, datetime) for r in range(2, 16)))
check("한국 시간 그대로", ws.cell(2, 2).value == datetime.fromisoformat(done[0]["called_at"]).replace(tzinfo=None))
check("후속조치·검토필요는 Y/N", {ws.cell(r, 9).value for r in range(2, 16)} <= {"Y", "N"} and {ws.cell(r, 10).value for r in range(2, 16)} <= {"Y", "N"})
check("후속조치 Y 개수가 6", sum(ws.cell(r, 9).value == "Y" for r in range(2, 16)) == 6)
check("L열 숨김", ws.column_dimensions["L"].hidden)
long = dict(done[0], transcript="가" * 40000)
ws2 = load_workbook(io.BytesIO(build_xlsx([long]))).active
check("통화 내용 32,000자에서 자름", len(ws2.cell(2, 12).value) == 32000)
ws3 = load_workbook(io.BytesIO(build_xlsx([]))).active
check("0건이면 헤더만", ws3.max_row == 1 and ws3.cell(1, 1).value == "관리번호")
utc = dict(done[0], called_at="2026-11-23T01:15:00+00:00")
check("UTC 입력도 한국 시간으로", load_workbook(io.BytesIO(build_xlsx([utc]))).active.cell(2, 2).value == datetime(2026, 11, 23, 10, 15))
print(f"{ok}/{ok} 통과")
