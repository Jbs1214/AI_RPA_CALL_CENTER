# rpa-genai-stt — ③ UiPath GenAI·STT

담당: 민영

통화 녹음 파일을 CLOVA Speech로 텍스트로 바꾸고, 화자별로 정리하고, 개인정보를 가린 뒤, UiPath GenAI로 유형을 분류·요약해 서버에 저장하고 Orchestrator 큐에 넣는 UiPath 워크플로우다.

- Orchestrator 프로세스 이름: `CallCenter_GenAI_STT` (폴더 `Shared`)

## 기준 문서

- `docs/설계서_3_GenAI_STT_v0.8.pdf`: 처리 단계, 호출하는 API, 결과 JSON, 큐 항목, 시험
- `docs/제품요구사항정의서_v1.7.md` 7장: 결과 JSON(7.1), 서버 보정 규칙(7.2), 큐 항목(7.3), 공통 값(7.4)

## 이 폴더에 둘 것

이 폴더는 지금 비어 있다. 담당자가 UiPath 프로젝트(`project.json`, `Main.xaml`과 하위 워크플로우)와 프롬프트 세트를 올린다.

`Main.xaml`의 In 인자는 `in_call_id`, `in_audio_url`, `in_result_url`이다. 서버가 Job을 시작할 때 이 이름으로 값을 넣는다.

## 실행할 때 생기는 폴더 (커밋하지 않는다)

| 폴더 | 내용 |
|---|---|
| 입력 폴더 | 처리할 음성(wav, mp3, m4a). 파일명 규칙 `YYYYMMDD_HHmm_담당자_고객사.wav` |
| `done/` | 저장에 성공했거나 이미 저장된 음성 |
| `failed/` | 실패로 저장됐거나 입력 오류가 난 음성 |
| `output/` | STT 응답 원본과 결과 JSON |
| `output/unsent/` | 서버에 보내지 못해 다음 실행 때 다시 보낼 결과 JSON |

## Orchestrator Asset

| Asset | 만드는 사람 |
|---|---|
| `CLOVA_INVOKE_URL` (Text), `CLOVA_SECRET_KEY` (Secret) | ③ |
| `BACKEND_BASE_URL`, `BACKEND_API_KEY` | ④ (값은 ①에게서 받는다) |

## ④에게 넘기는 것

서버 저장에 성공한 통화 1건마다 큐 아이템 1개. Reference는 서버가 발급한 `call_id`, SpecificContent는 키 13개이고 값은 모두 문자열이다. 큐 이름은 ④가 알려 준다.
