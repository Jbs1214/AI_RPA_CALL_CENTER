# frontend — ② 프론트엔드 / 챗봇

담당: 수창(메인 화면), 성진

통화 분석 결과를 한 화면에서 보고(통계·목록), 고치고(수정·삭제·확인 완료), 음성을 올려 처리 상태를 확인하는 웹 화면이다. React 18, TypeScript, Vite, Ant Design 5, Recharts, TanStack Query, axios.

## 기준 문서

- `docs/설계서_2_프론트엔드_v3.pdf`: 화면 구성, 카드 6개와 차트 4개, 호출하는 API, 타입, 폴더 구조
- `docs/PRD_1_백엔드_v3.md`, `docs/설계서_1_백엔드_v2.pdf`: 서버 API
- `docs/제품요구사항정의서_v2.2.md` 8장: 웹과 엑셀이 같이 쓰는 지표 정의

## 폴더 구조 (설계서 7장)

아래는 설계서의 폴더 구조다. 실제 코드와 다른 곳은 담당자가 이 파일을 고친다.

```
frontend/
  src/
    main.tsx, App.tsx    레이아웃, QueryClientProvider, ChatWidget 자리 한 줄
    api/
      client.ts          axios(baseURL, 오류 → ApiError 변환)
      calls.ts           목록·상세·수정·삭제·업로드·음성 주소
      stats.ts           통계
    types/               Call.ts, Stats.ts, ApiError.ts
    features/
      stats/             KpiCards, CategoryChart, DailyTrendChart, AgentChart, CompanyChart
      calls/             CallFilters, CallTable, CallDrawer, TranscriptBubbles, ReviewBadge
      upload/            UploadDropzone, UploadForm, StatusTag
      chat/              챗봇 담당 팀원의 폴더. 챗봇은 이 폴더만 수정한다.
    lib/                 statusLabel.ts, errorLabel.ts, date.ts (KST), parseTranscript.ts
    mocks/               handlers.ts (MSW, 서버 설계서의 예시 JSON)
```

서버 주소는 환경변수 `VITE_API_BASE_URL`로 바꾼다.

## 엑셀과 맞춰야 하는 것

웹의 카드 6개는 ④가 만드는 엑셀 대시보드의 지표 6개와 같은 정의를 쓴다. 화 12:00에 seed 데이터로 숫자를 대조한다(분석된 통화 14, 후속조치 필요 6, 검토 필요 2, 불만 통화 3, 불만 비율 21%, 가장 많은 유형 질의).

웹의 "엑셀 다운로드"는 서버가 만드는 12열 통화 목록이다. ④의 3시트 엑셀(`콜센터_엑셀_최신.xlsx`)은 웹에서 받지 않는다.
