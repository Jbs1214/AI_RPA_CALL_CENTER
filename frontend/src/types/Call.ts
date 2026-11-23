// 서버 응답 타입. 서버 필드 이름이 바뀌면 src/types/ 와 src/api/ 두 곳만 고친다.
// 근거: docs/설계서_1_백엔드_v2.pdf, docs/설계서_2_프론트엔드_v3.pdf 5장

export type Status = 'RECEIVED' | 'PROCESSING' | 'DONE' | 'FAILED'

export const CATEGORIES = ['질의', '불만', '건의', '교육 내용', '기타 문의'] as const
export type Category = (typeof CATEGORIES)[number]

export interface Call {
  call_id: string
  called_at: string // 2026-11-23T10:15:30+09:00
  agent_name: string
  customer_company: string | null
  customer_phone: string | null // 마스킹된 값, 없으면 null
  category: Category | null
  customer_question: string | null
  action_taken: string | null
  follow_up_needed: boolean | null
  needs_review: boolean | null
  source_filename: string
  file_hash: string
  status: Status
  error_message: string | null // "코드: 설명"
  retry_count: number
  audio_available: boolean
  job_state: string | null
  created_at: string
  updated_at: string
}

export interface AnalysisJson {
  customer_name?: string | null
  duration_sec?: number
}

export interface CallDetail extends Call {
  confidence: number | null // 음성 인식 신뢰도
  audio_size_bytes: number | null
  job_key: string | null
  transcript: string | null // "[상담원] ...\n[고객] ..."
  analysis_json: AnalysisJson | null
}

export interface CallList {
  total: number
  page: number
  size: number
  items: Call[]
}

/** 목록·통계·엑셀 다운로드가 같이 쓰는 필터 조건 */
export interface CallFilters {
  q?: string
  category?: Category
  agent?: string
  company?: string
  status?: Status
  follow_up?: boolean
  needs_review?: boolean
  from?: string // YYYY-MM-DD (한국 날짜)
  to?: string // YYYY-MM-DD, 당일 포함
  page?: number
  size?: number
}

/** PATCH /api/calls/{id} — 바꾼 항목만 보낸다 */
export type CallPatch = Partial<
  Pick<
    Call,
    | 'category'
    | 'customer_question'
    | 'action_taken'
    | 'follow_up_needed'
    | 'needs_review'
    | 'customer_company'
    | 'customer_phone'
  >
>
