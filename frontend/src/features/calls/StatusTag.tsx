import { Tag } from 'antd'
import { ClockCircleOutlined, SyncOutlined } from '@ant-design/icons'
import { STATUS_COLOR, STATUS_LABEL } from '../../lib/statusLabel'
import type { Call } from '../../types/Call'

/** 상태 태그. 대기·처리 중은 아이콘을 붙여 눈에 띄게 한다(처리 중은 빙글빙글). 표와 모바일 카드가 같이 쓴다. */
export default function StatusTag({ status }: { status: Call['status'] }) {
  const icon = status === 'PROCESSING' ? <SyncOutlined spin /> : status === 'RECEIVED' ? <ClockCircleOutlined /> : undefined
  return (
    <Tag color={STATUS_COLOR[status]} icon={icon}>
      {STATUS_LABEL[status]}
    </Tag>
  )
}
