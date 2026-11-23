import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from datetime import date, datetime
from data import R
from chat_parser import parse, validate_llm_query
TODAY=date(2026,11,23)
AG=["김민수","이서연","박지훈"]; CO=["새봄물산","대한유통","(주)한국상사","(주)미래테크","청운식품"]
def run(q):
    n=0
    for r in R:
        cid,ca,dur,ag,co,ph,cat,qq,act,hd,fu,cf,rv,fn,st,er=r
        d=datetime.strptime(ca,"%Y-%m-%d %H:%M:%S").date().isoformat()
        if "category" in q and cat!=q["category"]: continue
        if "agent" in q and ag!=q["agent"]: continue
        if "company" in q and co!=q["company"]: continue
        if "follow_up" in q and (fu=="Y")!=q["follow_up"]: continue
        if "needs_review" in q and (rv=="Y")!=q["needs_review"]: continue
        if "status" in q and st!=q["status"]: continue
        if "q" in q and not any(q["q"] in (x or "") for x in (ag,co,qq,act)): continue
        if "from" in q and d<q["from"]: continue
        if "to" in q and d>q["to"]: continue
        n+=1
    return n
# (질문, 기대 intent, 기대 건수 또는 None)
CASES=[
("불만 중 후속조치 필요한 통화 보여줘","list",3),
("검토 필요한 통화 알려줘","list",2),
("김민수 담당 통화","list",5),
("후속조치 필요한 건","list",6),
("실패한 통화","list",1),
("어제 통화 몇 건이야?","stats",2),
("최근 7일 질의 건수","stats",6),
("새봄물산 불만 몇 건이야?","stats",2),
("11월 20일 건의","list",1),
("2026-11-21 통화","list",3),
("유형별 건수 보여줘","stats",None),
("담당자별 통화 현황","stats",None),
("CALL-20261123-004 보여줘","detail",None),
("검토 필요한 건 확인 완료 처리해줘","action",2),
("안녕","help",None),
("오늘 통화 몇 건이야?","stats",5),
("오류 관련 불만 통화","list",2),
("세금계산서 관련 통화","list",3),
("후속조치 필요 없는 통화","list",8),
("교육 질문 건수","stats",2),
]
ok=0
for msg,intent,cnt in CASES:
    r=parse(msg,TODAY,AG,CO)
    got=run(r["query"]) if r["intent"] in ("list","stats","action") and not r.get("breakdown") else None
    good = r["intent"]==intent and (cnt is None or got==cnt)
    ok+=good
    print(("OK  " if good else "FAIL"),msg,"->",r["intent"],r["query"],got)
print(f"{ok}/{len(CASES)} 통과")
# LLM 출력 검사
validate_llm_query({"category":"불만","follow_up":True,"from":"2026-11-17","to":"2026-11-23"})
for bad in ({"sql":"DROP"},{"category":"없는유형"},{"from":"어제"},{"follow_up":"yes"}):
    try: validate_llm_query(bad); print("FAIL 검사 통과해버림",bad)
    except (ValueError,TypeError) as e: print("OK  거부:",bad)
assert ok==len(CASES)
