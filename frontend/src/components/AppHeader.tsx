import { useQuery } from '@tanstack/react-query'
import { fetchHealth } from '../api/calls'
import ThemeToggle from './ThemeToggle'

/** 위쪽 얇은 헤더: 현재 위치와 서버 상태. 상태는 GET /health 의 실제 응답이다. */
export default function AppHeader() {
  const { data, isError, isLoading } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })
  const ok = data?.status === 'ok'
  const tone = isLoading ? 'wait' : ok ? 'ok' : 'err'
  const text = isLoading ? '서버 확인 중' : ok ? '서버 정상' : isError ? '서버 연결 안 됨' : '서버 점검 필요'

  return (
    <header className="topbar">
      <div className="topbar__path">
        <span>대시보드</span>
        <span className="topbar__sep">/</span>
        <b>통화 분석</b>
      </div>
      <div className="topbar__tools">
        <span className={`topbar__status topbar__status--${tone}`}>
          <i className="dot" />
          {text}
        </span>
        <ThemeToggle />
      </div>
    </header>
  )
}
