import { parseErrorMessage } from './errorLabel'
import type { Call } from '../types/Call'

/** 목록에 보여 줄 "질문 요지" 글자. 실패한 통화는 실패 이유를 대신 보여 준다. 표와 모바일 카드가 같이 쓴다. */
export function callSummary(row: Call): { text: string; failed: boolean } {
  if (row.status === 'FAILED') {
    const e = parseErrorMessage(row.error_message)
    return { text: e ? `${e.label}${e.detail ? `: ${e.detail}` : ''}` : '실패', failed: true }
  }
  return { text: row.customer_question ?? '—', failed: false }
}
