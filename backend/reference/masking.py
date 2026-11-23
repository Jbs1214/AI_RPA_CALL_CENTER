"""개인정보 마스킹 (서버 쪽 이중 방어, 참고 구현). 1번 API(POST /api/calls)에서 customer_phone과 transcript에 적용한다.
- 전화번호: 앞 번호와 끝 4자리만 남기고 가운데를 ****로 바꾼다.  010-1234-5678 -> 010-****-5678
- 주민등록번호 형태: 전체를 가린다.  900101-1234567 -> ******-*******
- 이메일: 앞 글자 하나와 도메인만 남긴다.  kim@example.com -> k***@example.com
- 이미 마스킹된 값은 그대로 둔다(여러 번 적용해도 결과가 같다).
- 거부하지 않고 '바꿔서 저장'한다. 거부하면 봇이 그 통화를 실패로 처리하게 되기 때문이다.
"""
import re

PHONE = re.compile(r"(?<!\d)(0\d{1,2})[-.\s]?(\d{3,4})[-.\s]?(\d{4})(?!\d)")
RRN = re.compile(r"(?<!\d)\d{6}[-\s]?[1-4]\d{6}(?!\d)")
EMAIL = re.compile(r"(?<![\w.+-])([\w.+-])[\w.+-]*@([\w-]+(?:\.[\w-]+)+)")

def mask_text(text):
    if text is None: return None
    text = RRN.sub("******-*******", text)
    text = PHONE.sub(lambda m: f"{m.group(1)}-****-{m.group(3)}", text)
    return EMAIL.sub(lambda m: f"{m.group(1)}***@{m.group(2)}", text)
