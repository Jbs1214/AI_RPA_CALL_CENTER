import { NavLink } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'

interface NavItem {
  to: string
  label: string
  /** true 이면 주소가 정확히 같을 때만 현재 메뉴로 친다 */
  end?: boolean
}

const NAV: NavItem[] = [
  { to: '/', label: '대시보드', end: true },
  { to: '/stats', label: '통계' },
]

/**
 * 위쪽 메뉴 줄: 왼쪽 로고(AIRPA), 가운데 왼쪽에 메뉴, 오른쪽 끝에 라이트/다크 버튼.
 * 안쪽은 본문과 같은 폭에 맞춘다. 현재 메뉴는 글자가 진해지고 아래에 파란 막대가 붙는다.
 */
export default function AppHeader() {
  return (
    <header className="topnav">
      <div className="topnav__inner">
        <NavLink to="/" className="topnav__logo" aria-label="AIRPA 대시보드로 이동">
          <span className="topnav__logo-ai">AI</span>RPA
        </NavLink>
        <nav className="topnav__menu" aria-label="화면 이동">
          {NAV.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} className="topnav__link">
              {label}
            </NavLink>
          ))}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  )
}
