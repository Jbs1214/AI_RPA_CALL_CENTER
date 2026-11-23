import type { Status } from './Call'

export interface ApiErrorBody {
  error: string
  message: string
  existing_call_id?: string // 409 DUPLICATE_FILE
  existing_status?: Status
}

/** axios 오류를 이 형태로 바꿔 화면에 넘긴다 (api/client.ts) */
export class ApiError extends Error {
  status: number | null // 응답이 없으면(서버 연결 실패) null
  code: string
  body?: ApiErrorBody

  constructor(status: number | null, code: string, message: string, body?: ApiErrorBody) {
    super(message)
    this.status = status
    this.code = code
    this.body = body
  }
}
