import type { ReactNode } from 'react'

interface Props {
  title: string
  /** 제목 아래 한 줄 설명 */
  desc?: string
  /** 오른쪽에 붙일 내용(기간 선택 등) */
  extra?: ReactNode
}

/** 페이지 맨 위의 제목 줄. */
export default function PageHeader({ title, desc, extra }: Props) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-head__title">{title}</h1>
        {desc && <p className="page-head__desc">{desc}</p>}
      </div>
      {extra}
    </div>
  )
}
