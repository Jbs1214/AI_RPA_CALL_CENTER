import type { CSSProperties } from 'react'
import type { ChatResponse, SuggestedAction } from '../../types/Chat'
import { CATEGORY_COLOR } from '../../lib/categoryColor'
import { formatKst } from '../../lib/date'
import { EXAMPLES } from './constants'

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
  onPick: (text: string) => void // 질문 예시 칩을 눌렀을 때
  onOpenCall: (callId: string) => void // 통화 카드를 눌렀을 때(상세 화면 열기)
}

export default function ChatResult({ response, done, actionKey, acting, onAction, onPick, onOpenCall }: Props) {
  const { query, items, stats, suggested_actions: actions, mode, intent } = response
  const conditions = Object.entries(query)

  return (
    <div className="cb-result">
      {intent === 'help' && (
        <div className="cb-chips">
          {EXAMPLES.map((ex) => (
            <button key={ex} className="cb-chip" onClick={() => onPick(ex)}>
              {ex}
            </button>
          ))}
        </div>
      )}

      {intent !== 'help' && (
        <div className="cb-cond">
          <span>적용된 조건</span>
          {conditions.length === 0 && <span className="cb-tag">전체</span>}
          {conditions.map(([k, v]) => (
            <span key={k} className="cb-tag">
              {QUERY_LABEL[k] ?? k}: {queryValue(k, v)}
            </span>
          ))}
          {mode === 'ai' && <span className="cb-tag ai">AI 해석</span>}
        </div>
      )}

      {stats?.by_category && (
        <StatBlock title="유형별" rows={stats.by_category.map((r) => ({ name: r.category, value: r.count, label: `${r.count}건` }))} />
      )}
      {stats?.by_agent && (
        <StatBlock
          title="담당자별"
          rows={stats.by_agent.map((r) => ({ name: r.agent_name, value: r.count, label: `${r.count}건 (후속 ${r.follow_up_count})` }))}
        />
      )}
      {stats?.by_day && (
        <StatBlock title="일별" rows={stats.by_day.map((r) => ({ name: r.date.slice(5), value: r.count, label: `${r.count}건` }))} />
      )}

      {items.map((c) => (
        <div
          key={c.call_id}
          className="cb-card clickable"
          role="button"
          tabIndex={0}
          title="눌러서 상세 보기"
          onClick={() => onOpenCall(c.call_id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onOpenCall(c.call_id)
            }
          }}
          style={{ '--cb-accent': c.category ? CATEGORY_COLOR[c.category] : undefined } as CSSProperties}
        >
          <div className="cb-card-top">
            <span className="cb-card-id">{c.call_id}</span>
            {c.category && (
              <span className="cb-badge" style={{ background: CATEGORY_COLOR[c.category] }}>
                {c.category}
              </span>
            )}
            {c.status === 'FAILED' && <span className="cb-badge" style={{ background: '#d9534f' }}>실패</span>}
            {c.follow_up_needed && <span className="cb-badge" style={{ background: '#e9822b' }}>후속조치</span>}
            {c.needs_review && <span className="cb-badge" style={{ background: '#c9a100' }}>검토 필요</span>}
          </div>
          <div className="cb-card-meta">
            {formatKst(c.called_at)} · {c.agent_name}
            {c.customer_company ? ` · ${c.customer_company}` : ''}
          </div>
          <div className="cb-card-link">상세 보기 ›</div>
        </div>
      ))}
      {intent !== 'detail' && response.total > items.length && items.length > 0 && (
        <div className="cb-more">전체 {response.total}건 중 {items.length}건만 보여 드려요. 통화 목록에서 같은 조건으로 확인하세요.</div>
      )}

      {actions.map((a) => {
        const finished = done.has(actionKey(a))
        return (
          <button key={actionKey(a)} className={`cb-action${finished ? ' done' : ''}`} disabled={finished || acting} onClick={() => onAction(a)}>
            {finished ? `✓ ${a.label}` : a.label}
          </button>
        )
      })}
    </div>
  )
}

function StatBlock({ title, rows }: { title: string; rows: { name: string; value: number; label: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="cb-stat">
      <b>{title}</b>
      {rows.map((r) => (
        <div key={r.name} className="cb-stat-row">
          <span title={r.name}>{r.name}</span>
          <div className="cb-bar">
            <i style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <em>{r.label}</em>
        </div>
      ))}
    </div>
  )
}
