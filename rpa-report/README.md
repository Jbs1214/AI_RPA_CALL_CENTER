# rpa-report — ④ UiPath RPA 코어·보고서

담당: 주영

서버의 완료 통화 목록으로 3시트 엑셀(`콜센터_엑셀_최신.xlsx`)을 다시 만드는 UiPath 봇이다. Orchestrator 시간 트리거가 1분마다 시작한다. 서버에 저장하지 않고 읽기만 한다.

- Orchestrator 프로세스 이름: `CallCenter_RPA_Report` (폴더 `Shared`)
- 시작: 시간 트리거 1분. 직접 실행해도 된다. 큐는 쓰지 않는다(강사 피드백으로 뺐다, 11/24).

## 맡은 범위

| 역할 정의서의 항목 | 이번 MVP |
|---|---|
| 엑셀 대시보드 자동 생성 | 한다. 3시트 엑셀 `콜센터_엑셀_최신.xlsx` |
| 큐(Queue)와 예외 처리 | 예외 처리를 한다: 재시도, 실패 시 기존 파일 유지, 실패한 Job 표시. 큐는 강사 피드백(11/24)으로 뺐다. |
| Orchestrator 세팅 | 한다. Asset, 외부 앱, 무인 실행, 시간 트리거 |
| 레거시 시스템(CRM/ERP) 입력 자동화 | 하지 않는다. 대상 시스템과 형식이 정해지지 않아 확장 계획으로 설명한다(통합본 6.4의 FR-R09). |
| 정형 보고서 자동 생성 | 하지 않는다. 위와 같다. |

산출물: 메인 RPA 봇, 엑셀 템플릿, Orchestrator 세팅.

## 기준 문서

- `docs/설계서_4_RPA_v8.md`: 처리 흐름, 엑셀 템플릿 구조, 통화 대장 쓰기 규칙, 예외 처리, 시험
- `docs/제품요구사항정의서_v2.2.md`: 6.4(요구사항), 7.5(엑셀 12열), 8장(지표 정의)

## 폴더

```
rpa-report/
  templates/
    콜센터_엑셀_템플릿_v5.xlsx    봇이 쓰는 3시트 템플릿(대시보드, 요약, 통화 대장)
    콜센터_엑셀_템플릿_v4.xlsx    v5를 만들 때 쓰는 바탕. 봇은 쓰지 않고 게시 패키지에도 넣지 않는다.
    콜센터_엑셀_최종본_MVP.xlsx   원본. 템플릿을 다시 만들 때만 쓴다.
  tools/
    build_template.py             원본에서 v3 상태의 템플릿을 만드는 스크립트
    build_template_v5.ps1         v4에서 v5를 만드는 스크립트(Excel을 열어 고친다). 문구는 build_template_v5_labels.json
  project.json, Main.xaml         UiPath 프로젝트. Asset 읽기, 스크립트 실행, 결과 확인을 맡는다.
  build_report.ps1                서버 목록을 받아 통화 대장을 다시 쓰고 엑셀을 저장하는 스크립트
  config.example.json             설정값 예시. config.json으로 복사해서 쓴다.
```

## 구성

| 부분 | 하는 일 |
|---|---|
| `Main.xaml` (UiPath) | Asset에서 서버 주소와 API 키를 읽어 `build_report.ps1`을 실행하고, 스크립트가 실패하면 예외를 던져 Job을 실패(Faulted)로 끝낸다. |
| `build_report.ps1` | 서버 목록을 끝까지 받아(재시도 포함) 통화일시 순으로 정렬하고, 템플릿 복사본의 통화 대장을 다시 써서 저장한다. |

엑셀을 쓰는 일을 스크립트로 둔 것은 UiPath Studio가 없는 PC에서도 서버만 있으면 엑셀 만들기를 돌려 볼 수 있어서다. 스크립트도 Excel 프로그램으로 템플릿을 열어 쓰므로 차트와 슬라이서가 남는다. Windows PowerShell 5.1과 Excel만 있으면 된다.

스크립트는 통화 대장 시트에만 쓴다. 요약 시트의 담당자·통화일·고객사 목록과 차트는 템플릿의 수식이 통화 대장에서 만든다.

```
powershell -NoProfile -ExecutionPolicy Bypass -File build_report.ps1 -BaseUrl http://서버주소:8000 -ApiKey 임시값
```

- 설정은 스크립트 옆의 `config.json`에서 읽는다(`-ConfigPath`로 바꿀 수 있다). `TemplatePath`와 `OutputPath`가 상대 경로면 설정 파일이 있는 폴더가 기준이다.
- 종료 코드 0은 저장 성공, 1은 실패다. 실패하면 기존 `콜센터_엑셀_최신.xlsx`는 그대로 둔다.
- 출력 파일이 열려 있어 못 쓰면 `콜센터_엑셀_최신_날짜시각.xlsx`로 저장하고 경고를 남긴다.
- 로그에는 건수, 관리번호, 경고만 나온다. 한글이 깨지지 않게 스크립트 본문과 로그 문구는 영문이다.

## Main.xaml의 구성

UiPath 프로젝트(`project.json`, `Main.xaml`)는 이 폴더에 있다. Studio에서 `project.json`을 열면 된다. 인자는 없다. 시퀀스 3개로 되어 있고, 시퀀스마다 쓰는 파일과 하는 일을 주석으로 달았다.

| 시퀀스 | 활동 | 하는 일 |
|---|---|---|
| 1. 서버 주소 읽기 | Get Asset 2개 | `BACKEND_BASE_URL`, `BACKEND_API_KEY`를 읽는다. |
| 2. 엑셀 다시 만들기 | Invoke Code(VB) | 프로젝트 폴더의 `build_report.ps1`을 실행하고 끝날 때까지 기다린다. |
| 3. 결과 확인 | Log Message, If, Throw | 스크립트의 로그를 남긴다. 종료 코드가 0이 아니면 예외를 던진다. |

Invoke Code의 인자는 `in_ScriptPath`(In, String), `in_Args`(In, String), `out_ExitCode`(Out, Int32), `out_Output`(Out, String)이다. `in_ScriptPath`는 프로젝트 폴더의 `build_report.ps1` 전체 경로이고, `in_Args`는 `"-BaseUrl ""서버주소"" -ApiKey ""키"""`다. 스크립트를 시작하지 못해도 종료 코드 1로 돌려준다.

   ```vb
   Try
       Dim psi As New System.Diagnostics.ProcessStartInfo("powershell.exe", "-NoProfile -ExecutionPolicy Bypass -File """ & in_ScriptPath & """ " & in_Args)
       psi.UseShellExecute = False
       psi.RedirectStandardOutput = True
       psi.CreateNoWindow = True
       Using p As System.Diagnostics.Process = System.Diagnostics.Process.Start(psi)
           out_Output = p.StandardOutput.ReadToEnd()
           p.WaitForExit()
           out_ExitCode = p.ExitCode
       End Using
   Catch ex As Exception
       out_ExitCode = 1
       out_Output = ex.Message
   End Try
   ```

확인한 것과 아직 하지 않은 것:

- Invoke Code의 VB 코드는 Studio 밖에서 컴파일해 없는 스크립트 경로로 실패(0이 아닌 값)를 받는 것을 확인했다.
- 큐를 뺀 `Main.xaml`은 Studio의 분석기(`UiPath.Studio.CommandLine.exe analyze -p project.json`)에서 오류 0이고, 게시(컴파일)가 된다.
- Studio 실행과 올린 프로세스(1.0.8), 시간 트리거로 돌려 확인했다(11/24). Studio에서 실행할 때는 Orchestrator 폴더를 `Shared`로 고른다.

## 다시 게시할 때

게시하면 프로젝트 폴더의 파일이 패키지에 담겨 Orchestrator로 올라간다. 아래를 지킨다.

- `config.json`의 `OutputPath`는 프로젝트 폴더 밖의 전체 경로로 적는다. 상대 경로로 두면 엑셀이 패키지 설치 폴더 안에 저장되어 찾을 수 없다. 프로젝트 폴더 안에 두면 결과 엑셀이 패키지에 들어간다.
- 패키지에서 뺄 파일은 `project.json`의 `ignoredFiles`에 하나씩 적는다. 폴더 이름과 와일드카드는 듣지 않는다. `tools`에 파일을 더하면 여기에도 적는다.
- Studio가 프로젝트를 열어 둔 채로 `project.json`이 밖에서 바뀌었으면, 프로젝트를 닫았다가 다시 연 뒤 게시한다. 게시 창의 현재 버전이 `project.json`과 같은지 본다.
- 게시한 뒤 Orchestrator `Shared`의 프로세스를 새 버전으로 올린다.
- 봇 PC는 켜고 로그인해 둔다. 사용자 방식 로봇이라 로그인되어 있어야 Job이 돈다.
- 무인 실행 자리가 1개다. ③의 Job 시작을 시험할 때는 ④의 시간 트리거를 잠깐 끈다.
- 결과 엑셀을 열어 두면 봇이 덮어쓰지 못해 1분마다 날짜시각이 붙은 파일이 생긴다. 볼 때는 복사본을 연다.

## 시험

가짜 데이터(mock)는 쓰지 않는다. 저장소에 있던 가짜 JSON과 그것을 읽던 검사 스크립트는 11/24에 지웠다. 시험은 자체 제작 음성으로 서버에 저장된 실제 통화로 한다.

스크립트를 고쳤으면 결과 파일을 건드리지 않는 설정으로 한 번 돌려 본다. `config.json`을 복사해 `OutputPath`만 임시 폴더로 바꾼 뒤 `-ConfigPath`로 넘긴다.

```
powershell -NoProfile -ExecutionPolicy Bypass -File build_report.ps1 -ConfigPath 임시폴더\config.json -BaseUrl http://서버주소:8000 -ApiKey 임시값
```

볼 것:

- 로그의 `saved rows=N`이 서버의 완료 통화 수와 같은지
- 대시보드의 지표 6개가 서버 통계(`GET /api/stats`)와 같은지. 웹 카드와 다르면 서버 통계부터 비교한다
- 요약 시트의 담당자별·일자별·고객사별 합이 분석된 통화와 같은지
- 차트 4개와 슬라이서 2개가 남아 있는지

11/24에 실제 서버로 확인한 경우: 0건(지표 0, 오류 셀 없음), 15건·16건(서버 통계·서버 엑셀·웹 카드와 같음), 새 담당자와 새 고객사가 목록에 저절로 나옴, 서버 주소가 틀릴 때 3회 재시도 뒤 실패와 기존 파일 유지, 결과 파일이 열려 있을 때 다른 이름으로 저장.

## 템플릿 v5

v5는 v4에 아래 세 가지를 더한 것이다(11/25). 봇 스크립트 `build_report.ps1`, 표 `tblCalls`, 12열은 그대로다.

- **대시보드에서 버튼으로 골라 보기.** 대시보드 왼쪽에 버튼 묶음(슬라이서) 5개가 있다: 담당자, 유형, 고객사, 후속조치, AI 결과 검토 필요. 누르면 지표 6개, 두 줄 문장, 차트 4개, 대상 기간이 그 통화만으로 다시 계산된다. 거른 상태에서는 "전체 N건 중 M건만 표시 중"이 빨간 글씨로 나온다. 아무것도 누르지 않은 상태의 숫자가 웹 카드와 같은 숫자다.
  - 방법: 통화 대장 표 밖의 `N`열(숨김)에 `SUBTOTAL(103, A열)`을 두어 보이는 줄을 1로 세고, 요약 시트의 집계 수식이 모두 이 열을 조건으로 건다.
  - 봇이 1분마다 파일을 새로 만들므로 고른 상태는 저장되지 않는다. 눌러 볼 때는 복사본을 연다.
  - 통화일로 거르는 버튼은 없다. 표 슬라이서는 날짜·시각 값을 하나하나 버튼으로 만든다.
- **요약 시트를 한 화면에.** 표 1~3은 `A:D`열에 그대로 두고, 표 4(통화일별)는 `F1`, 표 5(고객사별)는 `F19`로 옮겨 나란히 놓았다. 표 6·7(판단 기준)은 그 아래 `A33`, `A43`에 있다. 계산용 열은 `J:T`에서 `AA:AK`로 옮겼다(숨김).
- **표 7 기준값.** 불만 비율 20%(유형 5개의 고른 몫), 후속조치 비율 40%. 칸은 `B45`, `B46`이고 초기값이다.

통화 대장이 8행부터 열리던 것도 맨 위에서 열리게 했다.

v5를 다시 만들 때:

```
powershell -NoProfile -ExecutionPolicy Bypass -File tools\build_template_v5.ps1 -Source templates\콜센터_엑셀_템플릿_v4.xlsx -Dest templates\콜센터_엑셀_템플릿_v5.xlsx -Labels tools\build_template_v5_labels.json
```

기준값이나 문구만 바꿀 때는 스크립트의 `B46` 값이나 `build_template_v5_labels.json`을 고치고 다시 만든다. 만든 뒤에는 "시험"의 방법으로 실제 서버에 한 번 돌려 본다. 모양은 v4를 Excel에서 고친 뒤 스크립트를 다시 돌린다.

아래는 v4까지의 내용이다. v5에서 칸 주소가 바뀐 곳은 위에 적은 대로다.

원본은 요약 시트의 담당자 3명, 날짜 4개, 고객사 5곳과 차트 범위가 고정이라 새 담당자·날짜·고객사가 집계에서 빠졌다. v3에서 세 목록을 수식으로 만들고 차트가 값이 있는 행까지만 그리게 했다. 자세한 내용은 설계서 7장.

v4는 강사 피드백(11/24)으로 v3의 모양을 고친 것이다(범수가 Excel에서 고쳤다). 11/25에 한 번 더 고쳤고 파일 이름은 그대로다. 표 `tblCalls`, 12열, 요약 시트의 집계 수식, 계산용 열, 차트가 읽는 범위는 v3과 같다.

- 안내 시트를 뺐다. 시트는 대시보드, 요약, 통화 대장 3개다.
- 대시보드에 대상 기간, 지표 아래의 설명 한 줄, 상황을 풀어 쓴 두 줄 문장(`A8`, `A9`)을 넣었다. 모두 수식이라 통화 대장이 바뀌면 같이 바뀐다. 11/24 판의 핵심 요약 5줄 표는 11/25에 이 두 줄 문장으로 바꿨다.
- 유형별 통화 건수 차트를 가로 막대로 바꿨다.
- 요약 시트 아래(`A63:I71`)에 항목별 판단 기준 표(표 6)를 넣었다. 이 표는 고정된 글이라 판정 규칙(통합본 7.2)이 바뀌면 손으로 고친다.
- 그 아래(`A73:I76`)에 상황 판단 기준 표(표 7)를 넣었다(11/25). 기준값은 불만 비율 20%, 후속조치 비율 30%이고 초기 설정값이다. 대시보드의 두 줄 문장이 이 칸(`B75`, `B76`)을 읽어 "높다", "많다"를 정하므로, 기준을 바꿀 때는 이 두 칸만 고친다.
- 통화 대장의 후속조치, AI 결과 검토 필요 머리글 위에 빨간 안내 글상자(`note_I1`, `note_J1`)를 넣었다(11/25). 스크립트는 `A2:L1000`의 값만 지우므로 글상자는 그대로 남는다.
- 대시보드와 요약에 인쇄 영역을 잡았다.

- 담당자 10명(통화가 많은 순), 통화가 있는 최근 14일, 고객사 10곳(불만이 많은 순)까지 보여 준다. 넘는 만큼은 블록에 나오지 않는다.
- 요약 시트의 계산용 열(v4는 `J:T`, v5는 `AA:AK`)은 숨겨 두었다. 고치지 않는다.
- v4의 슬라이서(담당자, 유형)는 통화 대장 시트의 표 오른쪽에 있고 통화 대장의 행만 걸렀다. v5에서 대시보드로 옮기고 숫자와 차트도 같이 바뀌게 했다.
- `python tools/build_template.py templates/콜센터_엑셀_최종본_MVP.xlsx 결과.xlsx --dynamic`은 원본에서 v3 상태까지만 만든다. Excel에서 넣은 슬라이서와 v4의 변경은 들어가지 않으므로, 템플릿을 고칠 때는 v4를 Excel에서 직접 고친다.

## 커밋하지 않는 것

봇이 만든 `콜센터_엑셀_최신.xlsx`, 엑셀 임시 파일(`~$…`), 실제 설정 파일(`config.json`).
