# -*- coding: utf-8 -*-
"""엑셀 쓰기 규칙 검증용 참고 구현(봇은 UiPath로 만든다. 이 스크립트는 규칙과 기대값 확인용).
   가짜 JSON -> 통화 대장 다시 쓰기 -> LibreOffice로 수식 재계산 -> 요약·대시보드 값 읽기"""
import sys, json, shutil, subprocess, os, datetime as dt
import openpyxl
tpl, out_dir = sys.argv[1], sys.argv[2]; mocks = sys.argv[3:]
KST = dt.timezone(dt.timedelta(hours=9))
items = []
for m in mocks:
    items += json.load(open(m, encoding="utf-8"))["items"]
items = [i for i in items if i["status"] == "DONE"]
items.sort(key=lambda i: dt.datetime.fromisoformat(i["called_at"]))     # 오래된 통화가 위
os.makedirs(out_dir, exist_ok=True)
work = os.path.join(out_dir, "filled.xlsx"); shutil.copy(tpl, work)
wb = openpyxl.load_workbook(work); ws = wb["통화 대장"]
for row in ws["A2:L1000"]:                                               # 데이터 행의 값만 지운다
    for c in row: c.value = None
yn = lambda b: "Y" if b else "N"
for n, i in enumerate(items, start=2):
    t = dt.datetime.fromisoformat(i["called_at"]).astimezone(KST).replace(tzinfo=None)   # 한국 시간, 시간대 제거
    vals = [i["call_id"], t, i["agent_name"], i["customer_company"], i["customer_phone"], i["category"],
            i["customer_question"], i["action_taken"], yn(i["follow_up_needed"]), yn(i["needs_review"]),
            i["source_filename"], (i.get("transcript") or "")[:32000] or None]
    for c, v in enumerate(vals, start=1): ws.cell(row=n, column=c, value=v)
    ws.cell(row=n, column=2).number_format = "yyyy-mm-dd hh:mm"
ws.tables["tblCalls"].ref = f"A1:L{len(items)+1}"
wb.save(work)
subprocess.run(["soffice", "--headless", "--convert-to", "xlsx", "--outdir", os.path.join(out_dir, "calc"), work],
               check=True, capture_output=True)
wb = openpyxl.load_workbook(os.path.join(out_dir, "calc", "filled.xlsx"), data_only=True)
d, s, L = wb["대시보드"], wb["요약"], wb["통화 대장"]
print("행 수:", len(items), "| 최대 통화 내용 길이:", max(len(L.cell(row=r, column=12).value or "") for r in range(2, len(items)+2)))
print("대시보드:", {d[c].offset(row=-1).value: d[c].value for c in ("A5","C5","E5","G5","I5","K5")})
print("유형별:", {s.cell(row=r, column=1).value: s.cell(row=r, column=2).value for r in range(12, 17)})
print("담당자별(건수,후속):", {s.cell(row=r, column=1).value: (s.cell(row=r, column=2).value, s.cell(row=r, column=3).value) for r in range(21, 24)}, "-> 합", sum(s.cell(row=r, column=2).value for r in range(21, 24)))
print("일자별 합계:", {str(s.cell(row=r, column=1).value)[:10]: s.cell(row=r, column=7).value for r in range(27, 31)}, "-> 합", sum(s.cell(row=r, column=7).value for r in range(27, 31)))
print("고객사(건수,불만):", {s.cell(row=r, column=1).value: (s.cell(row=r, column=2).value, s.cell(row=r, column=3).value) for r in range(34, 39)}, "-> 합", sum(s.cell(row=r, column=2).value for r in range(34, 39)))
print("통화일시 예:", [str(L.cell(row=r, column=2).value) for r in (2, len(items)+1)])
