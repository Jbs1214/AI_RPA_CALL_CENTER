import { BarChart3, LayoutDashboard, ListChecks, Upload, type LucideIcon } from 'lucide-react'

interface NavItem {
  /** 본문 영역의 id (`#id` 로 이동) */
  target: string
  label: string
  icon: LucideIcon
}

const NAV: NavItem[] = [
  { target: 'summary', label: '요약 지표', icon: LayoutDashboard },
  { target: 'calls', label: '통화 목록', icon: ListChecks },
  { target: 'upload', label: '음성 업로드', icon: Upload },
  { target: 'charts', label: '통계 차트', icon: BarChart3 },
]

/** 왼쪽 고정 사이드바. 메뉴는 본문의 각 영역으로 이동한다. 좁은 화면에서는 위쪽 가로 줄이 된다. */
export default function AppSidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__logo">AIRPA</span>
        <span className="sidebar__name">콜센터 AI·RPA 비서</span>
      </div>
      <nav className="sidebar__nav" aria-label="화면 이동">
        {NAV.map(({ target, label, icon: Icon }) => (
          <a key={target} className="sidebar__link" href={`#${target}`}>
            <Icon size={16} strokeWidth={1.5} />
            <span>{label}</span>
          </a>
        ))}
      </nav>
    </aside>
  )
}
