# rpa-report — ④ UiPath RPA 코어·보고서

담당: 주영

Orchestrator 큐에서 "새 통화가 저장됐다"는 신호를 받아, 서버의 완료 통화 목록으로 4시트 엑셀(`콜센터_엑셀_최신.xlsx`)을 다시 만드는 UiPath 봇이다. 서버에 저장하지 않고 읽기만 한다.

- Orchestrator 프로세스 이름: `CallCenter_RPA_Report` (제안, 폴더 `Shared`)
- 큐 이름: `CallCenter_Calls` (제안. 정해지면 ③에 알린다)

## 맡은 범위

| 역할 정의서의 항목 | 이번 MVP |
|---|---|
| 엑셀 대시보드 자동 생성 | 한다. 4시트 엑셀 `콜센터_엑셀_최신.xlsx` |
| 큐(Queue)와 예외 처리 | 한다. 큐 신호 처리, 재시도, 실패 시 기존 파일 유지 |
| Orchestrator 세팅 | 한다. 큐, Asset, 외부 앱, 무인 실행 |
| 레거시 시스템(CRM/ERP) 입력 자동화 | 하지 않는다. 대상 시스템과 형식이 정해지지 않아 확장 계획으로 설명한다(통합본 6.4의 FR-R09). |
| 정형 보고서 자동 생성 | 하지 않는다. 위와 같다. |

산출물: 메인 RPA 봇, 엑셀 템플릿, Orchestrator 세팅.

## 기준 문서

- `docs/설계서_4_RPA_v5.md`: 처리 흐름, 엑셀 템플릿 구조, 통화 대장 쓰기 규칙, 예외 처리, 시험
- `docs/제품요구사항정의서_v1.9.md`: 6.4(요구사항), 7.3(큐 항목), 7.5(엑셀 12열), 8장(지표 정의)

## 폴더

```
rpa-report/
  templates/
    콜센터_엑셀_템플릿_v3.xlsx    봇이 쓰는 4시트 템플릿(대시보드, 요약, 통화 대장, 안내)
    콜센터_엑셀_최종본_MVP.xlsx   원본. 템플릿을 다시 만들 때만 쓴다.
  testdata/
    mock_calls_seed14_v1.json     서버 목록 응답 모양의 가짜 데이터 14건
    mock_calls_edge_v1.json       경계 사례 6건
    queue_items_2_v1.csv          큐 화면의 Upload Items로 올리는 시험용 큐 항목 2건
  tools/
    check_report.ps1              가짜 JSON으로 build_report.ps1을 돌리고 결과 엑셀을 기대값과 비교하는 스크립트
    check_template.py             봇처럼 통화 대장만 다시 쓰고 요약 시트의 값을 확인하는 스크립트
    build_template.py             원본에서 템플릿을 다시 만드는 스크립트
    make_mock.py                  원본의 14건으로 가짜 JSON을 만드는 스크립트
  project.json, Main.xaml         UiPath 프로젝트. 큐, Asset, 스크립트 실행을 맡는다.
  build_report.ps1                서버 목록을 받아 통화 대장을 다시 쓰고 엑셀을 저장하는 스크립트
  config.example.json             설정값 예시. config.json으로 복사해서 쓴다.
```

## 구성

| 부분 | 하는 일 |
|---|---|
| `Main.xaml` (UiPath) | 큐의 새 항목을 모두 꺼내고, Asset을 읽어 `build_report.ps1`을 실행한 뒤, 결과에 따라 큐 항목을 성공이나 실패로 표시한다. |
| `build_report.ps1` | 서버 목록을 끝까지 받아(재시도 포함) 통화일시 순으로 정렬하고, 템플릿 복사본의 통화 대장을 다시 써서 저장한다. |

엑셀을 쓰는 일을 스크립트로 둔 것은 UiPath Studio가 없는 PC에서도 가짜 JSON으로 끝까지 시험할 수 있어서다. 스크립트도 Excel 프로그램으로 템플릿을 열어 쓰므로 차트와 슬라이서가 남는다. Windows PowerShell 5.1과 Excel만 있으면 된다.

스크립트는 통화 대장 시트에만 쓴다. 요약 시트의 담당자·통화일·고객사 목록과 차트는 템플릿의 수식이 통화 대장에서 만든다.

```
powershell -NoProfile -ExecutionPolicy Bypass -File build_report.ps1 -BaseUrl http://서버주소:8000 -ApiKey 임시값
```

- 설정은 스크립트 옆의 `config.json`에서 읽는다(`-ConfigPath`로 바꿀 수 있다). `TemplatePath`와 `OutputPath`가 상대 경로면 설정 파일이 있는 폴더가 기준이다.
- 종료 코드 0은 저장 성공, 1은 실패다. 실패하면 기존 `콜센터_엑셀_최신.xlsx`는 그대로 둔다.
- 출력 파일이 열려 있어 못 쓰면 `콜센터_엑셀_최신_날짜시각.xlsx`로 저장하고 경고를 남긴다.
- 로그에는 건수, 관리번호, 경고만 나온다. 한글이 깨지지 않게 스크립트 본문과 로그 문구는 영문이다.

## Main.xaml 만드는 순서

UiPath 프로젝트(`project.json`, `Main.xaml`)는 이 폴더에 있다. Studio에서 `project.json`을 열면 된다. `Main.xaml`은 아래 순서로 되어 있다.

1. 인자 `in_ForceRefresh`(Boolean, 기본값 False)를 만든다.
2. Get Asset으로 `BACKEND_BASE_URL`, `BACKEND_API_KEY`를 읽는다. `config.json`을 Read Text File로 읽어 `Newtonsoft.Json.Linq.JObject.Parse(내용)("QueueName").ToString`으로 큐 이름을 얻는다.
3. Get Transaction Item을 결과가 `Nothing`이 될 때까지 되풀이한다. 항목마다 `Reference`와 `SpecificContent("status")`를 로그에 남기고 목록(`List(Of QueueItem)`)에 담는다.
4. 목록이 비었고 `in_ForceRefresh`가 False면 "할 일 없음"을 로그에 남기고 끝낸다.
5. Invoke Code(VB)로 스크립트를 실행한다. 인자는 `in_ScriptPath`(In, String), `in_Args`(In, String), `out_ExitCode`(Out, Int32), `out_Output`(Out, String)이고 `in_ScriptPath`는 프로젝트 폴더의 `build_report.ps1` 전체 경로이고, `in_Args`는 `"-BaseUrl ""서버주소"" -ApiKey ""키"""`다. 스크립트를 실행하지 못해도 종료 코드 1로 돌려 꺼낸 큐 항목이 실패로 표시되게 한다.

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

6. `out_Output`을 로그에 남긴다. `out_ExitCode`가 0이면 담아 둔 항목을 모두 Set Transaction Status로 Successful, 아니면 모두 Failed(Application)로 표시한다.

5번의 VB 코드는 Studio 밖에서 컴파일해 가짜 JSON으로 성공(종료 코드 0)을, 없는 스크립트 경로로 실패(0이 아닌 값)를 받는 것까지 확인했다. `Main.xaml`은 Studio의 분석기(`UiPath.Studio.CommandLine.exe analyze -p project.json`)에서 오류 없이 읽힌다. Asset과 큐를 쓰는 실제 실행은 Studio에서 확인해야 한다. Studio에서 실행할 때는 Orchestrator 폴더를 `Shared`로 고른다.

## 서버 없이 시험하기

`-BaseUrl` 대신 `-MockJson`에 `testdata/`의 JSON을 주면 서버 없이 엑셀을 만든다. 기대값은 아래와 같다.

```
powershell -NoProfile -ExecutionPolicy Bypass -File build_report.ps1 -MockJson testdata\mock_calls_seed14_v1.json,testdata\mock_calls_edge_v1.json
```

| 데이터 | 분석된 통화 | 후속조치 필요 | 검토 필요 | 불만 통화 | 불만 비율 | 가장 많은 유형 | 담당자별·일자별·고객사별 합 |
|---|---|---|---|---|---|---|---|
| seed 14건 | 14 | 6 | 2 | 3 | 21% | 질의 | 모두 14 |
| seed 14건 + 경계 사례 6건 | 20 | 8 | 3 | 4 | 20% | 질의 | 모두 20 |

`tools/check_report.ps1`이 위 두 경우를 돌려 지표, 세 블록의 합, 표 범위, 차트 4개, 슬라이서 2개를 기대값과 비교한다. Excel만 있으면 된다.

```
powershell -NoProfile -ExecutionPolicy Bypass -File tools\check_report.ps1
```

템플릿만 따로 확인하는 Python 스크립트도 있다. Python, openpyxl, LibreOffice(수식 재계산용)가 필요하다.

```
python tools/check_template.py templates/콜센터_엑셀_템플릿_v3.xlsx out testdata/mock_calls_seed14_v1.json testdata/mock_calls_edge_v1.json
```

## 템플릿 v3

원본은 요약 시트의 담당자 3명, 날짜 4개, 고객사 5곳과 차트 범위가 고정이라 새 담당자·날짜·고객사가 집계에서 빠졌다. v3은 세 목록을 수식으로 만들고 차트가 값이 있는 행까지만 그린다. 자세한 내용은 설계서 7장.

- 담당자 10명(통화가 많은 순), 통화가 있는 최근 14일, 고객사 10곳(불만이 많은 순)까지 보여 준다. 넘는 만큼은 블록에 나오지 않는다.
- 요약 시트 `J:T`열은 계산용이고 숨겨 두었다. 고치지 않는다.
- 슬라이서(담당자, 유형)는 통화 대장 시트의 표 오른쪽에 있다. 통화 대장의 행만 거르고, 대시보드와 요약의 숫자는 바뀌지 않는다.
- 원본에서 다시 만들려면 `python tools/build_template.py templates/콜센터_엑셀_최종본_MVP.xlsx 결과.xlsx --dynamic`. 다시 만들면 Excel에서 넣은 슬라이서는 없어진다.

## 커밋하지 않는 것

봇이 만든 `콜센터_엑셀_최신.xlsx`, 엑셀 임시 파일(`~$…`), 실제 설정 파일(`config.json`).
