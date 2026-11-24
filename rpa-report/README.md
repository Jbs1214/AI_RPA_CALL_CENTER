# rpa-report — ④ UiPath RPA 코어·보고서

담당: 주영

서버의 완료 통화 목록으로 4시트 엑셀(`콜센터_엑셀_최신.xlsx`)을 다시 만드는 UiPath 봇이다. Orchestrator 시간 트리거가 1분마다 시작한다. 서버에 저장하지 않고 읽기만 한다.

- Orchestrator 프로세스 이름: `CallCenter_RPA_Report` (폴더 `Shared`)
- 시작: 시간 트리거 1분. 직접 실행해도 된다. 큐는 쓰지 않는다(강사 피드백으로 뺐다, 11/24).

## 맡은 범위

| 역할 정의서의 항목 | 이번 MVP |
|---|---|
| 엑셀 대시보드 자동 생성 | 한다. 4시트 엑셀 `콜센터_엑셀_최신.xlsx` |
| 큐(Queue)와 예외 처리 | 예외 처리를 한다: 재시도, 실패 시 기존 파일 유지, 실패한 Job 표시. 큐는 강사 피드백(11/24)으로 뺐다. |
| Orchestrator 세팅 | 한다. Asset, 외부 앱, 무인 실행, 시간 트리거 |
| 레거시 시스템(CRM/ERP) 입력 자동화 | 하지 않는다. 대상 시스템과 형식이 정해지지 않아 확장 계획으로 설명한다(통합본 6.4의 FR-R09). |
| 정형 보고서 자동 생성 | 하지 않는다. 위와 같다. |

산출물: 메인 RPA 봇, 엑셀 템플릿, Orchestrator 세팅.

## 기준 문서

- `docs/설계서_4_RPA_v7.md`: 처리 흐름, 엑셀 템플릿 구조, 통화 대장 쓰기 규칙, 예외 처리, 시험
- `docs/제품요구사항정의서_v2.0.md`: 6.4(요구사항), 7.5(엑셀 12열), 8장(지표 정의)

## 폴더

```
rpa-report/
  templates/
    콜센터_엑셀_템플릿_v3.xlsx    봇이 쓰는 4시트 템플릿(대시보드, 요약, 통화 대장, 안내)
    콜센터_엑셀_최종본_MVP.xlsx   원본. 템플릿을 다시 만들 때만 쓴다.
  testdata/
    mock_calls_seed14_v1.json     서버 목록 응답 모양의 가짜 데이터 14건
    mock_calls_edge_v1.json       경계 사례 6건
  tools/
    check_report.ps1              가짜 JSON으로 build_report.ps1을 돌리고 결과 엑셀을 기대값과 비교하는 스크립트
    check_template.py             봇처럼 통화 대장만 다시 쓰고 요약 시트의 값을 확인하는 스크립트
    build_template.py             원본에서 템플릿을 다시 만드는 스크립트
    make_mock.py                  원본의 14건으로 가짜 JSON을 만드는 스크립트
  project.json, Main.xaml         UiPath 프로젝트. Asset 읽기, 스크립트 실행, 결과 확인을 맡는다.
  build_report.ps1                서버 목록을 받아 통화 대장을 다시 쓰고 엑셀을 저장하는 스크립트
  config.example.json             설정값 예시. config.json으로 복사해서 쓴다.
```

## 구성

| 부분 | 하는 일 |
|---|---|
| `Main.xaml` (UiPath) | Asset에서 서버 주소와 API 키를 읽어 `build_report.ps1`을 실행하고, 스크립트가 실패하면 예외를 던져 Job을 실패(Faulted)로 끝낸다. |
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

- Invoke Code의 VB 코드는 Studio 밖에서 컴파일해 가짜 JSON으로 성공(종료 코드 0)을, 없는 스크립트 경로로 실패(0이 아닌 값)를 받았다.
- 큐를 뺀 `Main.xaml`은 Studio의 분석기(`UiPath.Studio.CommandLine.exe analyze -p project.json`)에서 오류 0이고, 게시(컴파일)가 된다.
- Studio 실행, 올린 프로세스, 시간 트리거로는 아직 돌리지 않았다(11/24). Studio에서 실행할 때는 Orchestrator 폴더를 `Shared`로 고른다.

## 다시 게시할 때

게시하면 프로젝트 폴더의 파일이 패키지에 담겨 Orchestrator로 올라간다. 아래를 지킨다.

- `config.json`의 `OutputPath`는 프로젝트 폴더 밖의 전체 경로로 적는다. 상대 경로로 두면 엑셀이 패키지 설치 폴더 안에 저장되어 찾을 수 없다. 프로젝트 폴더 안에 두면 결과 엑셀이 패키지에 들어간다.
- 패키지에서 뺄 파일은 `project.json`의 `ignoredFiles`에 하나씩 적는다. 폴더 이름과 와일드카드는 듣지 않는다. `testdata`나 `tools`에 파일을 더하면 여기에도 적는다.
- Studio가 프로젝트를 열어 둔 채로 `project.json`이 밖에서 바뀌었으면, 프로젝트를 닫았다가 다시 연 뒤 게시한다. 게시 창의 현재 버전이 `project.json`과 같은지 본다.
- 게시한 뒤 Orchestrator `Shared`의 프로세스를 새 버전으로 올린다.
- 봇 PC는 켜고 로그인해 둔다. 사용자 방식 로봇이라 로그인되어 있어야 Job이 돈다.
- 무인 실행 자리가 1개다. ③의 Job 시작을 시험할 때는 ④의 시간 트리거를 잠깐 끈다.
- 결과 엑셀을 열어 두면 봇이 덮어쓰지 못해 1분마다 날짜시각이 붙은 파일이 생긴다. 볼 때는 복사본을 연다.

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
