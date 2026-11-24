import type { ReactNode } from 'react'

export type KpiTone = 'info' | 'warn' | 'danger' | 'neutral'

interface Props {
  title: string
  value: string | number
  /** 왼쪽 아이콘 */
  icon: ReactNode
  /** 강조 색. info 파랑, warn 주황, danger 빨강, neutral 회색 */
  tone?: KpiTone
}

/** 숫자 카드 1개. 색은 tone 으로 고르고 모양은 components.css 가 맡는다. */
export default function KpiCard({ title, value, icon, tone = 'neutral' }: Props) {
  return (
    <div className={`kpi-card kpi-card--${tone}`}>
      <span className="kpi-card__icon">{icon}</span>
      <div className="kpi-card__text">
        <div className="kpi-card__label">{title}</div>
        <div className="kpi-card__value">{value}</div>
      </div>
    </div>
  )
}
