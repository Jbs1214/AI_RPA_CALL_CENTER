import type { Status } from '../types/Call'

export const STATUS_LABEL: Record<Status, string> = {
  RECEIVED: '대기',
  PROCESSING: '처리 중',
  DONE: '완료',
  FAILED: '실패',
}

/** Ant Design Tag 색 */
export const STATUS_COLOR: Record<Status, string> = {
  RECEIVED: 'default',
  PROCESSING: 'processing',
  DONE: 'success',
  FAILED: 'error',
}
