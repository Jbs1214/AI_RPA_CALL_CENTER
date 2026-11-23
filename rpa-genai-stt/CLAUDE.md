# rpa-genai-stt 지침 (초안)

담당자(민영)가 확인하고 고친다. 아래는 `docs/설계서_3_GenAI_STT_v0.8.pdf`에서 옮긴 규칙이다. 공통 규칙은 루트의 `CLAUDE.md`에 있다.

## 참고할 곳

- 처리 단계와 실패 코드: 설계서 3장
- 호출하는 API와 응답 처리: 설계서 4.2
- 결과 JSON과 큐 항목: 설계서 5장, `docs/제품요구사항정의서_v1.7.md` 7.1·7.3

## 규칙

- 결과 JSON의 키 이름은 서버 API 요청 본문과 같게 쓴다.
- 전화번호, 주민등록번호 형태, 이메일은 생성형 AI에 보내기 전에 마스킹한다.
- 실패해도 결과를 서버에 저장한다(`status=FAILED`, `error_message="코드: 사유"`). 실패 코드는 5종(`STT_FAILED`, `STT_TIMEOUT`, `EMPTY_TRANSCRIPT`, `LLM_FAILED`, `INVALID_OUTPUT`)만 쓴다.
- 큐에는 서버 저장에 성공한 뒤에만 넣는다. 409와 422에서는 넣지 않는다.
- 큐 항목의 SpecificContent는 키 13개를 항상 모두 넣고, 값은 모두 문자열로, 없으면 빈 문자열로 넣는다. `transcript`와 `analysis_json`은 넣지 않는다.
- 서버 연결 실패와 5xx는 5초 간격으로 3회 재시도한다. 그래도 안 되면 결과 JSON을 `output/unsent`에 두고 다음 실행 때 다시 보낸다.
- 가져가기 방식에서는 봇이 처리 시작 API를 부른다. Job으로 시작됐을 때는 부르지 않고 Job 인자로 받은 주소를 쓴다.
- 서버 주소, API 키, CLOVA 주소와 키는 Orchestrator Asset에서 읽는다. 워크플로우와 문서에 쓰지 않는다.
- `transcript`, 전화번호, 마스킹 전 텍스트를 로그에 쓰지 않는다.
- 음성 파일, `output/`, `done/`, `failed/`는 커밋하지 않는다.
