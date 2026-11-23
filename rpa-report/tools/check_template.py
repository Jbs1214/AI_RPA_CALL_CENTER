# -*- coding: utf-8 -*-
"""템플릿 v2 확인: 봇처럼 통화 대장만 다시 쓰고, LibreOffice로 재계산해 요약 시트를 읽는다.
   사용: python check_template.py 템플릿.xlsx 작업폴더 [가짜JSON ...]   (JSON이 없으면 통화 대장을 비운다)"""
import sys, json, shutil, subprocess, os, datetime as dt
import openpyxl
tpl, out_dir = sys.argv[1], sys.argv[2]; mocks = sys.argv[3:]
KST = dt.timezone(dt.timedelta(hours=9))
items = []
for m in mocks: items += json.load(open(m, encoding="utf-8"))["items"]
items = [i for i in items if i["status"] == "DONE"]
items.sort(key=lambda i: dt.datetime.fromisoformat(i["called_at"]))
os.makedirs(out_dir, exist_ok=True)
work = os.path.join(out_dir, "filled.xlsx"); shutil.copy(tpl, work)
wb = openpyxl.load_workbook(work); ws = wb["통화 대장"]
for row in ws["A2:L1000"]:
    for c in row: c.value = None
yn = lambda b: "Y" if b else "N"
for n, i in enumerate(items, start=2):
    t = dt.datetime.fromisoformat(i["called_at"]).astimezone(KST).replace(tzinfo=None)
    vals = [i["call_id"], t, i["agent_name"], i["customer_company"], i["customer_phone"], i["category"], i["customer_question"],
            i["action_taken"], yn(i["follow_up_needed"]), yn(i["needs_review"]), i["source_filename"], (i.get("transcript") or "")[:32000] or None]
    for c, v in enumerate(vals, start=1): ws.cell(row=n, column=c, value=v)
    ws.cell(row=n, column=2).number_format = "yyyy-mm-dd hh:mm"
ws.tables["tblCalls"].ref = f"A1:L{max(len(items), 1) + 1}"
wb.save(work)
subprocess.run(["soffice", "--headless", "--convert-to", "xlsx", "--outdir", os.path.join(out_dir, "calc"), work], check=True, capture_output=True)
wb = openpyxl.load_workbook(os.path.join(out_dir, "calc", "filled.xlsx"), data_only=True)
d, s = wb["대시보드"], wb["요약"]
v = lambda a: s[a].value
def block(r0, r1, cols):
    rows = []
    for r in range(r0, r1 + 1):
        if v(f"A{r}") not in (None, ""):
            a = v(f"A{r}"); a = a.strftime("%m-%d") if hasattr(a, "strftime") else a
            rows.append((a,) + tuple(v(f"{c}{r}") for c in cols))
    return rows
kpi = [d[c].value for c in ("A5", "C5", "E5", "G5", "I5", "K5")]
ag, dy, cp = block(21, 30, "BCD"), block(34, 47, "BCDEFG"), block(51, 60, "BCD")
errs = [(w.title, c.coordinate, c.value) for w in (d, s) for row in w.iter_rows() for c in row
        if isinstance(c.value, str) and (c.value.startswith("#") or c.value.startswith("Err:"))]
print(f"통화 {len(items)}건 | 지표 {kpi[:4]} {round(kpi[4]*100) if isinstance(kpi[4], (int, float)) else kpi[4]}% {kpi[5]}")
print(" 담당자:", [(a, b, c) for a, b, c, _ in ag], "합", sum(r[1] for r in ag))
print(" 통화일:", [(a, g) for a, *_, g in dy], "합", sum(r[-1] for r in dy))
print(" 고객사:", [(a, b, c) for a, b, c, _ in cp], "합", sum(r[1] for r in cp))
print(" 오류 칸:", errs if errs else "없음")
