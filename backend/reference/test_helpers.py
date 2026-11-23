import base64, hashlib, hmac, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from datetime import datetime
from helpers import *

ok = 0
def check(name, cond):
    global ok
    assert cond, name
    ok += 1; print("OK  ", name)

r = parse_filename("20261123_1015_박지훈_대한유통.wav")
check("파일명 파싱", r and r[0].isoformat() == "2026-11-23T10:15:00+09:00" and r[1] == "박지훈" and r[2] == "대한유통")
check("파일명 mp3 대문자", parse_filename("20261123_1015_박지훈_대한유통.MP3") is not None)
check("파일명 규칙 위반 → None", parse_filename("20261123_박지훈_대한유통.wav") is None)
check("없는 날짜 → None", parse_filename("20261340_2599_박지훈_대한유통.wav") is None)
check("경로 문자가 든 이름 → None", parse_filename("20261123_1015_../x_대한유통.wav") is None)
t = datetime.fromisoformat("2026-11-23T10:00:00+09:00")
check("저장 경로", audio_rel_path("CALL-20261123-016", "20261123_1015_박지훈_대한유통.wav", t) == "2026/11/CALL-20261123-016.wav")
check("이름 속 ../ 는 경로에 안 쓴다", audio_rel_path("CALL-20261123-016", "../../etc/passwd.wav", t) == "2026/11/CALL-20261123-016.wav")
for bad in ["x.exe", "noext", "a.wav.exe"]:
    try: audio_rel_path("CALL-20261123-016", bad, t); check("확장자 거부 "+bad, False)
    except ValueError: check("확장자 거부 "+bad, True)
try: audio_rel_path("../x", "a.wav", t); check("call_id 거부", False)
except ValueError: check("call_id 거부", True)
check("UTC 시각도 한국 날짜로", audio_rel_path("CALL-20261130-001", "a.wav", datetime.fromisoformat("2026-11-30T16:00:00+00:00")) == "2026/12/CALL-20261130-001.wav")
check("wav 머리", looks_like_audio(b"RIFF\x00\x00\x00\x00WAVEfmt ", ".wav"))
check("wav 위조 거부", not looks_like_audio(b"MZ\x90\x00" + b"\x00" * 20, ".wav"))
check("mp3 ID3", looks_like_audio(b"ID3\x04\x00", ".mp3"))
check("mp3 프레임", looks_like_audio(b"\xff\xfb\x90\x00", ".mp3"))
check("m4a", looks_like_audio(b"\x00\x00\x00\x20ftypM4A ", ".m4a"))
check("sha256 조각 합쳐도 같다", sha256_stream([b"abc", b"def"]) == hashlib.sha256(b"abcdef").hexdigest() and len(sha256_stream([b""])) == 64)
body = '{"Type":"job.completed","EventId":"e-1"}'.encode("utf-8")
sig = base64.b64encode(hmac.new(b"secret", body, hashlib.sha256).digest()).decode()
check("서명 일치", verify_orchestrator_signature(body, "secret", sig))
check("서명 불일치", not verify_orchestrator_signature(body, "other", sig))
check("본문 변조", not verify_orchestrator_signature(body + b" ", "secret", sig))
check("서명 헤더 없음", not verify_orchestrator_signature(body, "secret", None))
print(f"{ok}/{ok} 통과")
