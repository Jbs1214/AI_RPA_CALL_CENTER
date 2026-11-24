# ④ 이어서 할 일

2026-11-23(월) 저녁 기준. 집 PC에서 한 일과 학원 PC에서 이어서 할 일을 적었다. 일이 끝나면 이 파일은 지운다.

구성과 명령의 자세한 설명은 `README.md`, 규칙은 `CLAUDE.md`에 있다. 여기에는 순서만 적는다.

## 지금 상태

| 한 일 | 확인 |
|---|---|
| 템플릿 v3에 슬라이서(담당자, 유형) 추가, 고객사 차트 눈금 1 단위, 통화 대장 I·J열 너비 | Excel 화면에서 확인함 |
| `build_report.ps1`: 서버 목록 받기 → 정렬 → 통화 대장 쓰기 → 저장 | 아래 10가지 경우 통과 |
| `tools/check_report.ps1`: seed 14건, seed + 경계 20건을 기대값과 비교 | `all checks passed` |
| `README.md`에 `Main.xaml` 만드는 순서 | 5번의 VB 코드만 Studio 밖에서 확인함 |

`build_report.ps1`로 확인한 경우: seed 14건, seed + 경계 20건, 0건, 쪽 나눠 받기(한글 포함), 서버 꺼짐(3회 재시도 후 실패, 기존 파일 유지), 500 뒤 재시도 성공, 422는 재시도 없이 실패, 출력 파일이 열려 있을 때 다른 이름으로 저장, `MaxRows` 초과, 깨진 날짜와 `=`·`-`로 시작하는 값.

**아직 확인하지 못한 것**

- `Main.xaml`은 없다. 집 PC에 UiPath Studio가 없어서 만들지 않았다.
- 서버 시험은 응답 모양을 흉내 낸 가짜 서버로 했다. 실제 서버(범수 PC)로는 돌려 보지 않았다.
- 큐에서 꺼내기, Asset 읽기, 큐 상태 표시는 한 번도 돌려 보지 않았다.

## 학원 PC에서 먼저 할 일

```
git pull
cd rpa-report
copy config.example.json config.json
powershell -NoProfile -ExecutionPolicy Bypass -File tools\check_report.ps1
```

- 마지막 줄이 `all checks passed`면 그 PC의 Excel로도 스크립트가 도는 것이다. `FAIL`이 나오면 `Main.xaml`보다 이것부터 본다.
- `config.json`과 `output/`은 git에 올라가지 않는다. PC마다 새로 만든다.
- 학원 PC에 Excel이 없으면 스크립트가 돌지 않는다(설계서 13장 5번).

## 이어서 할 일

기한은 루트의 `plan.md` 기준이다.

### 1. Orchestrator 웹 (월 18:00 기한이 지난 것부터)

- [ ] 큐 `CallCenter_Calls` 만들기. `Shared` 폴더, Reference 중복 허용, 자동 재시도 끔
- [ ] 큐 이름을 민영에게 알리기
- [ ] Asset `BACKEND_BASE_URL`(Text), `BACKEND_API_KEY`(Text, 비어 있지 않은 임시 값) 만들기. 서버 주소는 범수에게 받는다
- [ ] 봇 PC에서 `http://서버주소:8000/docs`가 열리는지 확인
- [ ] 외부 앱 만들기(권한 `OR.Jobs OR.Execution OR.Folders OR.Machines`). Client ID와 Secret은 범수나 민철에게 직접 전달한다. 파일, 문서, 대화방, 커밋에 적지 않는다 (화 12:00)

### 2. Studio에서 `Main.xaml` 만들기 (화 12:00)

UiPath 프로젝트를 `rpa-report/` 폴더에 만든다. 순서는 `README.md`의 "Main.xaml 만드는 순서" 1~6번이다. 아래 순서로 붙여 가며 확인하면 어디서 막혔는지 알기 쉽다.

- [ ] 5번(Invoke Code)만 먼저 넣고, `in_Args`를 `-MockJson testdata\mock_calls_seed14_v1.json`으로 주어 실행. `out_ExitCode`가 0이고 `output/콜센터_엑셀_최신.xlsx`가 생기는지
- [ ] 2번(Asset, 큐 이름 읽기)을 붙이고 `in_Args`를 `-BaseUrl … -ApiKey …`로 바꿔 실제 서버로 실행
- [ ] 3번, 4번, 6번(큐 꺼내기, 할 일 없음, 큐 상태 표시)을 붙이기
- [ ] `in_ForceRefresh=True`로 큐가 비어 있어도 다시 만들어지는지

확인이 필요한 점: `in_ScriptPath`는 `build_report.ps1`의 전체 경로여야 한다. Studio에서 실행할 때 현재 폴더가 프로젝트 폴더인지 확인하고, 아니면 전체 경로를 준다.

### 3. 팀원과 같이 확인할 것 (화 12:00 첫 전체 연결)

- [ ] 실제 서버 목록으로 만든 엑셀의 지표 6개가 웹 카드와 같은지(수창), 서버 엑셀(API 7)과 행 수가 같은지(범수)
- [ ] 큐에 ③의 예시 2건을 넣고 꺼내기: 성공 `CALL-20261123-016`, 실패 `CALL-20261123-017`(민영)
- [ ] 고객사 차트에서 불만 건수가 같을 때의 순서를 웹과 맞출지(수창, 설계서 13장 6번)

### 4. 화 18:00까지

- [ ] 예외 처리를 Studio에서 다시 확인: 서버를 끈 상태, 출력 파일을 열어 둔 상태, 0건. 스크립트 쪽 동작은 확인했으므로 큐 항목이 Failed로 표시되는지를 본다

### 5. 수 12:00까지

- [ ] 무인 실행 설정(머신 등록, `Shared` 폴더 연결), 프로세스 `CallCenter_RPA_Report` 올리기
- [ ] ③ 프로세스 키를 범수에게 알리기
- [ ] 큐 트리거(무인 실행이 되면)
- [ ] 서버가 시연 노트북으로 옮겨지면 Asset `BACKEND_BASE_URL` 바꾸고 접속 다시 확인

### 6. 문서 (브랜치 + PR)

구현이 설계서와 달라졌는데 문서는 아직 그대로다.

- [ ] `docs/설계서_4_RPA_v5.md`를 v6으로: 10장(워크플로우 4개 → `Main.xaml` + `build_report.ps1`), 7장 슬라이서("아직 없다" → 넣었다), 13장(1·2·3·7번이 정해짐)
- [ ] 설계서 이름이 적힌 곳도 같이 고치기: 루트 `CLAUDE.md`, `docs/README.md`, `docs/제품요구사항정의서_v1.9.md`, 이 폴더의 `CLAUDE.md`와 `README.md`
- [ ] `plan.md`의 ④ 항목 체크

루트 파일과 통합본이 들어가므로 `main`에 바로 올리지 않고 브랜치를 만들어 PR로 올린다.

## 정해 둔 것

| 항목 | 값 |
|---|---|
| 큐 이름 | `CallCenter_Calls` (설계서 제안 그대로) |
| ④ 프로세스 이름 | `CallCenter_RPA_Report` (설계서 제안 그대로) |
| 통화 대장 정렬 | 통화일시 오름차순 |
| 엑셀 저장 폴더 | `rpa-report/output/` (`config.json`의 `OutputPath`로 바꿀 수 있다) |
| 슬라이서 | 통화 대장 시트의 표 오른쪽. 대시보드 숫자는 바뀌지 않는 한계를 그대로 둔다 |
| 구현 방식 | 엑셀 쓰기는 스크립트, UiPath는 큐·Asset·스크립트 실행 |

## 주의

- `build_report.ps1`과 `tools/check_report.ps1`은 한글을 넣지 않는다. PowerShell 5.1이 잘못 읽는다. 고친 뒤에는 `tools\check_report.ps1`을 다시 돌린다.
- 이 폴더 안의 작업은 `git pull --rebase` 후 `main`에 올린다. 커밋은 `feat: 내용` 형식이다(`CONTRIBUTING.md`).
- API 키가 스크립트의 명령줄 인자로 넘어간다. 지금은 임시 값이라 괜찮다. 서버가 키 확인을 켜면 넘기는 방법을 바꾼다.
- 집 PC의 Excel은 창 제목에 "사용 허가되지 않은 제품"이 떴다. 봇 PC의 Excel은 저장이 되는지 먼저 확인한다.
