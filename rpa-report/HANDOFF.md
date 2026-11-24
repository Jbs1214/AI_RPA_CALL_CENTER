# ④ 이어서 할 일

2026-11-24(화) 오전 기준. 한 일과 이어서 할 일을 적었다. 일이 끝나면 이 파일은 지운다.

구성과 명령의 자세한 설명은 `README.md`, 규칙은 `CLAUDE.md`에 있다. 여기에는 순서만 적는다.

## 지금 상태

| 한 일 | 확인 |
|---|---|
| 템플릿 v3에 슬라이서(담당자, 유형) 추가, 고객사 차트 눈금 1 단위, 통화 대장 I·J열 너비 | Excel 화면에서 확인함 |
| `build_report.ps1`: 서버 목록 받기 → 정렬 → 통화 대장 쓰기 → 저장 | 아래 10가지 경우 통과 |
| `tools/check_report.ps1`: seed 14건, seed + 경계 20건을 기대값과 비교 | `all checks passed` |
| `project.json`, `Main.xaml` (11/24) | Studio에서 실제 서버로 세 가지 실행 확인: 빈 큐(`nothing to do`), `in_ForceRefresh=True`(14건 저장), 큐 2건(둘 다 꺼내고 엑셀은 한 번) |
| Orchestrator `Shared` 폴더: 큐 `CallCenter_Calls`, Asset 2개, 외부 앱 (11/24) | 큐와 Asset은 위 실행으로 확인. 외부 앱 값은 범수에게 전달함 |
| Studio가 있는 PC에서 `tools\check_report.ps1` (11/24) | `all checks passed` |

`build_report.ps1`로 확인한 경우: seed 14건, seed + 경계 20건, 0건, 쪽 나눠 받기(한글 포함), 서버 꺼짐(3회 재시도 후 실패, 기존 파일 유지), 500 뒤 재시도 성공, 422는 재시도 없이 실패, 출력 파일이 열려 있을 때 다른 이름으로 저장, `MaxRows` 초과, 깨진 날짜와 `=`·`-`로 시작하는 값.

**아직 확인하지 못한 것**

- 큐 2건 시험은 `testdata/queue_items_2_v1.csv`를 큐 화면에서 올려서 했다. ③ 봇이 넣은 항목으로는 아직 돌려 보지 않았다.
- 실패한 경우(서버 주소가 틀림, 출력 파일이 열려 있음, 0건)에 큐 항목이 어떻게 표시되는지는 Studio에서 아직 보지 않았다.
- 엑셀의 지표를 웹 카드, 서버 엑셀과 비교하지 않았다. `GET /api/stats`와는 같았다(14 / 6 / 2, 불만 3).
- 올린 프로세스와 무인 실행으로는 돌려 보지 않았다. Studio 실행만 했다.

## 다른 PC에서 먼저 할 일

```
git pull
cd rpa-report
copy config.example.json config.json
powershell -NoProfile -ExecutionPolicy Bypass -File tools\check_report.ps1
```

- 마지막 줄이 `all checks passed`면 그 PC의 Excel로도 스크립트가 도는 것이다. `FAIL`이 나오면 `Main.xaml`보다 이것부터 본다.
- `config.json`과 `output/`은 git에 올라가지 않는다. PC마다 새로 만든다.
- 학원 PC에 Excel이 없으면 스크립트가 돌지 않는다(설계서 13장 5번).

## 역할 정의서 항목별 상태

| 역할 정의서 항목 | 산출물 | 상태 |
|---|---|---|
| 엑셀 대시보드 자동 생성 | 엑셀 템플릿 v3, `build_report.ps1` | 끝. 가짜 14건·20건 기대값 통과 |
| 메인 RPA 봇 | `project.json`, `Main.xaml` | 파일 작성, Studio 분석기 오류 0. Studio 실행은 아직 |
| 큐/예외 처리 | `Main.xaml`의 큐 처리, 스크립트의 재시도 | 스크립트 쪽은 10가지 경우 확인. 큐 쪽은 한 번도 돌리지 않음 |
| Orchestrator 세팅 | 큐, Asset, 외부 앱, 무인 실행 | 환경 확인만 됨. 큐, Asset, 외부 앱 모두 아직 |
| 레거시(CRM/ERP) 입력, 정형 보고서 | 없음 | 만들지 않는다(통합본 FR-R09, 결정 13번). 시연 때 확장 계획으로 설명한다 |

## 이어서 할 일

기한은 루트의 `plan.md` 기준이다.

### A. 화 12:00까지 (첫 전체 연결)

Orchestrator 세팅. 웹에서 한다.

- [x] 큐 `CallCenter_Calls` 만들기. `Shared` 폴더, Reference 중복 허용, 자동 재시도 끔
- [ ] 큐 이름을 민영에게 알리기
- [x] Asset `BACKEND_BASE_URL`(Text), `BACKEND_API_KEY`(Text, 비어 있지 않은 임시 값) 만들기. 서버 주소는 범수에게 받는다
- [x] 봇 PC에서 `http://서버주소:8000/docs`가 열리는지 확인
- [x] 외부 앱 만들기(권한 `OR.Jobs OR.Execution OR.Folders OR.Machines`). Client ID와 Secret은 범수나 민철에게 직접 전달한다. 파일, 문서, 대화방, 커밋에 적지 않는다
- [ ] 범수가 받은 값으로 토큰이 발급되는지 듣기

메인 RPA 봇. Studio에서 실행한다. 큐와 Asset이 있어야 한다.

- [x] Studio에서 `rpa-report/project.json` 열기. Orchestrator 폴더를 `Shared`로 고르고, 패키지가 받아지고 오류 목록이 비어 있는지
- [x] 큐가 빈 상태에서 실행. 로그에 `nothing to do`가 나오는지
- [x] `in_ForceRefresh=True`로 실행. 실제 서버 목록으로 `output/콜센터_엑셀_최신.xlsx`가 생기는지

큐/예외 처리

- [x] 큐에 2건을 넣고 실행(`testdata/queue_items_2_v1.csv`): 성공 `CALL-20261123-016`, 실패 `CALL-20261123-017`. 둘 다 꺼내고 엑셀은 한 번만 만들어지는지
- [ ] 같은 시험을 ③ 봇이 넣은 항목으로(민영)

팀원과 같이 확인할 것

- [ ] 실제 서버 목록으로 만든 엑셀의 지표 6개가 웹 카드와 같은지(수창), 서버 엑셀(API 7)과 행 수가 같은지(범수)
- [ ] 고객사 차트에서 불만 건수가 같을 때의 순서를 웹과 맞출지(수창, 설계서 13장 6번)

확인이 필요한 점: 스크립트 경로를 `Environment.CurrentDirectory`로 만든다. Studio에서 실행할 때 이 값이 프로젝트 폴더가 아니면 로그에 `-File` 오류가 나온다. 그때는 `in_ScriptPath`를 고친다.

### B. 화 18:00까지 (MVP)

큐/예외 처리. 스크립트 쪽 동작은 확인했으므로 Studio에서 큐 항목의 상태를 본다.

- [ ] Asset의 서버 주소를 틀리게 바꾸고 실행. 큐 항목이 Failed가 되고 기존 엑셀이 그대로인지
- [ ] 출력 엑셀을 열어 둔 채 실행. 다른 이름으로 저장되고 큐 항목이 Successful인지
- [ ] 서버에 완료 통화가 0건일 때 실행. 빈 엑셀이 오류 없이 저장되는지

기록

- [ ] 확인이 끝난 `project.json`, `Main.xaml`, `README.md`, 이 파일을 커밋

### C. 수 12:00까지 (기능 동결)

Orchestrator 세팅

- [ ] `config.json`의 `OutputPath`를 전체 경로로 바꾸기. 프로세스를 올리면 출력 폴더가 패키지 설치 폴더 아래로 간다
- [ ] 프로세스 `CallCenter_RPA_Report`를 `Shared`에 올리기
- [ ] 무인 실행 설정(머신 등록, `Shared` 폴더 연결)
- [ ] ③ 프로세스 키를 범수에게 알리기
- [ ] 봇 PC 머신 연결이 되면 민철에게 알리기. Job 시작 시험에 외부 앱 값과 머신 연결이 필요하다(민철 요청, 11/24)
- [ ] 큐 트리거(무인 실행이 되면)
- [ ] 서버가 시연 노트북으로 옮겨지면 Asset `BACKEND_BASE_URL` 바꾸고 접속 다시 확인

문서(브랜치 + PR). 브랜치 `docs/rpa-design-v6`에서 고쳐 PR로 올렸다(11/24). 합쳐지면 끝이다.

- [x] 설계서를 v6으로(`docs/설계서_4_RPA_v6.md`): 10장(워크플로우 4개 → `Main.xaml` + `build_report.ps1`), 7장 슬라이서("아직 없다" → 넣었다), 13장(1·2·3·7번이 정해짐)
- [x] v6에서 15~16행 참고 문서 표의 옛 이름도 고치기: 통합본 v1.8 → v1.9, 백엔드 PRD v2 → v3 (민철 요청, 11/24)
- [x] 설계서 이름이 적힌 곳도 같이 고치기: 루트 `CLAUDE.md`, `docs/README.md`, `docs/제품요구사항정의서_v1.9.md`, 이 폴더의 `CLAUDE.md`와 `README.md`
- [x] `plan.md`의 ④ 항목 체크

- [ ] PR이 합쳐졌는지 확인하고 `main`을 다시 받기

### D. 수 오후 (시연)

- [ ] 레거시(CRM/ERP) 입력과 정형 보고서를 만들지 않은 이유와 확장 계획을 설명할 두세 문장 준비. 순서는 `docs/시나리오_0_시연_v1.md`의 11번에 있다
- [ ] 리허설에서 큐 신호 → 엑셀 다시 만들기를 한 번 돌려 보기
- [ ] 일이 끝나면 이 파일 지우기

## 정해 둔 것

| 항목 | 값 |
|---|---|
| 큐 이름 | `CallCenter_Calls` (설계서 제안 그대로) |
| ④ 프로세스 이름 | `CallCenter_RPA_Report` (설계서 제안 그대로) |
| 통화 대장 정렬 | 통화일시 오름차순 |
| 엑셀 저장 폴더 | `rpa-report/output/` (`config.json`의 `OutputPath`로 바꿀 수 있다) |
| 슬라이서 | 통화 대장 시트의 표 오른쪽. 대시보드 숫자는 바뀌지 않는 한계를 그대로 둔다 |
| 구현 방식 | 엑셀 쓰기는 스크립트, UiPath는 큐·Asset·스크립트 실행 |
| 레거시 입력, 정형 보고서 | 만들지 않는다. 시연 때 확장 계획으로 설명한다 (11/24 다시 확인) |

## 주의

- `build_report.ps1`과 `tools/check_report.ps1`은 한글을 넣지 않는다. PowerShell 5.1이 잘못 읽는다. 고친 뒤에는 `tools\check_report.ps1`을 다시 돌린다.
- 이 폴더 안의 작업은 `git pull --rebase` 후 `main`에 올린다. 커밋은 `feat: 내용` 형식이다(`CONTRIBUTING.md`).
- API 키가 스크립트의 명령줄 인자로 넘어간다. 지금은 임시 값이라 괜찮다. 서버가 키 확인을 켜면 넘기는 방법을 바꾼다.
- 집 PC의 Excel은 창 제목에 "사용 허가되지 않은 제품"이 떴다. 봇 PC의 Excel은 저장이 되는지 먼저 확인한다.
