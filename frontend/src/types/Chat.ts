// POST /api/chat (API 8) 요청·응답 타입. 근거: backend/app/routers/chat.py, 설계서 8장
import type { Call, CallPatch } from './Call'
import type { Stats } from './Stats'

export type ChatIntent = 'list' | 'stats' | 'detail' | 'action' | 'help'
export type ChatMode = 'rule' | 'ai'

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  message: string
  history?: ChatTurn[] // 최근 6개. AI 방식에서만 쓴다
}

/** 서버가 실제로 적용한 조건. 키는 목록 필터와 같다 */
export type ChatQuery = Record<string, string | number | boolean>

export interface SuggestedAction {
  label: string
  method: 'PATCH'
  path: string // /api/calls/{call_id}
  body: CallPatch
}

export interface ChatResponse {
  reply: string
  intent: ChatIntent
  mode: ChatMode
  query: ChatQuery
  total: number
  items: Call[] // 최대 5건
  stats: Partial<Pick<Stats, 'by_category' | 'by_agent' | 'by_day'>> | null
  suggested_actions: SuggestedAction[]
}
