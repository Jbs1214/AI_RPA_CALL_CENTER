# PRD — 백엔드 / DB / 서버 인프라

생성형 AI ChatGPT와 RPA를 활용한 인공지능 비서 제작 프로젝트 중 **① 백엔드 / DB / 서버 인프라** 역할의 제품요구사항정의서.
작성일 2026-11-23 · MVP 마감 화 11/24 18:00 · 시연 수 11/25 · 상태: 초안 v1(검토 대기)

- 함께 보는 문서: `설계서_백엔드.pdf`(구조·API 상세), `schema.sql`(DB 원본), `seed.sql`(시연 데이터 15건), `test_schema.sql`(DB 검증)
- **이 문서의 범위는 ① 역할 하나다(담당: 범수, 민철).** ② 프론트·챗봇 화면(수창, 성진), ③ GenAI·STT(민영), ④ RPA 코어·보고서(주영)에 대한 요구사항은 쓰지 않았고, 이 서버가 그들에게 "무엇을 제공하는지"만 적었다. **엑셀 다운로드 API(7번)와 챗봇 API(8번)는 이 서버의 일이므로 범위에 포함한다.** 다른 역할에 요구할 내용은 이 문서가 확정된 뒤 따로 정리한다.

## 1. 개요

### 1.1 목적
통화 녹음에서 나온 상담 원문과 AI 분석 결과를 **저장·조회·관리**하고, **음성 파일을 보관**하며, **UiPath Orchestrator와 연동**해 처리 상태를 한곳에서 볼 수 있게 하는 서버를 만든다.

### 1.2 이 역할의 책임 (역할 정의서 기준)

| 책임 | 내용 | 이 문서의 요구사항 |
|---|---|---|
| API 서버 구축 | 웹 대시보드와 UiPath 봇이 부르는 REST API(통계, 목록·상세·수정·삭제, 엑셀 다운로드, 챗봇) | FR-B01~B07, B16~B18 |
| DB 설계 | 상담 원문, 분석 JSON, 처리 상태, 파일 경로 | 5절, FR-B11 |
| 음성 파일 스토리지 | 녹음 파일 업로드·보관·내려받기·삭제 | FR-B08~B10 |
| UiPath Orchestrator API 연동 | Job 실행, Webhook 수신 | FR-B12~B14 |
| 서버 환경 | 실행·배포·설정·백업 | FR-B15 |

산출물(역할 정의서): **DB 스키마, REST API, 서버 환경, UiPath 연동 모듈**.

### 1.3 범위 밖
| 구분 | 내용 |
|---|---|
| 다른 역할의 일 | 웹 화면과 챗봇 **화면**(②), STT 호출·화자 구분·마스킹 워크플로우·AI 요약/분류 프롬프트(③), RPA 봇·4시트 엑셀 대시보드 파일·큐 처리(④) |
| 이번 MVP에서 하지 않는 것 | 봇이 만든 4시트 대시보드 엑셀을 서버가 보관·다운로드시키는 기능(웹의 엑셀 다운로드는 12열 통화 목록 — FR-B16), 대화 저장형 챗봇 |
| 프로젝트 제외 사항 | 사용자 로그인(문서2 요구) |

### 1.4 서버가 하는 일 한 장 요약

```
 녹음 파일 ──(업로드)──▶ [음성 스토리지] ──▶ [DB: calls] ◀──(조회·수정)── 웹 대시보드
                              │  ▲                ▲
              (Job 시작)      ▼  │ (음성 내려받기)  │ (결과 저장)
        [Orchestrator] ◀── 서버 ──▶ UiPath 봇 ──────┘
              └──(Webhook·상태 조회)──▶ 서버가 처리 상태를 갱신
```

## 2. 이용 주체 (이 서버를 부르는 쪽)

| 이용 주체 | 하는 일 | 쓰는 API |
|---|---|---|
| 웹 대시보드 (②) | 통계, 목록·검색, 상세, 수정, 삭제, 엑셀 다운로드, 챗봇 질문, 음성 재생, 파일 올리기, 처리 시작 | 1~12 |
| UiPath 봇 (③④) | 음성 받기, 결과 저장 | 1, 2, 10, 11 |
| UiPath Orchestrator | 작업 상태 알림 | 13 (+ 서버가 먼저 Orchestrator를 호출) |
| 운영자(팀원) | 서버 상태 확인 | `/health` |

## 3. 우선순위

| 등급 | 뜻 | 기한 | 포함 |
|---|---|---|---|
| **P0** | 이것 없으면 시연 불가 | 화 12시(1·2번은 월 18시) | FR-B01~B07, B15 |
| **P1** | 엑셀 다운로드, 음성 스토리지와 처리 상태, **가져가기(API 12, `ORCH_ENABLED=false`)** | 화 18시 | FR-B16, B08~B11, B12(가져가기만) |
| **P2** | 챗봇(규칙 방식 → **AI 방식**), Orchestrator 연동 | 수 12시. 화요일 오후는 P1(엑셀·음성)에 쓰므로 챗봇은 **수요일 오전**에 **규칙 방식을 먼저** 붙이고 **이어서 AI 방식(ChatGPT)을 얹는다**. AI가 안 되면 규칙 방식으로 시연한다(Orchestrator는 시간이 모자라면 "확장 계획"으로 설명) | FR-B17, B18, B12~B14 |

P0만으로도 "결과를 저장하고 웹에서 보는" 시연은 성립한다(기존 계약 유지). P1은 문서2의 요구(엑셀 다운로드)와 음성 스토리지이며 화 18시 MVP에 들어간다. 챗봇은 문서2의 요구이고 프로젝트 주제(생성형 AI)와 직결되므로 AI 방식까지 MVP 목표이며, 일정상 수요일 오전에 규칙 방식 → AI 방식 순서로 붙인다. 시간이 모자라면 **7번(엑셀) → 9~11번(음성) → 8번(챗봇 규칙) → 8번(AI)** 순서로 먼저 만든다.

## 4. 기능 요구사항

각 항목의 "확인 방법"은 Swagger(`/docs`)나 curl로 바로 해 볼 수 있는 것이다. API 요청·응답 예시는 `설계서_백엔드.pdf` 5장.

### 4.1 P0 — 데이터 API

| ID | 요구사항 | 확인 방법 |
|---|---|---|
| FR-B01 | **통화 저장 `POST /api/calls`** (API 1). 분석 결과가 담긴 JSON을 받아 저장한다. `called_at`, `agent_name`, `source_filename`, `file_hash`는 필수(`agent_name`은 파일명에서 담당자를 못 읽은 경우 `미확인`도 허용하며, 담당자별 통계에 `미확인`으로 집계된다). `called_at`에 시간대(`+09:00`)가 없으면 422. 같은 `file_hash`가 DONE이거나 처리 중이면 409(`DUPLICATE_FILE`, `existing_call_id`), FAILED면 같은 관리번호로 덮어쓴다(201, `retry_count`+1). 유형이 5개 값에 없으면 `기타 문의`로 바꾸고 `needs_review=true`. `confidence`가 없거나 0.7 미만이면 `needs_review=true`. DONE인데 `follow_up_needed`, `needs_review`가 없으면 `false`로 채운다. `customer_phone`·`transcript`는 마스킹(전화번호·주민등록번호 형태·이메일)해서 저장한다. | 같은 요청 2번 → 201, 409 |
| FR-B02 | **목록 `GET /api/calls`** (API 2). 최신순. 조건: `q`(담당자·고객사·질문 요지·조치 내역 부분 일치), `category`, `agent`, `company`, `status`, `follow_up`, `needs_review`, `from`, `to`(한국 시간 날짜, `to` 당일 포함), `page`, `size`(기본 20, 최대 200), `include_transcript`(기본 false). | seed 기준 `from=to=2026-11-23` → 6건 |
| FR-B03 | **상세 `GET /api/calls/{call_id}`** (API 3). 모든 항목 + 대화 전체 + 신뢰도(`confidence`) + `analysis_json` + `audio_available`(음성이 있으면 true). | 없는 번호 → 404 |
| FR-B04 | **수정 `PATCH /api/calls/{call_id}`** (API 4). 보낸 항목만 바꾼다. 수정 가능: `category`, `customer_question`, `action_taken`, `follow_up_needed`, `needs_review`, `customer_company`, `customer_phone`. `category`가 5개 값 밖이거나 두 불리언에 `null`이면 422. | `{"needs_review": null}` → 422 |
| FR-B05 | **삭제 `DELETE /api/calls/{call_id}`** (API 5). 통화 행과 **음성 파일을 함께** 지운다. 204. | 삭제 후 파일도 없다 |
| FR-B06 | **통계 `GET /api/stats`** (API 6). 합계(`total_calls`, `analyzed`, `follow_up_needed`, `needs_review`, `failed`, `in_progress`)와 유형별·담당자별·일자별(유형 포함)·고객사별(불만 상위 10). 집계는 완료(DONE)된 통화만. 유형(`by_category`)은 0건이어도 5개를 항상, **고정 순서(질의, 불만, 건의, 교육 내용, 기타 문의)**로 돌려준다(건수 순이 아니다). | seed → 15 / 14 / 6 / 2 / 1 / 0 |
| FR-B07 | **공통.** 오류는 `{"error": 코드, "message": 한글}`로 통일(FastAPI 기본 422 포함). 모든 시각은 `+09:00`, DB 시간대는 `Asia/Seoul`. CORS 허용(허용 헤더에 `X-API-Key` 포함, 이 헤더가 필요 없는 API에 붙어 와도 무시한다). `GET /health`로 DB·저장소 상태 확인. | 필수값 없이 호출 → 422 + 형식 |

### 4.2 P1 — 엑셀 다운로드, 음성 스토리지와 처리 상태 (챗봇 FR-B17은 수 오전)

| ID | 요구사항 | 확인 방법 |
|---|---|---|
| FR-B16 | **엑셀 다운로드 `GET /api/calls/export`** (API 7). 2번과 같은 조건(`q`, `category`, `agent`, `company`, `follow_up`, `needs_review`, `from`, `to`)에 맞는 **분석 완료(`DONE`) 통화 전체**를 엑셀(.xlsx) 한 시트로 내려준다(`page`·`size` 없음, 없으면 헤더만). 열은 엑셀 통화 대장과 같은 12개(관리번호, 통화일시, 담당자, 고객사, 연락처, 유형, 고객 질문 요지, 담당자 조치 내역, 후속조치, AI 결과 검토 필요, 녹취 파일명, 통화 내용(숨김)). 통화일시는 **엑셀 날짜(한국 시간)**, 후속조치·검토 필요는 `Y`/`N`, 통화 내용은 32,000자에서 자르고 L열은 숨김. 파일 이름 `콜센터_통화목록_YYYYMMDD.xlsx`. 서버는 파일을 저장하지 않고 요청 때마다 만든다. **이 경로는 `/api/calls/{call_id}`보다 먼저 등록한다**(순서가 반대면 `export`가 관리번호로 읽혀 404). | 2번과 같은 조건으로 건수가 같다(seed 전체 → 14행) |
| FR-B17 | **챗봇 `POST /api/chat`** (API 8, 규칙 방식, **수요일 오전 구현**). 질문을 **조회 조건**으로 바꿔 2번·6번과 같은 조회를 하고 답한다. 질문으로 SQL을 만들지 않고, 통화를 직접 수정·삭제하지 않으며(처리 제안은 `suggested_actions` 버튼으로만 돌려주고 사용자가 누르면 화면이 4번을 부른다), 대화를 저장하지 않는다. 응답은 `reply`, `intent`(`list`·`stats`·`detail`·`action`·`help`), `mode`, `query`(실제 적용한 조건), `total`, `items`(최대 5건), `stats`, `suggested_actions`. 기본은 분석 완료(`DONE`)만 조회하고 "실패"라는 말이 있을 때만 `FAILED`를 본다. 담당자·고객사 이름은 요청 때마다 DB의 이름 목록과 대조한다. 기간 말(오늘, 어제, 이번 주=월~오늘, 최근 N일, 최근 일주일, 이번 달, `11월 20일`, `2026-11-21`)은 한국 시간 기준. 이해하지 못한 질문은 `help`로 질문 예시를 돌려준다. 해석기는 `reference/chat/chat_parser.py`(시험 20개 통과)를 그대로 쓴다. | 시연 질문 5개(설계서 5장)가 기대대로 답한다 |
| FR-B08 | **음성 올리기 `POST /api/recordings`** (API 9, multipart). 확장자 `wav`, `mp3`, `m4a`만, 최대 100MB(설정값). 서버가 SHA-256을 계산하고, 파일을 `STORAGE_DIR/YYYY/MM/<call_id>.<확장자>`에 저장한 뒤 `RECEIVED` 상태의 통화 행을 만든다. 통화일시·담당자·고객사는 입력값이 있으면 그것을, 없으면 파일명 `YYYYMMDD_HHmm_담당자_고객사.wav`에서 읽는다. 읽지 못하면 올린 시각, `미확인`. 같은 해시가 이미 있으면 DONE·RECEIVED·PROCESSING은 409, FAILED는 새 행을 만들지 않고 그 행을 `RECEIVED`로 되돌린다. 저장 경로에 **사용자가 보낸 파일 이름을 쓰지 않는다**(경로 조작 방지). | 같은 파일 2번 → 201, 409 / 이름에 `../` 포함해도 저장 위치 동일 |
| FR-B09 | **음성 내려받기 `GET /api/calls/{call_id}/audio`** (API 10). 파일을 스트리밍하고 `Range` 요청(되감기·재생)을 지원한다. 음성이 없으면 404. 정적 파일로 공개하지 않는다. | 웹의 `<audio>`가 재생 |
| FR-B10 | **결과 받기 `PUT /api/calls/{call_id}/result`** (API 11). 업로드로 들어온 통화에 분석 결과(또는 실패 사유)를 넣고 `DONE`/`FAILED`로 바꾼다. FR-B01의 값 규칙(유형 보정, 신뢰도 판정, 마스킹, 기본값)을 그대로 쓴다. `analysis_json`에 AI 응답 원본을 저장한다. 이미 DONE이면 409(`INVALID_STATE`). | 두 번 호출 → 200, 409 |
| FR-B11 | **처리 상태 관리.** 상태는 `RECEIVED → PROCESSING → DONE / FAILED`(4절 6항). 허용되지 않은 전이는 DB 조건(`WHERE status IN (...)`)이 막고 서버는 409(`INVALID_STATE`)로 응답한다. 실패한 통화는 다시 시작할 수 있다(`retry_count`+1). | 11절 인수 테스트 |

### 4.3 P2 — 챗봇 AI 방식(수 오전, 규칙 방식 다음)과 UiPath Orchestrator 연동

| ID | 요구사항 | 확인 방법 |
|---|---|---|
| FR-B18 | **챗봇 AI 방식** — API 8의 `mode=ai`. 생성형 AI가 질문을 조회 조건 JSON으로 바꾼다. AI에는 **질문 글과 한국 시간 오늘 날짜만** 보내고 통화 데이터는 보내지 않는다. AI가 돌려준 조건은 `validate_llm_query`(허용 키·값만 통과)로 검사한다. AI 키가 없거나 `CHAT_AI_TIMEOUT_SEC`(8초) 안에 답이 없거나 검사에 걸리면 **자동으로 규칙 방식으로 바꾼다**. `history`(최근 6개)는 AI 방식에서만 쓴다. 키는 환경변수로만 둔다. **시연은 규칙 방식만으로도 성립해야 한다.** | AI 키를 지워도 FR-B17의 시연 질문이 모두 동작한다 |
| FR-B12 | **Job 시작 `POST /api/calls/{call_id}/process`** (API 12). `RECEIVED`·`FAILED` 통화에 대해 Orchestrator의 `StartJobs`를 호출하고, 받은 Job Key를 `job_key`에 저장하며 상태를 `PROCESSING`으로 바꾼다. 인증 토큰은 받아서 만료 전까지 재사용한다. 설정 `ORCH_AUTO_START=true`이면 음성 업로드 직후 자동으로 시작한다. Orchestrator 호출이 실패하면 통화는 `RECEIVED`로 두고 502(`ORCHESTRATOR_ERROR`)를 돌려준다. **`ORCH_ENABLED=false`이면 Job을 만들지 않고 상태만 `PROCESSING`으로 바꾼다**(봇이 직접 가져가는 방식의 "가져가기" 표시. 이미 가져갔으면 409라서 두 봇이 같은 통화를 잡지 않는다). Job에 넘기는 값(통화 번호, 음성 주소 등)의 인자 이름은 ③④와 정한 뒤 설정한다. | Orchestrator에 Job이 생긴다 |
| FR-B13 | **작업 상태 점검(주기).** Webhook은 재전송되지 않고 놓치면 사라지며, 서버가 인터넷에서 접근 불가일 수 있으므로 **기본 수단은 서버가 먼저 묻는 방식**이다. 1분마다 `PROCESSING`인 통화 중 `ORCH_TIMEOUT_MIN`(30분) 넘게 결과가 없는 것의 Job 상태를 Orchestrator에 조회해 `job_state`를 갱신하고, 실패·중지·종료됐는데 결과가 없으면 `FAILED`(`JOB_FAULTED` / `JOB_STOPPED` / `NO_RESULT`)로 바꾼다. Orchestrator를 쓰지 않는 경우(`job_key` 없음)에는 시간만 넘으면 `FAILED`(`TIMEOUT`)로 바꾼다. | 일부러 멈춘 Job이 FAILED가 된다 |
| FR-B14 | **Webhook 수신 `POST /api/webhooks/orchestrator`** (API 13). 헤더 `X-UiPath-Signature`를 원문 본문과 비밀키(`ORCH_WEBHOOK_SECRET`)로 HMAC-SHA256 검증하고 맞지 않으면 401. `EventId`로 중복을 막고(`job_events`) `job_key`로 통화를 찾아 `job_state`와 상태를 갱신한다. 서버에 외부에서 접근할 수 없으면 이 기능은 쓰지 않고 FR-B13만으로 운영한다. | 서명이 틀리면 401, 같은 이벤트 2번이면 한 번만 반영 |

### 4.4 서버 환경

| ID | 요구사항 | 확인 방법 |
|---|---|---|
| FR-B15 | **환경.** PostgreSQL 16과 API 서버를 띄운다. **실행 방식은 둘 중 하나를 고른다(docker는 필수가 아니다):** (가) `docker compose`(제안, Docker Desktop 필요, 명령 2개로 기동) (나) 직접 설치(PostgreSQL 16 + Python 3.11+, `uvicorn`으로 실행). 두 방식 모두 같은 코드와 같은 환경변수를 쓴다. 설정은 환경변수(`.env`)로만 한다(비밀키를 코드·문서에 쓰지 않는다). 음성은 호스트 폴더를 볼륨으로 연결한다. DB는 외부 포트를 열지 않는다. 매일 DB 덤프를 남기는 백업 스크립트를 둔다. 접속 로그와 오류 로그를 파일로 남기되 대화 원문·전화번호는 로그에 쓰지 않는다. | 새 PC에서 명령 2개로 기동 |

## 5. 데이터 요구사항

원본은 `schema.sql`(PostgreSQL 16에서 `test_schema.sql`로 검증). 표는 2개.

**`calls`** — 통화 1건 = 1행

| 구분 | 컬럼 | 규칙 |
|---|---|---|
| 식별 | `call_id` | 비워서 저장하면 DB가 `CALL-20261123-016` 발급. 날짜는 통화일이 아니라 저장한 날, 번호는 계속 증가하며 비는 번호가 있을 수 있다. |
| 통화 정보 | `called_at`(필수), `agent_name`(필수), `customer_company`, `customer_phone`(마스킹된 값만) | |
| 분석 결과 | `category`(5개 값), `customer_question`, `action_taken`, `follow_up_needed`, `confidence`(0~1, ③ v0.6 기준 STT 인식 신뢰도이며 분류 정확도가 아니다), `needs_review` | 처리 중·실패는 비어 있다 |
| 원본 파일 | `source_filename`(필수), `file_hash`(필수·유일·SHA-256 64자), `audio_path`, `audio_size_bytes` | 경로는 저장소 루트 기준 상대 경로 |
| 원문·AI 원본 | `transcript`(마스킹 후, `[상담원]`/`[고객]` 줄), `analysis_json`(JSONB, AI 응답 그대로) | |
| 처리 상태 | `status`(`RECEIVED`/`PROCESSING`/`DONE`/`FAILED`), `error_message`, `retry_count` | |
| Orchestrator | `job_key`, `job_state` | |
| 기록 | `created_at`, `updated_at`(자동) | |

DB가 직접 지키는 규칙: 유형은 5개 값만 / `DONE`이면 유형·후속조치·검토필요가 반드시 있다 / `FAILED`면 실패 사유가 있다 / `RECEIVED`·`PROCESSING`이면 음성 경로가 있다 / 해시는 소문자 16진수 64자.

**`job_events`** — Orchestrator Webhook 수신 기록(`event_id` 기본키로 중복 방지, 통화가 삭제되어도 기록은 남는다).

## 6. 처리 상태

```
RECEIVED ──(API 12: Job 시작 또는 봇의 가져가기)──▶ PROCESSING ──(결과 도착)──▶ DONE
   ▲                                          │
   │                                          └─(실패·시간 초과·Job 오류)─▶ FAILED
   └──────────────(다시 시작)──────────────────────────────────────────────┘
```

- `DONE`은 끝이다. 다시 처리하려면 삭제 후 다시 올린다(MVP).
- 결과 포함 저장(API 1)으로 들어온 통화는 곧바로 `DONE`/`FAILED`로 저장된다(처리 중 단계를 거치지 않는다).
- 화면의 "분석 완료" 숫자와 통계는 `DONE`만 센다.

## 7. API 요약 (13개 + 운영 1개)

| 번호 | 경로 | 하는 일 | 우선 | 쓰는 곳 |
|---|---|---|---|---|
| 1 | `POST /api/calls` | 분석 결과 포함 통화 저장 | P0 | 봇 |
| 2 | `GET /api/calls` | 목록·검색 | P0 | 웹, 봇 |
| 3 | `GET /api/calls/{call_id}` | 상세 | P0 | 웹 |
| 4 | `PATCH /api/calls/{call_id}` | 수정 | P0 | 웹 |
| 5 | `DELETE /api/calls/{call_id}` | 삭제(음성 포함) | P0 | 웹 |
| 6 | `GET /api/stats` | 통계 | P0 | 웹 |
| 7 | `GET /api/calls/export` | 엑셀(.xlsx) 다운로드, 12열 통화 목록 | P1 | 웹 |
| 8 | `POST /api/chat` | 챗봇 질문(규칙 방식 + AI 방식) | P2(수 오전) | 웹 |
| 9 | `POST /api/recordings` | 음성 올리기 | P1 | 웹, 봇 |
| 10 | `GET /api/calls/{call_id}/audio` | 음성 내려받기·재생 | P1 | 웹, 봇 |
| 11 | `PUT /api/calls/{call_id}/result` | 처리 결과 받기 | P1 | 봇 |
| 12 | `POST /api/calls/{call_id}/process` | 가져가기(P1, 상태만 `PROCESSING`) / Orchestrator Job 시작(P2) | P1·P2 | 웹, ③ 봇 |
| 13 | `POST /api/webhooks/orchestrator` | Webhook 수신 | P2 | Orchestrator |
| — | `GET /health` | 서버·DB·저장소 상태 | P0 | 운영 |

공통 규칙: 로그인 없음, JSON(UTF-8, 업로드만 multipart), 키 이름 = 컬럼 이름(snake_case), 시각은 `+09:00`, 기간 `from`·`to`는 한국 시간 날짜이고 `to` 당일 포함. 오류 코드:

| 상태 | `error` | 언제 |
|---|---|---|
| 401 | `INVALID_SIGNATURE` | Webhook 서명 불일치 |
| 401 | `INVALID_API_KEY` | `API_KEY`가 켜져 있는데 `X-API-Key` 헤더가 없거나 틀림 |
| 404 | `NOT_FOUND` | 없는 관리번호, 음성 없음 |
| 409 | `DUPLICATE_FILE` | 같은 파일이 이미 있다(`existing_call_id`, `existing_status` 포함) |
| 409 | `INVALID_STATE` | 지금 상태에서는 할 수 없는 작업 |
| 413 | `FILE_TOO_LARGE` | 파일이 한도 초과 |
| 415 | `UNSUPPORTED_FILE` | 허용하지 않는 확장자나 내용 |
| 422 | `VALIDATION_ERROR` | 필수값 누락, 형식·값 오류 |
| 502 | `ORCHESTRATOR_ERROR` | Orchestrator 호출 실패(통화는 그대로) |

## 8. 비기능 요구사항

| 구분 | 요구 | 비고 |
|---|---|---|
| 규모 | 시연 20~100건, 동시 접속 10명 이하 | 아래 수치는 설계 목표이며 아직 측정하지 않았다 |
| 응답 속도 | 목록·통계·상세 1초 이내(1,000건 기준), 음성 100MB 업로드 60초 이내(같은 내부망) | 구현 후 실측해서 갱신 |
| 저장 용량 | 음성은 대략 분당 1~2MB(wav, 8~16kHz 16bit 모노 가정) → 100건×5분 ≈ 0.5~1GB. 디스크 여유 5GB 이상 | 실제 녹음 샘플로 다시 계산 |
| 보안 | 음성에는 **마스킹 전 개인정보**(목소리, 말한 번호)가 있다. 저장 폴더 권한은 서버 계정만, API 외 경로로 공개하지 않는다. 서버는 내부 네트워크에서만 접근시킨다. 비밀키는 환경변수. 로그에 개인정보를 쓰지 않는다. | 사용자 로그인은 문서2에 따라 만들지 않는다 |
| 시스템 호출 보호 | 음성 올리기·내려받기·결과 저장에 공용 키 헤더(`X-API-Key`)를 선택적으로 켤 수 있다(`API_KEY` 비워 두면 꺼짐). Webhook은 HMAC 서명으로 보호. | **시연까지 끈다**(내부망 한정, 음성은 시연 후 삭제). 켜는 것은 버퍼 과제 |
| 가용성·복구 | 서버 재시작 후 `PROCESSING`인 통화는 FR-B13이 정리한다. DB 덤프 일 1회, 음성 폴더 복사 | |
| 시간대 | DB `Asia/Seoul`, 서버 컨테이너 `TZ=Asia/Seoul` | |
| 문서화 | Swagger(`/docs`)가 항상 최신 | 월 18시 1차 공유 |

## 9. 환경·설정값 (환경변수)

| 이름 | 기본값 | 뜻 |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL 접속 |
| `STORAGE_DIR` | `/data/recordings` | 음성 저장소 루트 |
| `MAX_UPLOAD_MB` | 100 | 업로드 한도 |
| `ALLOWED_EXT` | `wav,mp3,m4a` | 허용 확장자 |
| `CONFIDENCE_THRESHOLD` | 0.7 | 검토 필요 판정 기준 |
| `API_KEY` | 비움 | 값이 있으면 음성 관련 3개 API에 `X-API-Key` 요구 |
| `CORS_ORIGINS` | `*` | 시연 후 웹 주소로 좁힌다 |
| `CHAT_AI_ENABLED` | false | 챗봇 AI 방식 켜기(키 확인 후 true. 꺼 두면 규칙 방식만) |
| `CHAT_AI_API_KEY`, `CHAT_AI_MODEL` | — | 챗봇 AI 방식에 쓸 생성형 AI 키·모델(키는 코드·문서에 쓰지 않는다) |
| `CHAT_AI_TIMEOUT_SEC` | 8 | 이 시간 안에 답이 없으면 규칙 방식으로 대체 |
| `ORCH_ENABLED` | false | Orchestrator 연동 켜기 |
| `ORCH_AUTO_START` | false | 업로드 직후 Job 자동 시작 |
| `ORCH_BASE_URL` | — | Orchestrator 주소 |
| `ORCH_IDENTITY_URL` | — | 토큰 발급 주소 |
| `ORCH_CLIENT_ID`, `ORCH_CLIENT_SECRET`, `ORCH_SCOPE` | — | 외부 앱 인증 정보 |
| `ORCH_FOLDER_ID` | — | 폴더 ID |
| `ORCH_RELEASE_KEY` | — | 시작할 프로세스 키 |
| `ORCH_START_STRATEGY` | `ModernJobsCount` | 폴더 종류에 따라 다름(확인 필요) |
| `ORCH_WEBHOOK_SECRET` | — | Webhook 서명 비밀키 |
| `ORCH_TIMEOUT_MIN` | 30 | 이 시간 넘게 결과 없으면 점검 대상 |

docker를 쓸 때만 필요한 값: `DB_PASSWORD`(DB 비밀번호), `RECORDINGS_HOST_DIR`(음성을 둘 호스트 폴더). `DATABASE_URL`과 `STORAGE_DIR`은 compose 파일이 컨테이너에 넣어 준다(`deploy/docker-compose.yml`). 직접 설치할 때는 이 두 값을 환경변수로 직접 지정한다.

## 10. 일정

| 시각 | 해야 할 일 | 나오는 것 |
|---|---|---|
| 11/23(월) 오후 | 서버 뼈대, DB 연결, `schema.sql`·`seed.sql` 적용, 오류 형식·시간대, FR-B01·B02, `/health`, 서버 실행 환경 | 18시 Swagger 공유 |
| 11/24(화) 오전 | FR-B03~B06 | 12시 P0 완료 |
| 11/24(화) 오후 | FR-B16 엑셀, FR-B08~B11 음성·결과·상태, **FR-B12 가져가기(③이 화 오후 흐름 B에서 사용)** | 18시 MVP(P0+P1) 완료 |
| 11/25(수) 오전 | **FR-B17 챗봇(규칙) → FR-B18 챗봇 AI 방식**, FR-B12(Job 시작)·B13·B14 Orchestrator, 실측·버그 수정 | 12시 기능 동결, 시연 데이터 적재 |

## 10-1. 담당 분담 (제안)

역할 ①은 1~2명이 맡는다. 아래는 민철·범수 2명으로 나눈 **제안**이며, 팀이 정하면 바꾼다. "공동"은 둘이 함께 확인한다.

| 담당 | 맡는 것 | 요구사항 |
|---|---|---|
| **민철** (서버·연동) | 서버 뼈대(FastAPI, 설정, 오류 형식, 시간대, CORS), 통화 저장·목록·통계, **챗봇(API 8, 수 오전)**, 서버 실행 환경과 봇 PC 접속 확인(서버는 범수 PC, 민철은 자기 PC에서 개발하고 코드를 합친다), Orchestrator 연동 | FR-B01, B02, B06, B07, B15, B17, B18, B12, B13, B14 |
| **범수** (DB·데이터) | DB 설계와 적용·관리(`schema.sql`, `seed.sql`, `test_schema.sql`), 상세·수정·삭제, **엑셀 다운로드(API 7)**, 음성 스토리지와 처리 상태·결과 받기, 백업 | FR-B03, B04, B05, B16, B08, B09, B10, B11 (+ 5절 데이터) |
| **공동** | Swagger 공유와 최신 유지, 인수 테스트 27개 수행, 코드 리뷰, Q1·Q2 확인 결과 반영 | 11절 |

- 공통 코드(DB 연결, `calls` 모델, 오류 형식)는 민철이 월요일 오전 뼈대에 먼저 넣고, 범수는 그 위에 `routers/calls.py`의 3~5번과 `routers/recordings.py`를 붙인다.
- 항목 이름(컬럼·JSON 키)을 바꾸는 일은 `schema.sql`과 설계서를 **함께** 고칠 때만 한다.
- 이 서버를 쓰는 다른 역할(②·③·④)과의 협의는 이 표의 담당자가 아니라 **API 번호의 담당자**가 맡는다(예: 음성 내려받기는 범수, Job 시작은 민철).

## 11. 완료 기준 (인수 테스트)

| # | 시험 | 기대 결과 |
|---|---|---|
| 1 | seed 적재 후 `GET /api/stats` | 총 15, 분석 14, 후속조치 6, 검토 필요 2, 실패 1, 처리 중 0 |
| 2 | 같은 결과를 `POST /api/calls` 2번 | 201, 409(`existing_call_id` 포함) |
| 3 | FAILED로 저장한 파일을 정상 결과로 다시 `POST /api/calls` | 201, 같은 `call_id`, `retry_count`=1 |
| 4 | `called_at`을 `+09:00` 없이 저장 | 422 |
| 5 | `transcript`에 `010-1234-5678`, 이메일 포함 | 조회 시 `010-****-5678`, `k***@도메인` |
| 6 | `from=2026-11-23&to=2026-11-23` | 11-23 하루 6건(실패 1건 포함) |
| 7 | `{"needs_review": null}`로 수정 | 422 |
| 8 | 통화 삭제 | 204, 음성 파일도 없다 |
| 9 | 음성 업로드 | 201, `status=RECEIVED`, 파일이 `YYYY/MM/<call_id>.<ext>`에 저장, 해시 일치 |
| 10 | 같은 음성 다시 업로드 | 409. FAILED였다면 `RECEIVED`로 복귀 |
| 11 | 파일명 `../../x.wav`로 업로드 | 저장 위치는 규칙 경로, 이름은 `source_filename`에만 |
| 12 | 허용하지 않는 확장자, 한도 초과 | 415, 413 |
| 13 | `GET .../audio` (Range 포함) | 200/206, 재생 가능 |
| 14 | `PUT .../result` 2번 | 200, 409(`INVALID_STATE`) |
| 15 | 처리 시작 후 결과 없이 `ORCH_TIMEOUT_MIN` 초과(P2) | 점검이 Job 상태를 조회해 `FAILED`로 정리 |
| 16 | Webhook 서명 틀림 / 같은 EventId 2번(P2) | 401 / 한 번만 반영 |
| 17 | 새 PC에서 서버 기동(docker compose 또는 직접 실행) | `/health` 정상, `/docs` 열림 |
| 18 | DB 재시작 | 데이터 유지 |
| 19 | `psql -f test_schema.sql` | `ALL PASS` (이미 통과) |
| 20 | `GET /api/calls/export` (조건 없음, seed) | 200, 헤더 12열 + 14행(분석 완료만). 파일 이름 `콜센터_통화목록_YYYYMMDD.xlsx` |
| 21 | 같은 조건으로 2번(`status=DONE`)과 7번 비교 | 건수가 같다. 통화일시는 엑셀 날짜, 후속조치·검토 필요는 `Y`/`N` |
| 22 | `/api/calls/export` 경로 | 404가 아니라 200 (`/{call_id}`보다 먼저 등록됨) |
| 23 | 챗봇 "불만 중 후속조치 필요한 통화 보여줘" | `intent=list`, `total=3`, `mode=rule` |
| 24 | 챗봇 "새봄물산 불만 몇 건이야?" | `intent=stats`, `total=2` |
| 25 | 챗봇 "검토 필요한 건 확인 완료 처리해줘" | `intent=action`, `suggested_actions` 2개, DB는 그대로 |
| 26 | 챗봇 "안녕" | `intent=help`, `reply`에 질문 예시 |
| 27 | `reference/chat/test_chat.py`(20개), `reference/test_export_xlsx.py`(10개) | 모두 통과 (이미 통과) |

## 12. 리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
| Orchestrator가 클라우드(Automation Cloud)인데 서버가 내부 PC다 | Webhook이 서버에 도달하지 못함 | 서버가 먼저 묻는 점검(FR-B13)을 기본으로 한다. 서버→Orchestrator는 바깥으로 나가는 호출이라 가능. Webhook은 터널(공개 주소)이 될 때만 |
| Orchestrator 종류(클라우드/온프레미스), 폴더 종류, 외부 앱 권한 미확인 | Job 시작 호출이 막힘 | 월 18시까지 확인. 안 되면 P2를 시연에서 빼고 P0·P1으로 시연 |
| 음성 파일에 개인정보 원본 | 유출 시 피해 | 폴더 권한, 비공개 경로, 내부망 한정, 선택적 API 키, 시연 후 삭제 |
| 시간 부족 | 마감 전 미완 | P0 → P1 → P2 순서로 자르고 P2는 포기 가능. P1 안에서는 7번 → 8번(규칙) → 9~11번 순 |
| 챗봇이 질문을 잘못 해석 | 엉뚱한 답 | 적용한 조건(`query`)을 화면에 항상 보여 주어 사용자가 확인한다. 시연 질문 5개는 미리 고정. 이해 못 하면 `help` |
| 챗봇을 만들 시간이 모자람 | AI 없는 챗봇 또는 챗봇 없이 시연 | 수 오전에 규칙 방식을 먼저 붙이고 AI 방식을 얹는다. 민철이 화요일에 규칙 방식을 먼저 시작해도 된다(엑셀·음성은 범수 담당). AI가 안 되면 규칙 방식으로 시연 |
| 챗봇 AI 키 없음·지연 | AI 방식 불가 | AI 키는 화 12시까지 확인하고, 응답이 8초 안에 없으면 자동으로 규칙 방식으로 대체 |
| 서버 PC가 꺼지거나 네트워크가 바뀜 | 시연 중단 | 시연 노트북에 같은 구성을 미리 올려 두고 백업 덤프로 복원 |
| 다른 역할이 기존 API 계약(1~8번)을 이미 사용 중 | 변경 시 연쇄 수정 | 1~8번의 요청·응답 형식은 유지하고 항목만 추가(`analysis_json`, `audio_available`, `in_progress`, `existing_status`) |

## 13. 확인이 필요한 것과 제안

| # | 확인할 것 | 제안 | 기한 |
|---|---|---|---|
| Q1 | Orchestrator 환경(Automation Cloud / 온프레미스), 폴더 종류, 외부 앱(Client ID·Secret, 권한 범위) 발급 | 이 확인 결과로 `ORCH_*` 값과 토큰 주소를 정한다 | 월 18시 |
| Q2 | 서버를 어디서 띄우나 | **범수 PC 한 대(서버+DB)** — 민철 PC는 C 드라이브 여유가 약 9.7GB라 개발만 한다. 수요일은 시연 노트북으로 이동 | 월 18시 |
| Q3 | 봇이 음성을 어떻게 받나: 서버에서 내려받기(API 10) vs 폴더에서 직접 읽기 | 서버 내려받기가 기본. 폴더 방식도 API 1로 계속 동작 | ③④와 협의 (다음 단계) |
| Q4 | `X-API-Key`를 켤지 | **시연까지 끈다**(켜는 것은 버퍼 과제) | 확정 |
| Q5 | 음성 보관 기간 | **시연 후 삭제(확정)**. 운영이면 30일 보관 후 삭제 배치를 추가 | 확정 |
| Q6 | 챗봇 AI 방식에 쓸 ChatGPT API 키가 있고 테스트 호출이 되는지 | 안 되면 AI 방식은 하지 않고 규칙 방식으로 시연. 확인은 민영(③) | 화 12시 |
| Q7 | 웹의 엑셀 다운로드가 12열 통화 목록이면 충분한지(봇의 4시트 대시보드 파일 내려주기는 이번에 하지 않음) | 12열 통화 목록으로 진행 | 화 12시 |

## 14. 참고

- UiPath Orchestrator API: `POST .../odata/Jobs/UiPath.Server.Configuration.OData.StartJobs`(본문 `startInfo`에 `ReleaseKey`, `InputArguments`(JSON 문자열) 등), 폴더는 `X-UIPATH-OrganizationUnitId` 헤더, 토큰은 client_credentials 방식. 출처: UiPath 문서(Orchestrator API Guide, Jobs requests)와 UiPath 커뮤니티 예시.
- UiPath Webhooks: 서명은 비밀키와 본문의 HMAC-SHA256, 헤더 `X-UiPath-Signature`(Base64). 이벤트에는 `Type`(예 `job.created`)과 `EventId`가 있다. **Webhook 이벤트는 저장·재전송되지 않아 호출이 실패하면 사라진다**(UiPath 문서).
- 위 외부 사양은 문서·예시 기준이다. 실제 환경의 값과 페이로드 항목은 Q1 확인 후 샘플 1건으로 대조한다.
