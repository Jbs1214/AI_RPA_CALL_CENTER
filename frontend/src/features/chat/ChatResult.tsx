import { Button, Space, Tag, Typography } from 'antd'
import type { ChatResponse, SuggestedAction } from '../../types/Chat'
import { CATEGORY_COLOR } from '../../lib/categoryColor'
import { formatKst } from '../../lib/date'

const QUERY_LABEL: Record<string, string> = {
  q: '검색어',
  category: '유형',
  agent: '담당자',
  company: '고객사',
  status: '상태',
  follow_up: '후속조치',
  needs_review: 'AI 결과 검토',
  from: '시작',
  to: '끝',
}

function queryValue(key: string, v: string | number | boolean): string {
  if (key === 'follow_up') return v ? '필요' : '불필요'
  if (key === 'needs_review') return v ? '필요' : '완료'
  if (key === 'status') return v === 'FAILED' ? '실패' : String(v)
  return String(v)
}

interface Props {
  response: ChatResponse
  done: Set<string>
  actionKey: (a: SuggestedAction) => string
  acting: boolean
  onAction: (a: SuggestedAction) => void
}

export default function ChatResult({ response, done, actionKey, acting, onAction }: Props) {
  const { query, items, stats, suggested_actions: actions, mode, intent } = response
  const conditions = Object.entries(query)

  return (
    <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
      {intent !== 'help' && (
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            적용된 조건{' '}
          </Typography.Text>
          {conditions.length === 0 && <Tag style={{ marginInlineEnd: 4 }}>전체</Tag>}
          {conditions.map(([k, v]) => (
            <Tag key={k} style={{ marginInlineEnd: 4 }}>
              {QUERY_LABEL[k] ?? k}: {queryValue(k, v)}
            </Tag>
          ))}
          {mode === 'ai' && <Tag color="purple">AI 해석</Tag>}
        </div>
      )}

      {stats && (
        <div style={{ fontSize: 13, display: 'grid', gap: 4 }}>
          {stats.by_category && (
            <StatLine title="유형별" rows={stats.by_category.map((r) => [r.category, `${r.count}건`])} />
          )}
          {stats.by_agent && (
            <StatLine
              title="담당자별"
              rows={stats.by_agent.map((r) => [r.agent_name, `${r.count}건 (후속 ${r.follow_up_count})`])}
            />
          )}
          {stats.by_day && <StatLine title="일별" rows={stats.by_day.map((r) => [r.date, `${r.count}건`])} />}
        </div>
      )}

      {items.map((c) => (
        <div key={c.call_id} style={{ border: '1px solid #eee', borderRadius: 8, padding: '6px 10px', fontSize: 13, background: '#fff' }}>
          <Space size={6} wrap>
            <Typography.Text strong>{c.call_id}</Typography.Text>
            {c.category && <Tag color={CATEGORY_COLOR[c.category]}>{c.category}</Tag>}
            {c.status === 'FAILED' && <Tag color="red">실패</Tag>}
            {c.follow_up_needed && <Tag color="orange">후속조치</Tag>}
            {c.needs_review && <Tag color="gold">검토 필요</Tag>}
          </Space>
          <div style={{ color: '#666' }}>
            {formatKst(c.called_at)} · {c.agent_name}
            {c.customer_company ? ` · ${c.customer_company}` : ''}
          </div>
          {c.customer_question && <div>{c.customer_question}</div>}
        </div>
      ))}
      {intent !== 'detail' && response.total > items.length && items.length > 0 && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          전체 {response.total}건 중 {items.length}건만 보여 드립니다. 통화 목록에서 같은 조건으로 확인하세요.
        </Typography.Text>
      )}

      {actions.length > 0 && (
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          {actions.map((a) => {
            const finished = done.has(actionKey(a))
            return (
              <Button key={actionKey(a)} size="small" block disabled={finished || acting} onClick={() => onAction(a)}>
                {finished ? `✓ ${a.label}` : a.label}
              </Button>
            )
          })}
        </Space>
      )}
    </div>
  )
}

function StatLine({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div>
      <Typography.Text strong>{title}</Typography.Text>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
        {rows.map(([k, v]) => (
          <span key={k}>
            {k} {v}
          </span>
        ))}
      </div>
    </div>
  )
}
