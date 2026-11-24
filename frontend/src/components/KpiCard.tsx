import type { ReactNode } from 'react'

export type KpiTone = 'info' | 'warn' | 'danger' | 'neutral'

interface Props {
  title: string
  value: string | number
  /** 수치 옆의 짧은 설명(엑셀 대시보드의 카드 아래 줄과 같다) */
  sub?: string
  /** 레이블 앞의 작은 선 아이콘(16px). 배경 원은 깔지 않는다 */
  icon: ReactNode
  /** 수치 색. warn 주의, danger 오류 색. 그 외는 흰색 */
  tone?: KpiTone
}

/** 지표 한 칸. 색은 tone 으로 고르고 모양은 components.css 가 맡는다. */
export default function KpiCard({ title, value, sub, icon, tone = 'neutral' }: Props) {
  return (
    <div className={`kpi-card kpi-card--${tone}`}>
      <div className="kpi-card__label">
        {icon}
        <span>{title}</span>
      </div>
      <div className="kpi-card__row">
        <span className="kpi-card__value">{value}</span>
        {sub && <span className="kpi-card__sub">{sub}</span>}
      </div>
    </div>
  )
}
