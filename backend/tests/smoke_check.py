"""실행 중인 서버를 HTTP로 점검한다(추가 설치 없이 python 만 있으면 된다).
사용: python tests/smoke_check.py http://localhost:8000
seed 데이터가 들어 있는 DB 기준이다. 만든 시험 데이터는 마지막에 지운다."""
import hashlib, io, json, sys, urllib.error, urllib.parse, urllib.request, uuid

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000").rstrip("/")
fails = []


def call(method, path, body=None, headers=None, raw=None, ctype=None):
    data, h = raw, dict(headers or {})
    if body is not None:
        data, h["Content-Type"] = json.dumps(body).encode("utf-8"), "application/json"
    if ctype:
        h["Content-Type"] = ctype
    path = urllib.parse.quote(path, safe="/?&=%")          # 한글 조건값은 URL 인코딩해야 보낼 수 있다
    req = urllib.request.Request(BASE + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read(), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), dict(e.headers)


def jcall(*a, **k):
    st, b, h = call(*a, **k)
    try:
        return st, json.loads(b.decode("utf-8")), h
    except Exception:
        return st, b, h


def check(name, cond, info=""):
    print(("  OK  " if cond else "  FAIL") + " " + name + ("" if cond else "  -> " + str(info)[:200]))
    if not cond:
        fails.append(name)


def multipart(fields, fname, content):
    b = "----smoke" + uuid.uuid4().hex
    out = io.BytesIO()
    for k, v in fields.items():
        out.write(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode("utf-8"))
    out.write(f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="{fname}"\r\n'
              f'Content-Type: application/octet-stream\r\n\r\n'.encode("utf-8"))
    out.write(content)
    out.write(f"\r\n--{b}--\r\n".encode("utf-8"))
    return out.getvalue(), "multipart/form-data; boundary=" + b


print("서버:", BASE)
st, d, _ = jcall("GET", "/health")
check("health 200, db ok", st == 200 and d.get("db") == "ok", d)
st, d, _ = jcall("GET", "/api/stats")
check("stats 형식(고정 5유형)", st == 200 and [c["category"] for c in d["by_category"]] == ["질의", "불만", "건의", "교육 내용", "기타 문의"], d)
seed = d["total_calls"] >= 15
st, d, _ = jcall("GET", "/api/calls?size=3")
check("목록 200, 시각 +09:00", st == 200 and d["items"] and d["items"][0]["called_at"].endswith("+09:00"), d)
st, d, _ = jcall("GET", "/api/calls?category=없는유형")
check("잘못된 값 422 + 오류 형식", st == 422 and d.get("error") == "VALIDATION_ERROR" and d.get("message"), d)
st, d, _ = jcall("GET", "/api/calls/CALL-00000000-000")
check("없는 번호 404", st == 404 and d.get("error") == "NOT_FOUND", d)
st, b, h = call("GET", "/api/calls/export")
check("엑셀 다운로드(xlsx 시그니처 PK)", st == 200 and b[:2] == b"PK" and "attachment" in h.get("content-disposition", h.get("Content-Disposition", "")), st)

# 통화 저장 → 중복 → 수정 → 삭제
fh = hashlib.sha256(uuid.uuid4().bytes).hexdigest()
payload = {"called_at": "2026-11-23T15:00:00+09:00", "agent_name": "시험담당", "customer_company": "시험고객사",
           "customer_phone": "010-1234-5678", "source_filename": "smoke.wav", "file_hash": fh, "category": "질의",
           "customer_question": "시험", "action_taken": "시험", "follow_up_needed": False, "confidence": 0.9,
           "transcript": "[고객] 010-9999-8888"}
st, d, _ = jcall("POST", "/api/calls", payload)
check("통화 저장 201", st == 201 and d.get("call_id", "").startswith("CALL-"), d)
cid = d.get("call_id")
st, d, _ = jcall("POST", "/api/calls", payload)
check("같은 파일 409 DUPLICATE_FILE", st == 409 and d.get("error") == "DUPLICATE_FILE" and d.get("existing_call_id") == cid, d)
st, d, _ = jcall("POST", "/api/calls", {**payload, "called_at": "2026-11-23T15:00:00", "file_hash": "0" * 64})
check("시간대 없으면 422", st == 422, d)
st, d, _ = jcall("GET", f"/api/calls/{cid}")
check("상세: 마스킹 저장", st == 200 and d["customer_phone"] == "010-****-5678" and "9999" not in d["transcript"], d)
st, d, _ = jcall("PATCH", f"/api/calls/{cid}", {"needs_review": None})
check("PATCH null 불리언 422", st == 422, d)
st, d, _ = jcall("PATCH", f"/api/calls/{cid}", {"follow_up_needed": True})
check("PATCH 수정", st == 200 and d["follow_up_needed"] is True, d)
st, d, _ = jcall("POST", "/api/chat", {"message": "시험담당 통화 보여줘"})
check("챗봇 규칙 방식", st == 200 and d["intent"] == "list" and d["total"] >= 1 and d["mode"] in ("rule", "ai"), d)
st, d, _ = jcall("POST", "/api/chat", {})
check("챗봇 message 없으면 422", st == 422, d)
st, b, _ = call("DELETE", f"/api/calls/{cid}")
check("삭제 204", st == 204, st)

# 음성: 올리기 → 중복 → Range → 가져가기 → 결과 → 삭제
wav = b"RIFF\x24\x00\x00\x00WAVEfmt " + uuid.uuid4().bytes * 20
raw, ct = multipart({}, "20261123_1300_시험담당_시험고객사.wav", wav)
st, d, _ = jcall("POST", "/api/recordings", raw=raw, ctype=ct)
check("음성 올리기 201 RECEIVED", st == 201 and d.get("status") == "RECEIVED" and d.get("agent_name") == "시험담당", d)
rid = d.get("call_id")
st, d, _ = jcall("POST", "/api/recordings", raw=raw, ctype=ct)
check("같은 음성 409", st == 409 and d.get("error") == "DUPLICATE_FILE", d)
raw2, ct2 = multipart({}, "memo.txt", b"hello")
st, d, _ = jcall("POST", "/api/recordings", raw=raw2, ctype=ct2)
check("txt 415", st == 415 and d.get("error") == "UNSUPPORTED_FILE", d)
st, b, h = call("GET", f"/api/calls/{rid}/audio")
check("음성 내려받기 200 바이트 일치", st == 200 and b == wav, st)
st, b, h = call("GET", f"/api/calls/{rid}/audio", headers={"Range": "bytes=0-9"})
check("Range 206", st == 206 and b == wav[:10], st)
st, d, _ = jcall("POST", f"/api/calls/{rid}/process")
check("가져가기 PROCESSING", st == 200 and d.get("status") == "PROCESSING", d)
st, d, _ = jcall("POST", f"/api/calls/{rid}/process")
check("두 번째 가져가기 409", st == 409 and d.get("error") == "INVALID_STATE", d)
st, d, _ = jcall("PUT", f"/api/calls/{rid}/result", {"status": "DONE", "category": "불만", "confidence": 0.62, "follow_up_needed": True})
check("결과 받기 + 신뢰도 낮아 검토 필요", st == 200 and d.get("status") == "DONE" and d.get("needs_review") is True, d)
st, d, _ = jcall("PUT", f"/api/calls/{rid}/result", {"status": "DONE", "category": "불만"})
check("결과 다시 보내면 409", st == 409, d)
st, b, _ = call("DELETE", f"/api/calls/{rid}")
check("시험 데이터 삭제 204", st == 204, st)
st, b, _ = call("GET", f"/api/calls/{rid}/audio")
check("삭제 후 음성 404", st == 404, st)

print("\n실패 %d건" % len(fails) if fails else "\n모두 통과")
sys.exit(1 if fails else 0)
