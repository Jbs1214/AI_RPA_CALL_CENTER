import type { ReactNode } from 'react'

interface Props {
  title: string
  /** 사이드바 메뉴가 이동하는 자리의 id */
  id?: string
  /** 제목 오른쪽에 붙일 내용 */
  extra?: ReactNode
  children: ReactNode
}

/** 제목이 있는 한 덩어리 영역(패널). 보더로만 나누고 그림자는 쓰지 않는다. 모양은 components.css 가 맡는다. */
export default function Section({ title, id, extra, children }: Props) {
  return (
    <section id={id} className="panel">
      <div className="panel__head">
        <h2 className="panel__title">{title}</h2>
        {extra}
      </div>
      <div className="panel__body">{children}</div>
    </section>
  )
}
