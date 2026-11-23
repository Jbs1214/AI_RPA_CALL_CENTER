# -*- coding: utf-8 -*-
"""엑셀 템플릿 v2 만들기.
   원본(콜센터_엑셀_최종본_MVP.xlsx)의 요약 시트에서 담당자·통화일·고객사 블록을 넓히고,
   세 목록을 통화 대장에서 수식으로 뽑게 바꾼다. 차트 범위를 새 블록에 맞춘다.
   사용: python build_template.py 원본.xlsx 결과.xlsx [--dynamic]"""
import sys
from copy import copy
import openpyxl
from openpyxl.worksheet.formula import ArrayFormula
from openpyxl.workbook.defined_name import DefinedName

src, out = sys.argv[1], sys.argv[2]
dynamic = "--dynamic" in sys.argv
wb = openpyxl.load_workbook(src)
s, dash, guide = wb["요약"], wb["대시보드"], wb["안내"]
L = "'통화 대장'!"
C_AGENT, C_DATE, C_COMP, C_TYPE, C_FU, C_REV = (f"{L}${c}$2:${c}$1000" for c in "CBDFIJ")

# 원본의 서식을 기억해 둔다
st_head, st_body, st_pct = copy(s["A20"]._style), copy(s["B21"]._style), copy(s["D34"]._style)

# 20행 아래를 비운다(값과 서식)
for row in s.iter_rows(min_row=19, max_row=110, min_col=1, max_col=7):
    for c in row:
        c.value = None; c.style = "Normal"

def put(addr, value, style, fmt=None):
    c = s[addr]; c.value = value; c._style = copy(style)
    if fmt: c.number_format = fmt
    return c

# ---------- 계산용 영역(J~T열, 숨김)
N_AGENT, N_COMP, N_DATE = 30, 100, 14
s["J1"], s["K1"], s["L1"] = "계산용: 담당자(고유)", "건수", "순위"
for i in range(2, 2 + N_AGENT):
    s[f"J{i}"] = ArrayFormula(f"J{i}", f'=IFERROR(INDEX({C_AGENT},MATCH(0,COUNTIF(J$1:J{i-1},{C_AGENT})+({C_AGENT}=""),0)),"")')
    s[f"K{i}"] = f'=IF(J{i}="","",COUNTIF({C_AGENT},J{i}))'
    s[f"L{i}"] = f'=IF(J{i}="","",COUNTIF(K$2:K${1+N_AGENT},">"&K{i})+COUNTIF(K$2:K{i},K{i}))'
s["N1"], s["O1"], s["P1"], s["Q1"], s["R1"] = "계산용: 고객사(고유)", "건수", "불만", "점수", "순위"
for i in range(2, 2 + N_COMP):
    s[f"N{i}"] = ArrayFormula(f"N{i}", f'=IFERROR(INDEX({C_COMP},MATCH(0,COUNTIF(N$1:N{i-1},{C_COMP})+({C_COMP}=""),0)),"")')
    s[f"O{i}"] = f'=IF(N{i}="","",COUNTIF({C_COMP},N{i}))'
    s[f"P{i}"] = f'=IF(N{i}="","",COUNTIFS({C_COMP},N{i},{C_TYPE},"불만"))'
    s[f"Q{i}"] = f'=IF(N{i}="","",P{i}*10000+O{i})'
    s[f"R{i}"] = f'=IF(N{i}="","",COUNTIF(Q$2:Q${1+N_COMP},">"&Q{i})+COUNTIF(Q$2:Q{i},Q{i}))'
s["T1"] = "계산용: 통화일(최근부터)"
s["T2"] = f'=IF(COUNT({C_DATE})=0,"",INT(MAX({C_DATE})))'
for i in range(3, 2 + N_DATE):
    s[f"T{i}"] = ArrayFormula(f"T{i}", f'=IF(T{i-1}="","",IFERROR(1/(1/MAX(IF(ISNUMBER({C_DATE}),IF(INT({C_DATE})<T{i-1},INT({C_DATE}))))),""))')
for col in "JKLMNOPQRST":
    s.column_dimensions[col].hidden = True

# ---------- 담당자 블록: 20행 머리글, 21~30행
A0, A1 = 21, 30
for col, t in zip("ABCD", ("담당자", "통화 건수", "후속조치", "검토 필요")):
    put(f"{col}20", t, st_head)
for k, r in enumerate(range(A0, A1 + 1), start=1):
    put(f"A{r}", f'=IFERROR(INDEX($J$2:$J${1+N_AGENT},MATCH({k},$L$2:$L${1+N_AGENT},0)),"")', st_body)
    put(f"B{r}", f'=IF($A{r}="","",COUNTIF({C_AGENT},$A{r}))', st_body)
    put(f"C{r}", f'=IF($A{r}="","",COUNTIFS({C_AGENT},$A{r},{C_FU},"Y"))', st_body)
    put(f"D{r}", f'=IF($A{r}="","",COUNTIFS({C_AGENT},$A{r},{C_REV},"Y"))', st_body)

# ---------- 통화일 블록: 33행 머리글, 34~47행
D0, D1 = 34, 47
for col, t in zip("ABCDEFG", ("통화일", "질의", "불만", "건의", "교육 내용", "기타 문의", "합계")):
    put(f"{col}33", t, st_head)
for k, r in enumerate(range(D0, D1 + 1), start=1):
    put(f"A{r}", f'=IFERROR(SMALL($T$2:$T${1+N_DATE},{k}),"")', st_body, "mm-dd")
    for col in "BCDEF":
        put(f"{col}{r}", f'=IF($A{r}="","",COUNTIFS({C_DATE},">="&$A{r},{C_DATE},"<"&$A{r}+1,{C_TYPE},{col}$33))', st_body)
    put(f"G{r}", f'=IF($A{r}="","",SUM(B{r}:F{r}))', st_body)

# ---------- 고객사 블록: 50행 머리글, 51~60행
P0, P1 = 51, 60
for col, t in zip("ABCD", ("고객사", "통화 건수", "불만 건수", "불만 비율")):
    put(f"{col}50", t, st_head)
for k, r in enumerate(range(P0, P1 + 1), start=1):
    put(f"A{r}", f'=IFERROR(INDEX($N$2:$N${1+N_COMP},MATCH({k},$R$2:$R${1+N_COMP},0)),"")', st_body)
    put(f"B{r}", f'=IF($A{r}="","",COUNTIF({C_COMP},$A{r}))', st_body)
    put(f"C{r}", f'=IF($A{r}="","",COUNTIFS({C_COMP},$A{r},{C_TYPE},"불만"))', st_body)
    put(f"D{r}", f'=IF($A{r}="","",IFERROR(C{r}/B{r},0))', st_pct)

# ---------- 안내 문구
s["F2"] = "담당자, 통화일, 고객사 목록은 통화 대장에서 자동으로 만들어집니다. 이 시트에는 직접 입력하는 곳이 없습니다."
s["F3"] = "담당자는 통화가 많은 순 10명, 통화일은 통화가 있는 최근 14일, 고객사는 불만이 많은 순 10곳까지 보여 줍니다."
s["F4"] = "J열부터 T열은 목록을 만드는 계산용 칸입니다(숨김). 고치지 않습니다."
guide["B5"] = "그래프에 쓰이는 집계표입니다. 통화 대장을 세는 수식이며 직접 입력하는 곳은 없습니다. 담당자, 통화일, 고객사 목록도 자동으로 만들어집니다."
guide["B11"] = "요약 시트는 담당자 10명, 통화가 있는 최근 14일, 고객사 10곳(불만이 많은 순)까지 보여 줍니다. 통화 대장은 999건까지 셉니다."

# ---------- 차트 범위
def ref(col, r0, r1): return f"'요약'!${col}${r0}:${col}${r1}"
names = {}
if dynamic:
    def nm(name, col, r0, r1, count):
        f = f"OFFSET(요약!${col}${r0},0,0,MAX(1,{count}),1)"
        s.defined_names[name] = DefinedName(name, attr_text=f)
        return f"요약!{name}"
    n_ag = f'COUNTIF(요약!$A${A0}:$A${A1},"?*")'
    n_dt = f'COUNT(요약!$A${D0}:$A${D1})'
    n_cp = f'COUNTIF(요약!$A${P0}:$A${P1},"?*")'
    R = {("ag", c): nm(f"chtAgent{c}", c, A0, A1, n_ag) for c in "ABC"}
    R.update({("dt", c): nm(f"chtDate{c}", c, D0, D1, n_dt) for c in "ABCDEF"})
    R.update({("cp", c): nm(f"chtComp{c}", c, P0, P1, n_cp) for c in "AC"})
else:
    R = {("ag", c): ref(c, A0, A1) for c in "ABC"}
    R.update({("dt", c): ref(c, D0, D1) for c in "ABCDEF"})
    R.update({("cp", c): ref(c, P0, P1) for c in "AC"})

def setcat(ser, f):
    (ser.cat.numRef if ser.cat.numRef is not None else ser.cat.strRef).f = f
done = 0
for ch in dash._charts:
    first = ch.series[0].val.numRef.f
    if "$B$27" in first:                      # 일자별 유형 추이
        for ser, col in zip(ch.series, "BCDEF"):
            ser.tx.strRef.f = f"'요약'!{col}33"; setcat(ser, R[("dt", "A")]); ser.val.numRef.f = R[("dt", col)]
        done += 1
    elif "$B$21" in first:                    # 담당자별 통화·후속조치
        for ser, col in zip(ch.series, "BC"):
            ser.tx.strRef.f = f"'요약'!{col}20"; setcat(ser, R[("ag", "A")]); ser.val.numRef.f = R[("ag", col)]
        done += 1
    elif "$C$34" in first:                    # 고객사별 불만 건수
        ser = ch.series[0]
        ser.tx.strRef.f = "'요약'!C50"; setcat(ser, R[("cp", "A")]); ser.val.numRef.f = R[("cp", "C")]
        done += 1
assert done == 3, done
wb.save(out)
print("saved", out, "dynamic" if dynamic else "fixed")
