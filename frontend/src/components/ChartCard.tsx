import type { CSSProperties, ReactNode } from 'react'
import { Inbox } from 'lucide-react'

interface Props {
  title: string
  /** 제목 옆의 작은 설명 */
  hint?: string
  /** true 이면 차트 대신 빈 상태를 보여 준다 */
  empty: boolean
  /** 차트 높이(px). 안 주면 tokens.css 의 --chart-h */
  height?: number
  /** 차트 아래에 붙일 내용(범례 등). 높이는 차트 높이 안에서 나눠 쓴다 */
  footer?: ReactNode
  children: ReactNode
}

/** 차트 1개를 담는 패널. 높이는 CSS 변수로 넘기고 모양은 layout.css 가 맡는다. */
export default function ChartCard({ title, hint, empty, height, footer, children }: Props) {
  const style = height ? ({ '--chart-h': `${height}px` } as CSSProperties) : undefined
  return (
    <section className="panel chart-card">
      <div className="panel__head">
        <h3 className="panel__title">{title}</h3>
        {hint && <span className="chart-card__hint">{hint}</span>}
      </div>
      <div className="panel__body">
        <div className="chart-card__body" style={style}>
          {empty ? (
            <div className="empty">
              <Inbox size={20} strokeWidth={1.5} />
              <span>표시할 데이터가 없습니다.</span>
            </div>
          ) : (
            <>
              <div className="chart-card__plot">{children}</div>
              {footer}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
