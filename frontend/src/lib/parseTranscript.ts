export interface Utterance {
  speaker: '상담원' | '고객' | '기타'
  text: string
}

/** "[상담원] ...\n[고객] ..." 문자열을 말풍선 목록으로 바꾼다 */
export function parseTranscript(transcript: string | null): Utterance[] {
  if (!transcript) return []
  return transcript
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^\[(상담원|고객)\]\s*(.*)$/)
      return m
        ? { speaker: m[1] as Utterance['speaker'], text: m[2] }
        : { speaker: '기타' as const, text: line }
    })
}
