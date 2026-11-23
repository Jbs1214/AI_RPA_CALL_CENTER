import { useQuery } from '@tanstack/react-query'
import { fetchStats } from '../../api/stats'
import { POLL_INTERVAL_MS } from '../../lib/polling'

export interface DateRange {
  from?: string
  to?: string
}

/** 카드·차트가 같은 쿼리를 공유한다 (한 번만 호출). 필터의 기간을 같이 보낸다. */
export function useStats(range: DateRange = {}) {
  return useQuery({
    queryKey: ['stats', range.from ?? null, range.to ?? null],
    queryFn: () => fetchStats(range),
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false, // 탭이 숨겨지면 멈춘다
  })
}
