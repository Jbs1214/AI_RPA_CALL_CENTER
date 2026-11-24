import { Moon, Sun } from 'lucide-react'
import { useThemeMode } from '../theme/useThemeMode'

/** 헤더의 라이트/다크 전환 버튼. 투명 배경에 선 아이콘만 쓴다(Ghost 버튼). */
export default function ThemeToggle() {
  const { mode, toggle } = useThemeMode()
  const next = mode === 'dark' ? '라이트' : '다크'
  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-label={`${next} 모드로 바꾸기`} title={`${next} 모드`}>
      {mode === 'dark' ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
    </button>
  )
}
