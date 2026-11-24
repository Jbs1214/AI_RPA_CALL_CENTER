import type { ReactNode } from 'react'
import { Card } from 'antd'

interface Props {
  title: string
  /** 제목 오른쪽에 붙일 내용 */
  extra?: ReactNode
  children: ReactNode
}

/** 제목이 있는 한 덩어리 영역. 화면의 카드형 섹션은 이걸로 통일한다. */
export default function Section({ title, extra, children }: Props) {
  return (
    <Card size="small" title={title} extra={extra}>
      {children}
    </Card>
  )
}
