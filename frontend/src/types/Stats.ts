import type { Category } from './Call'

export interface Stats {
  total_calls: number
  analyzed: number // 분석된 통화(DONE)
  follow_up_needed: number
  needs_review: number
  failed: number
  in_progress: number
  by_category: { category: Category; count: number }[]
  by_agent: { agent_name: string; count: number; follow_up_count: number }[]
  by_day: { date: string; count: number; by_category: Record<Category, number> }[]
  by_company: { customer_company: string; count: number; complaint_count: number }[]
}
