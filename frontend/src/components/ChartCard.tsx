import type { CSSProperties, ReactNode } from 'react'
import { Card, Empty } from 'antd'

interface Props {
  title: string
  /** 제목 오른쪽의 작은 설명 */
  hint?: string
  /** true 이면 차트 대신 "데이터 없음"을 보여 준다 */
  empty: boolean
  /** 차트 높이(px). 안 주면 tokens.css 의 --chart-h */
  height?: number
  /** 차트 아래에 붙일 내용(범례 등). 높이는 차트 높이 안에서 나눠 쓴다 */
  footer?: ReactNode
  children: ReactNode
}

/** 차트 1개를 담는 카드. 높이는 CSS 변수로 넘기고 모양은 layout.css 가 맡는다. */
export default function ChartCard({ title, hint, empty, height, footer, children }: Props) {
  const style = height ? ({ '--chart-h': `${height}px` } as CSSProperties) : undefined
  return (
    <Card
      size="small"
      title={
        <div className="chart-card__title">
          <div>{title}</div>
          {hint && <div className="chart-card__hint">{hint}</div>}
        </div>
      }
    >
      <div className="chart-card__body" style={style}>
        {empty ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="데이터 없음" />
        ) : (
          <>
            <div className="chart-card__plot">{children}</div>
            {footer}
          </>
        )}
      </div>
    </Card>
  )
}
