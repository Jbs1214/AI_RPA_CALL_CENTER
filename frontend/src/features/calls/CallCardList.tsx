import { Button, Empty, Pagination, Popconfirm, Spin, Tag } from 'antd'
import { callSummary } from '../../lib/callSummary'
import { formatKst } from '../../lib/date'
import type { Call } from '../../types/Call'
import ProcessButton from './ProcessButton'
import StatusTag from './StatusTag'

interface Props {
  items: Call[]
  loading: boolean
  page: number
  size: number
  total: number
  onPage: (page: number, size: number) => void
  onOpen: (callId: string) => void
  onDelete: (callId: string) => void
  /** 메인 화면용: 쪽 번호와 처리 시작·삭제 버튼을 뺀다 */
  compact?: boolean
}

/** 좁은 화면용 통화 목록: 표 대신 통화 1건을 카드 1장으로 보여 줘서 옆으로 밀지 않아도 된다. */
export default function CallCardList({ items, loading, page, size, total, onPage, onOpen, onDelete, compact = false }: Props) {
  if (loading) return <Spin className="call-cards__loading" />
  if (items.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="조건에 맞는 통화가 없습니다" />

  return (
    <>
      <ul className="call-cards">
        {items.map((row) => {
          const s = callSummary(row)
          const tone = row.status === 'FAILED' ? ' call-card--failed' : row.needs_review ? ' call-card--review' : ''
          return (
            <li key={row.call_id} className={`call-card${tone}`}>
              {/* 카드 몸통을 누르면 상세 패널이 열린다 */}
              <div
                role="button"
                tabIndex={0}
                className="call-card__body"
                onClick={() => onOpen(row.call_id)}
                onKeyDown={(e) => e.key === 'Enter' && onOpen(row.call_id)}
              >
                <div className="call-card__top">
                  <span className="call-card__date">{formatKst(row.called_at)}</span>
                  <StatusTag status={row.status} />
                </div>
                <div className="call-card__who">
                  {row.agent_name} · {row.customer_company ?? '-'}
                </div>
                <div className={`call-card__summary${s.failed ? ' text-danger' : ''}`}>{s.text}</div>
                <div className="call-card__tags">
                  {row.category && <Tag>{row.category}</Tag>}
                  {row.follow_up_needed && <Tag color="red">후속조치</Tag>}
                  {row.needs_review && <Tag color="gold">검토</Tag>}
                </div>
              </div>
              {!compact && (
                <div className="call-card__actions">
                  <ProcessButton call={row} />
                  <Button size="small" type="link" onClick={() => onOpen(row.call_id)}>
                    보기
                  </Button>
                  <Popconfirm
                    title="삭제할까요?"
                    description="이 통화와 음성 파일이 함께 삭제되며 되돌릴 수 없습니다."
                    okText="삭제"
                    okButtonProps={{ danger: true }}
                    cancelText="취소"
                    onConfirm={() => onDelete(row.call_id)}
                  >
                    <Button size="small" type="link" danger>
                      삭제
                    </Button>
                  </Popconfirm>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {!compact && (
        <Pagination className="call-cards__pager" size="small" simple current={page} pageSize={size} total={total} showSizeChanger={false} onChange={onPage} />
      )}
    </>
  )
}
