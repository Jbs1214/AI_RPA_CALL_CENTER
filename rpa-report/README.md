# rpa-report — ④ UiPath RPA 코어·보고서

담당: 주영

Orchestrator 큐에서 "새 통화가 저장됐다"는 신호를 받아, 서버의 완료 통화 목록으로 4시트 엑셀(`콜센터_엑셀_최신.xlsx`)을 다시 만드는 UiPath 봇이다. 서버에 저장하지 않고 읽기만 한다.

- Orchestrator 프로세스 이름: `CallCenter_RPA_Report` (제안, 폴더 `Shared`)
- 큐 이름: `CallCenter_Calls` (제안. 정해지면 ③에 알린다)

## 기준 문서

- `docs/설계서_4_RPA_v4.md`: 처리 흐름, 엑셀 템플릿 구조, 통화 대장 쓰기 규칙, 예외 처리, 시험
- `docs/제품요구사항정의서_v1.7.md`: 6.4(요구사항), 7.3(큐 항목), 7.5(엑셀 12열), 8장(지표 정의)

## 폴더

```
rpa-report/
  templates/
    콜센터_엑셀_최종본_MVP.xlsx   4시트 템플릿(대시보드, 요약, 통화 대장, 안내)
  testdata/
    mock_calls_seed14_v1.json     서버 목록 응답 모양의 가짜 데이터 14건
    mock_calls_edge_v1.json       경계 사례 6건
  tools/
    verify_excel_rules.py         쓰기 규칙과 기대값을 확인하는 참고 스크립트
    make_mock.py                  템플릿의 14건으로 가짜 JSON을 만드는 스크립트
  config.example.json             설정값 예시
```

UiPath 프로젝트(`project.json`, `Main.xaml`과 아래 워크플로우)는 이 폴더에 올린다.

| 워크플로우 (제안) | 하는 일 |
|---|---|
| `Main.xaml` | 순서대로 아래를 부르고, 예외를 잡아 큐 상태를 정리한다. |
| `GetQueueSignals.xaml` | 큐의 새 항목을 모두 꺼낸다. |
| `FetchCalls.xaml` | 서버 목록을 끝까지 받아 표로 돌려준다. 재시도 포함 |
| `WriteLedger.xaml` | 통화 대장을 다시 쓴다. |
| `UpdateSummaryLists.xaml` | 요약 시트의 담당자, 통화일, 고객사 목록을 채운다. |

## 서버 없이 시험하기

`FetchCalls.xaml`이 서버 대신 `testdata/`의 JSON을 읽게 해서 먼저 만든다. 기대값은 아래와 같다.

| 데이터 | 분석된 통화 | 후속조치 필요 | 검토 필요 | 불만 통화 | 불만 비율 | 가장 많은 유형 |
|---|---|---|---|---|---|---|
| seed 14건 | 14 | 6 | 2 | 3 | 21% | 질의 |
| seed 14건 + 경계 사례 6건 | 20 | 8 | 3 | 4 | 20% | 질의 |

참고 스크립트로 같은 값을 확인할 수 있다. Python, openpyxl, LibreOffice(수식 재계산용)가 필요하다.

```
python tools/verify_excel_rules.py templates/콜센터_엑셀_최종본_MVP.xlsx out testdata/mock_calls_seed14_v1.json
```

## 알려진 문제

템플릿의 요약 시트에는 담당자 3명, 날짜 4개, 고객사 5곳이 고정 값으로 들어 있고 차트 범위도 고정이다. 그대로 쓰면 새 담당자·날짜·고객사가 집계와 차트에서 빠진다(경계 사례를 넣으면 담당자별 합이 20이 아니라 18로 나온다). 고치는 방법은 설계서 7장에 있다.

## 커밋하지 않는 것

봇이 만든 `콜센터_엑셀_최신.xlsx`, 엑셀 임시 파일(`~$…`), 실제 설정 파일(`config.json`).
