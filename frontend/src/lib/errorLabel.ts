// 실패 코드 → 한글 문구 (통합본 7.4). 모르는 코드는 그대로 보여 준다.
const CODE_LABEL: Record<string, string> = {
  STT_FAILED: '음성 변환 실패',
  STT_TIMEOUT: '변환 시간 초과',
  EMPTY_TRANSCRIPT: '변환 결과가 비어 있음',
  LLM_FAILED: 'AI 분석 실패',
  INVALID_OUTPUT: 'AI 결과 형식 오류',
  JOB_FAULTED: '봇 작업 오류',
  JOB_STOPPED: '봇 작업 중지',
  NO_RESULT: '결과 없이 종료',
  TIMEOUT: '처리 시간 초과',
}

/** error_message 는 "코드: 설명" 형식이다. 첫 ':' 에서 나눈다. */
export function parseErrorMessage(message: string | null): { code: string; label: string; detail: string } | null {
  if (!message) return null
  const i = message.indexOf(':')
  const code = (i < 0 ? message : message.slice(0, i)).trim()
  const detail = i < 0 ? '' : message.slice(i + 1).trim()
  return { code, label: CODE_LABEL[code] ?? code, detail }
}
