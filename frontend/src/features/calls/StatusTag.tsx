import { STATUS_LABEL, STATUS_TONE } from '../../lib/statusLabel'
import type { Call } from '../../types/Call'

/** 상태 뱃지. 처리 중은 앞의 점만 은은하게 깜빡인다. 표와 모바일 카드가 같이 쓴다. */
export default function StatusTag({ status }: { status: Call['status'] }) {
  const tone = STATUS_TONE[status]
  return (
    <span className={`badge badge--${tone}`}>
      <i className={status === 'PROCESSING' ? 'dot dot--pulse' : 'dot'} />
      {STATUS_LABEL[status]}
    </span>
  )
}
