# -*- coding: utf-8 -*-
"""엑셀 최종본의 통화 대장 14건을 서버 목록 응답(GET /api/calls) 모양의 가짜 JSON으로 바꾼다."""
import sys, json, hashlib, datetime as dt
import openpyxl
src, out_main, out_edge = sys.argv[1], sys.argv[2], sys.argv[3]
ws = openpyxl.load_workbook(src)["통화 대장"]
KST = dt.timezone(dt.timedelta(hours=9))
items = []
for r in ws.iter_rows(min_row=2, values_only=True):
    if not r[0]:
        continue
    cid, called, agent, comp, phone, cat, q, act, fu, nr, fname, tr = r[:12]
    called = called.replace(tzinfo=KST)
    saved = called + dt.timedelta(minutes=6)
    items.append({
        "call_id": cid,
        "called_at": called.isoformat(timespec="seconds"),
        "agent_name": agent, "customer_company": comp, "customer_phone": phone,
        "category": cat, "customer_question": q, "action_taken": act,
        "follow_up_needed": fu == "Y", "needs_review": nr == "Y",
        "source_filename": fname,
        "file_hash": hashlib.sha256(cid.encode()).hexdigest(),   # 가짜 값(모양만 맞춤)
        "status": "DONE", "error_message": None, "retry_count": 0,
        "audio_available": False, "job_state": None,
        "created_at": saved.isoformat(timespec="seconds"),
        "updated_at": saved.isoformat(timespec="seconds"),
        "transcript": tr,
    })
items.sort(key=lambda x: x["called_at"], reverse=True)          # 서버는 최신순으로 준다
json.dump({"total": len(items), "page": 1, "size": 200, "items": items},
          open(out_main, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

def item(cid, called, agent, comp, cat, q, act, fu, nr, **kw):
    d = {"call_id": cid, "called_at": called, "agent_name": agent, "customer_company": comp,
         "customer_phone": None, "category": cat, "customer_question": q, "action_taken": act,
         "follow_up_needed": fu, "needs_review": nr, "source_filename": cid + ".wav",
         "file_hash": hashlib.sha256(cid.encode()).hexdigest(), "status": "DONE",
         "error_message": None, "retry_count": 0, "audio_available": True, "job_state": None,
         "created_at": called, "updated_at": called, "transcript": "[상담원] 안녕하세요.\n[고객] 문의드립니다."}
    d.update(kw); return d
edge = [
    item("CALL-20261124-001", "2026-11-24T00:10:00+09:00", "김민수", "대한유통", "질의", "자정 직후 통화(날짜 경계 확인)", "안내 완료", False, False),
    item("CALL-20261124-002", "2026-11-23T15:30:00+00:00", "이서연", "새봄물산", "불만", "UTC로 온 시각(한국 시간 11-24 00:30)", "사과 후 재확인 약속", True, False),
    item("CALL-20261124-003", "2026-11-24T09:00:00+09:00", "미확인", "미확인", "기타 문의", "파일명에서 담당자와 고객사를 읽지 못한 통화", "내용 확인 필요", False, True),
    item("CALL-20261124-004", "2026-11-24T10:00:00+09:00", "최하늘", "한빛상사", "건의", "새 담당자와 새 고객사(요약 목록에 없는 이름)", "건의 접수", True, False, customer_phone="010-****-7788"),
    item("CALL-20261124-005", "2026-11-24T11:00:00+09:00", "박지훈", "(주)미래테크", "교육 내용", "통화 내용이 32,000자를 넘는 통화", "교육 자료 발송", False, False,
         transcript="\n".join(f"[상담원] 긴 통화 내용 {i:05d}번째 줄입니다." for i in range(1500))),
    item("CALL-20261124-006", "2026-11-24T12:00:00+09:00", "김민수", "청운식품", "질의", "연락처·대화가 비어 있는 통화", "안내 완료", False, False, transcript=None),
]
edge.sort(key=lambda x: x["called_at"], reverse=True)
json.dump({"total": len(edge), "page": 1, "size": 200, "items": edge},
          open(out_edge, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(len(items), "건 /", len(edge), "건, 긴 대화 길이:", len(edge[[e['call_id'] for e in edge].index('CALL-20261124-005')]['transcript']))
