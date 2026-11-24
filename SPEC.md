# 파트 사이 계약 요약

네 파트가 서로 맞춰야 하는 것만 한곳에 모았다. 원본은 `docs/제품요구사항정의서_v2.1.md` 7장과 8장이고, 이 파일과 다르면 통합본이 맞다. 계약을 바꾸려면 통합본을 먼저 고친 뒤 이 파일을 맞춘다.

## 1. 누가 누구에게 무엇을

| 주는 쪽 | 받는 쪽 | 무엇을 | 원본 |
|---|---|---|---|
| ③ 봇 | ① 서버 | 통화 1건의 분석 결과(API 1 또는 11) | 통합본 7.1 |
| ① 서버 | ② 웹 | 목록, 상세, 통계, 음성, 엑셀(12열), 챗봇 답 | 백엔드 설계서 5장 |
| ① 서버 | ④ 봇 | 완료 통화 목록(API 2) | 통합본 7.5 |
| ④ | ③ | Asset `BACKEND_BASE_URL`·`BACKEND_API_KEY` | 통합본 7.4 |
| ④ | ① | 외부 앱의 Client ID와 Secret(직접 전달), ③ 프로세스 키 | 통합본 7.4 |
| ① | ④ | 서버 주소 | 통합본 11.1 |

## 2. 공통 값

| 항목 | 값 |
|---|---|
| 유형 | `질의`, `불만`, `건의`, `교육 내용`, `기타 문의` (띄어쓰기까지 같아야 한다) |
| 처리 상태 | `RECEIVED`(대기) → `PROCESSING`(처리 중) → `DONE`(완료) / `FAILED`(실패) |
| 시각 | `2026-11-23T10:15:00+09:00`. 시간대가 없으면 서버가 422로 거절한다. |
| 파일명 규칙 | `YYYYMMDD_HHmm_담당자_고객사.wav` (wav, mp3, m4a) |
| 읽지 못한 담당자·고객사 | `미확인` |
| 관리번호 | 서버가 발급한다. 예: `CALL-20261123-016` |
| 마스킹 형태 | 전화번호 `010-****-1234`, 이메일 `k***@도메인`, 이름 `김○○` |
| 실패 사유 | `error_message`는 `코드: 설명` 형식 |

실패 코드: ③은 `STT_FAILED`, `STT_TIMEOUT`, `EMPTY_TRANSCRIPT`, `LLM_FAILED`, `INVALID_OUTPUT`. ①은 `TIMEOUT`.

## 3. 서버 API

| 번호 | 경로 | 하는 일 | 우선 | 쓰는 곳 |
|---|---|---|---|---|
| 1 | `POST /api/calls` | 분석 결과 포함 통화 저장 | P0 | ③ |
| 2 | `GET /api/calls` | 목록·검색 | P0 | ② ③ ④ |
| 3 | `GET /api/calls/{call_id}` | 상세 | P0 | ② |
| 4 | `PATCH /api/calls/{call_id}` | 수정 | P0 | ② |
| 5 | `DELETE /api/calls/{call_id}` | 삭제(음성 포함) | P0 | ② |
| 6 | `GET /api/stats` | 통계 | P0 | ② |
| 7 | `GET /api/calls/export` | 엑셀 다운로드(12열 통화 목록) | P1 | ② |
| 8 | `POST /api/chat` | 챗봇 질문(조회 전용) | P2 | ② |
| 9 | `POST /api/recordings` | 음성 올리기 | P1 | ② (봇도 쓸 수 있다) |
| 10 | `GET /api/calls/{call_id}/audio` | 음성 내려받기·재생 | P1 | ② ③ |
| 11 | `PUT /api/calls/{call_id}/result` | 처리 결과 받기 | P1 | ③ |
| 12 | `POST /api/calls/{call_id}/process` | 가져가기(P1) / Job 시작(P2) | P1·P2 | ② ③ |
| — | `GET /health` | 서버·DB·저장소 상태 | P0 | 운영, ② |

요청·응답 예시는 `docs/설계서_1_백엔드_v2.pdf` 5장이 원본이다. Webhook 수신(API 13)과 Job 상태 조회(6.3)는 뺐다(통합본 2장). PDF와 `docs/PRD_1_백엔드_v3.md`가 다르면 PRD가 맞다.

**API 12를 부르는 쪽**: 가져가기(`ORCH_ENABLED=false`)에서는 ③ 봇만 부른다. Job 시작(`true`)에서는 웹의 "처리 시작" 버튼만 부르고, ③ 봇은 Job 인자(`in_call_id`, `in_audio_url`, `in_result_url`)로 음성 주소를 받는다. 웹은 `GET /health`의 `orchestrator.enabled`가 `true`일 때만 버튼을 보여 준다.

## 4. 결과 JSON (③ → ①)

키 이름은 서버 요청 본문과 같다: `called_at`, `agent_name`, `customer_company`, `customer_phone`, `source_filename`, `file_hash`, `transcript`, `category`, `customer_question`, `action_taken`, `follow_up_needed`, `confidence`, `analysis_json`, `status`, `error_message`.

- 필수 4개: `called_at`, `agent_name`, `source_filename`, `file_hash`. 실패 건도 채운다.
- 웹에서 올린 음성(API 11)에서는 `called_at`, `agent_name`, `customer_company`, `source_filename`, `file_hash`를 보내지 않는다.
- `transcript`는 `[상담원] …` / `[고객] …` 줄 형식이다.
- 서버는 저장하면서 값을 보정한다(유형 보정, 검토 필요 판정, 마스킹). 웹과 엑셀은 서버에 저장된 값을 쓴다.

필드별 규칙은 통합본 7.1, 서버의 보정 규칙은 7.2.

## 5. 큐 항목 (삭제)

통합본 v2.0에서 없앴다(강사 피드백, 11/24). ③과 ④ 사이에 주고받는 데이터는 없다. ③은 서버에 저장하고, ④는 시간 트리거로 1분마다 실행되어 서버 목록(API 2)을 읽는다. 장 번호는 다시 매기지 않는다.

## 6. Orchestrator

| 항목 | 값 |
|---|---|
| 폴더 | `Shared`. Asset, ③과 ④의 프로세스를 모두 여기에 둔다. |
| ③ 프로세스 | `CallCenter_GenAI_STT` |
| ④ 프로세스 | `CallCenter_RPA_Report`. 시간 트리거로 1분마다 실행한다. |

| Asset | 형식 | 만드는 사람 | 쓰는 봇 |
|---|---|---|---|
| `BACKEND_BASE_URL` | Text | ④ (값은 ①에게서) | ③ ④ |
| `BACKEND_API_KEY` | Text | ④ (값은 ①에게서) | ③ ④ |
| `CLOVA_INVOKE_URL` | Text | ③ | ③ |
| `CLOVA_SECRET_KEY` | Secret | ③ | ③ |

`X-API-Key`는 시연까지 꺼져 있다. ③은 모든 호출에 헤더를 붙이므로 `BACKEND_API_KEY`에는 비어 있지 않은 임시 값을 넣는다.

## 7. 엑셀

파일은 두 종류다.

| 파일 | 만드는 곳 | 내용 | 받는 방법 |
|---|---|---|---|
| `콜센터_통화목록_YYYYMMDD.xlsx` | ① 서버(API 7) | 12열 통화 목록 한 시트 | 웹의 "엑셀 다운로드" 버튼 |
| `콜센터_엑셀_최신.xlsx` | ④ 봇 | 대시보드·요약·통화 대장·안내 4시트 | ④가 직접 전달 |

통화 대장 12열(두 파일이 같다):

| 열 | 머리글 | 서버 항목 | 변환 |
|---|---|---|---|
| A | 관리번호 | `call_id` | |
| B | 통화일시 | `called_at` | 한국 시간의 엑셀 날짜 값 |
| C | 담당자 | `agent_name` | |
| D | 고객사 | `customer_company` | |
| E | 연락처 | `customer_phone` | |
| F | 유형 | `category` | |
| G | 고객 질문 요지 | `customer_question` | |
| H | 담당자 조치 내역 | `action_taken` | |
| I | 후속조치 | `follow_up_needed` | `Y`/`N` |
| J | AI 결과 검토 필요 | `needs_review` | `Y`/`N` |
| K | 녹취 파일명 | `source_filename` | |
| L | 통화 내용(숨김) | `transcript` | 32,000자에서 자른다 |

완료(`DONE`)된 통화만 들어간다.

## 8. 지표 (웹 카드 = 엑셀 대시보드)

| 지표 | 계산 |
|---|---|
| 분석된 통화 | 완료(`DONE`) 건수 |
| 후속조치 필요 | 완료 건 중 `follow_up_needed`가 참 |
| AI 결과 검토 필요 | 완료 건 중 `needs_review`가 참 |
| 불만 통화 | 유형이 `불만`인 건수 |
| 불만 비율 | 불만 통화 ÷ 분석된 통화. 0건이면 0%. 정수로 반올림 |
| 가장 많은 유형 | 건수가 가장 큰 유형. 동률이면 유형 고정 순서에서 앞선 것 |

seed 데이터 기준 기대값: 서버 통계는 전체 15, 분석 14, 후속조치 6, 검토 필요 2, 실패 1, 처리 중 0. 웹 카드와 엑셀은 14, 6, 2, 불만 3, 21%, 질의.

- `confidence`는 음성 인식 신뢰도다. 화면에는 "음성 인식 신뢰도"로 표시한다.
- "검토 필요"는 서버가 저장할 때 판정한다(신뢰도 없음·0.7 미만, 유형 보정, 담당자·고객사 미확인, 불만인데 후속조치 N, 후속조치 누락, 질문 요지 누락). 웹 수정에서는 판정하지 않는다. 0.7은 임시값이다.

## 9. 아직 정해지지 않은 것

통합본 11.1에 8개가 남아 있다. 화 12:00까지 답이 필요한 것: 15번(챗봇 화면 담당), 27번(CLOVA 응답의 신뢰도 값), 33번(고객사별 차트의 동률 순서).
