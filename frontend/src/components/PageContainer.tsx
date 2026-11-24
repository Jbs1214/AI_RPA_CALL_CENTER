import type { ReactNode } from 'react'

export type PageWidth = 'narrow' | 'default' | 'wide'

interface Props {
  /** 본문 최대 폭. 기본은 default(tokens.css 의 --page-max) */
  width?: PageWidth
  /** 바깥 요소에 덧붙일 클래스 */
  className?: string
  children: ReactNode
}

/** 가운데 정렬과 좌우 여백을 맡는다. 폭 종류는 props 로 고른다. */
export default function PageContainer({ width = 'default', className, children }: Props) {
  const cls = ['page', width !== 'default' && `page--${width}`, className].filter(Boolean).join(' ')
  return <div className={cls}>{children}</div>
}
