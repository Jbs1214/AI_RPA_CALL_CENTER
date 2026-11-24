import type { ReactNode } from 'react'
import { Alert, Skeleton } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ClipboardCheck, Eye, PhoneCall, Percent, Tag } from 'lucide-react'
import KpiCard, { type KpiTone } from '../../components/KpiCard'
import { fetchCalls } from '../../api/calls'
import { computeKpi } from '../../lib/kpi'
import { POLL_INTERVAL_MS } from '../../lib/polling'
import { useStats, type DateRange } from './useStats'

interface Item {
  title: string
  value: string | number
  sub?: string
  icon: ReactNode
  tone: KpiTone
}

const ICON = { size: 14, strokeWidth: 1.5 }

/**
 * 지표 6칸을 한 패널 안에 붙여 보여 준다. 칸 사이는 1px 선이다.
 * 수치는 기본이 글자색이고, 사람이 처리해야 하는 것(후속조치 필요, AI 결과 검토 필요)이 1건 이상일 때만 빨갛게 한다.
 */
export default function KpiCards({ range }: { range: DateRange }) {
  const { data, error, isLoading } = useStats(range)
  // 불만 통화 중 후속조치가 필요한 건수(엑셀 카드 아래 줄). 목록 API 의 total 로 센다
  const { data: complaintFollowUp } = useQuery({
    queryKey: ['calls', 'complaint-follow-up', range.from ?? null, range.to ?? null],
    queryFn: () => fetchCalls({ category: '불만', follow_up: true, status: 'DONE', page: 1, size: 1, from: range.from, to: range.to }),
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    select: (r) => r.total,
  })

  if (isLoading) {
    return (
      <section className="panel">
        <div className="panel__body">
          <Skeleton active title={false} paragraph={{ rows: 2 }} />
        </div>
      </section>
    )
  }
  if (error || !data) {
    return <Alert type="error" showIcon message={error?.message ?? '통계를 불러오지 못했습니다'} />
  }

  const k = computeKpi(data)
  const items: Item[] = [
    { title: '분석된 통화', value: k.analyzed, sub: '완료 통화 기준', icon: <PhoneCall {...ICON} />, tone: 'neutral' },
    { title: '후속조치 필요', value: k.followUp, sub: `전체의 ${k.percentOf(k.followUp)}%`, icon: <ClipboardCheck {...ICON} />, tone: k.followUp > 0 ? 'danger' : 'neutral' },
    { title: 'AI 결과 검토 필요', value: k.needsReview, sub: `전체의 ${k.percentOf(k.needsReview)}%`, icon: <Eye {...ICON} />, tone: k.needsReview > 0 ? 'danger' : 'neutral' },
    {
      title: '불만 통화',
      value: k.complaint,
      sub: complaintFollowUp === undefined ? undefined : `후속조치 ${complaintFollowUp}건`,
      icon: <AlertTriangle {...ICON} />,
      tone: 'neutral',
    },
    { title: '불만 비율', value: `${k.complaintRatio}%`, sub: `${k.complaint}건 / ${k.analyzed}건`, icon: <Percent {...ICON} />, tone: 'neutral' },
    { title: '가장 많은 유형', value: k.topCategory, sub: `${k.topCount}건`, icon: <Tag {...ICON} />, tone: 'neutral' },
  ]

  return (
    <section className="panel kpi-panel">
      <div className="kpi-grid">
        {items.map((it) => (
          <KpiCard key={it.title} {...it} />
        ))}
      </div>
      {(data.in_progress > 0 || data.failed > 0) && (
        <div className="kpi-tags">
          {data.in_progress > 0 && (
            <span className="badge badge--wait">
              <i className="dot dot--pulse" />처리 중 {data.in_progress}건
            </span>
          )}
          {data.failed > 0 && (
            <span className="badge badge--err">
              <i className="dot" />실패 {data.failed}건
            </span>
          )}
        </div>
      )}
    </section>
  )
}
