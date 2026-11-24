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

// 서버 API 가 돌려주는 오류 코드(처리 시작 API 12) → 한글 문구
const API_ERROR_LABEL: Record<string, string> = {
  INVALID_STATE: '지금 상태에서는 처리할 수 없습니다. 이미 처리 중이거나 음성 파일이 없는 통화입니다.',
  ORCHESTRATOR_ERROR: '작업을 시작하지 못했습니다. 잠시 후 다시 시도하세요.',
}

/** 화면에 보여 줄 오류 문구. 모르는 코드는 서버가 보낸 문구를 그대로 보여 준다. */
export function apiErrorLabel(e: Error & { code?: string }): string {
  return (e.code && API_ERROR_LABEL[e.code]) || e.message
}

/** error_message 는 "코드: 설명" 형식이다. 첫 ':' 에서 나눈다. */
export function parseErrorMessage(message: string | null): { code: string; label: string; detail: string } | null {
  if (!message) return null
  const i = message.indexOf(':')
  const code = (i < 0 ? message : message.slice(0, i)).trim()
  const detail = i < 0 ? '' : message.slice(i + 1).trim()
  return { code, label: CODE_LABEL[code] ?? code, detail }
}
