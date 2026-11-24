import type { ReactNode } from 'react'
import { Alert, Skeleton } from 'antd'
import { AlertTriangle, ClipboardCheck, Eye, PhoneCall, Percent, Tag } from 'lucide-react'
import KpiCard, { type KpiTone } from '../../components/KpiCard'
import { computeKpi } from '../../lib/kpi'
import { useStats, type DateRange } from './useStats'

interface Item {
  title: string
  value: string | number
  icon: ReactNode
  tone: KpiTone
}

const ICON = { size: 14, strokeWidth: 1.5 }

/** 지표 6칸을 한 패널 안에 붙여 보여 준다. 칸 사이는 1px 선이다. */
export default function KpiCards({ range }: { range: DateRange }) {
  const { data, error, isLoading } = useStats(range)

  if (isLoading) {
    return (
      <section id="summary" className="panel">
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
    { title: '분석된 통화', value: k.analyzed, icon: <PhoneCall {...ICON} />, tone: 'neutral' },
    { title: '후속조치 필요', value: k.followUp, icon: <ClipboardCheck {...ICON} />, tone: 'warn' },
    { title: 'AI 결과 검토 필요', value: k.needsReview, icon: <Eye {...ICON} />, tone: 'warn' },
    { title: '불만 통화', value: k.complaint, icon: <AlertTriangle {...ICON} />, tone: 'danger' },
    { title: '불만 비율', value: `${k.complaintRatio}%`, icon: <Percent {...ICON} />, tone: 'danger' },
    { title: '가장 많은 유형', value: k.topCategory, icon: <Tag {...ICON} />, tone: 'neutral' },
  ]

  return (
    <section id="summary" className="panel kpi-panel">
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
