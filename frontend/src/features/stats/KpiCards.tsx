import type { ReactNode } from 'react'
import { Tag, Alert, Spin } from 'antd'
import {
  CrownOutlined,
  EyeOutlined,
  PercentageOutlined,
  PhoneOutlined,
  ScheduleOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import KpiCard, { type KpiTone } from '../../components/KpiCard'
import { computeKpi } from '../../lib/kpi'
import { useStats, type DateRange } from './useStats'

interface Item {
  title: string
  value: string | number
  icon: ReactNode
  tone: KpiTone
}

export default function KpiCards({ range }: { range: DateRange }) {
  const { data, error, isLoading } = useStats(range)

  if (isLoading) return <Spin />
  if (error || !data) return <Alert type="error" showIcon message={error?.message ?? '통계를 불러오지 못했습니다'} />

  const k = computeKpi(data)
  const items: Item[] = [
    { title: '분석된 통화', value: k.analyzed, icon: <PhoneOutlined />, tone: 'info' },
    { title: '후속조치 필요', value: k.followUp, icon: <ScheduleOutlined />, tone: 'warn' },
    { title: 'AI 결과 검토 필요', value: k.needsReview, icon: <EyeOutlined />, tone: 'warn' },
    { title: '불만 통화', value: k.complaint, icon: <WarningOutlined />, tone: 'danger' },
    { title: '불만 비율', value: `${k.complaintRatio}%`, icon: <PercentageOutlined />, tone: 'danger' },
    { title: '가장 많은 유형', value: k.topCategory, icon: <CrownOutlined />, tone: 'neutral' },
  ]

  return (
    <>
      <div className="kpi-grid">
        {items.map((it) => (
          <KpiCard key={it.title} {...it} />
        ))}
      </div>
      <div className="kpi-tags">
        {data.in_progress > 0 && <Tag color="processing">처리 중 {data.in_progress}건</Tag>}
        {data.failed > 0 && <Tag color="error">실패 {data.failed}건</Tag>}
      </div>
    </>
  )
}
