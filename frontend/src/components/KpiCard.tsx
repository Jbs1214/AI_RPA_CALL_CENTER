import type { ReactNode } from 'react'

export type KpiTone = 'info' | 'warn' | 'danger' | 'neutral'

interface Props {
  title: string
  value: string | number
  /** 레이블 앞의 작은 선 아이콘(16px). 배경 원은 깔지 않는다 */
  icon: ReactNode
  /** 수치 색. warn 주의, danger 오류 색. 그 외는 흰색 */
  tone?: KpiTone
}

/** 지표 한 칸. 색은 tone 으로 고르고 모양은 components.css 가 맡는다. */
export default function KpiCard({ title, value, icon, tone = 'neutral' }: Props) {
  return (
    <div className={`kpi-card kpi-card--${tone}`}>
      <div className="kpi-card__label">
        {icon}
        <span>{title}</span>
      </div>
      <div className="kpi-card__value">{value}</div>
    </div>
  )
}
