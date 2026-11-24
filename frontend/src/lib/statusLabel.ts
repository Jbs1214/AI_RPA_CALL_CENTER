import type { Status } from '../types/Call'

export const STATUS_LABEL: Record<Status, string> = {
  RECEIVED: '대기',
  PROCESSING: '처리 중',
  DONE: '완료',
  FAILED: '실패',
}

/** 뱃지 색 이름: ok 정상, wait 대기·주의, err 오류, idle 중립 (components.css 의 .badge--*) */
export const STATUS_TONE: Record<Status, 'ok' | 'wait' | 'err' | 'idle'> = {
  RECEIVED: 'idle',
  PROCESSING: 'wait',
  DONE: 'ok',
  FAILED: 'err',
}
