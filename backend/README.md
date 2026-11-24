# backend — ① 백엔드 / DB / 서버

담당: 범수, 민철

통화 분석 결과를 저장·조회하고, 음성 파일을 보관하고, UiPath Orchestrator와 연동하는 서버다. Python 3.11+, FastAPI, PostgreSQL 16, 포트 8000.

## 기준 문서

- `docs/PRD_1_백엔드_v2.md`: 요구사항(FR-B01~B18), API 13개, 환경변수, 인수 테스트 27개
- `docs/설계서_1_백엔드_v2.pdf`: DB, API 요청·응답 예시, 실행 방식, 폴더 구조
- `docs/제품요구사항정의서_v1.9.md` 7장: 다른 파트와의 데이터 계약

## 폴더 구조 (설계서 7.3의 제안)

아래는 설계서의 폴더 구조다. 실제 코드와 다른 곳은 담당자가 이 파일을 고친다.

```
backend/
  app/
    main.py            앱 시작, 오류 변환, 주기 작업 등록
    config.py          환경변수 읽기
    db.py              연결, 트랜잭션
    errors.py          {"error","message"} 형식
    routers/
      calls.py         API 1~6
      export.py        API 7 (calls.py의 {call_id}보다 먼저 등록)
      chat.py          API 8
      recordings.py    API 9~11
      orchestrator.py  API 12·13
      health.py        /health
    services/
      calls_repo.py    SQL (업서트, 상태 전이, 통계)
      storage.py       저장·삭제·경로·해시
      masking.py       전화번호·주민번호·이메일
      orch_client.py   토큰, StartJobs, Jobs 조회
      reconciler.py    1분 점검
      chat_parser.py   챗봇 규칙 해석기
      chat_ai.py       챗봇 AI 방식 + 검증
      export_xlsx.py   12열 엑셀 생성
  tests/               test_schema.sql, test_helpers.py, API 시험
  deploy/              docker-compose.yml, .env.example, backup.sh
  Dockerfile
  requirements.txt
```

`schema.sql`, `seed.sql`, `reference/`의 참고 구현은 담당자가 가지고 있는 파일을 올린다.

## 다른 파트가 이 서버에 기대하는 것

| 누가 | 무엇을 |
|---|---|
| ③ 봇 | API 1(결과 저장), 2(대기 건 조회), 10(음성 받기), 11(결과 저장), 12(가져가기) |
| ④ 봇 | API 2: `GET /api/calls?status=DONE&include_transcript=true&size=200` |
| ② 웹 | API 2~10, 12, `/health` |

서버 주소가 바뀌면 ④에게 알린다. Orchestrator Asset `BACKEND_BASE_URL`을 바꿔야 봇이 서버를 찾는다.
