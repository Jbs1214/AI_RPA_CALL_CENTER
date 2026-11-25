import { CATEGORIES } from '../types/Call'
import type { Stats } from '../types/Stats'

/** 카드 6개의 계산 — 통합본 8장과 같다. 엑셀 대시보드와 같은 정의를 쓴다. */
export function computeKpi(stats: Stats) {
  const complaint = stats.by_category.find((c) => c.category === '불만')?.count ?? 0
  // 불만 비율: 정수로 반올림, 분석된 통화가 0이면 0%
  const complaintRatio = stats.analyzed === 0 ? 0 : Math.round((complaint / stats.analyzed) * 100)
  // 가장 많은 유형: 동률이면 유형 고정 순서에서 앞선 것
  let top = CATEGORIES[0] as string
  let topCount = -1
  for (const cat of CATEGORIES) {
    const n = stats.by_category.find((c) => c.category === cat)?.count ?? 0
    if (n > topCount) {
      top = cat
      topCount = n
    }
  }
  return {
    analyzed: stats.analyzed,
    followUp: stats.follow_up_needed,
    needsReview: stats.needs_review,
    complaint,
    complaintRatio,
    topCategory: stats.analyzed === 0 ? '-' : top,
    topCount: Math.max(topCount, 0),
    /** 분석된 통화 중 n건의 비율(정수 반올림). 분석된 통화가 0이면 0 */
    percentOf: (n: number) => (stats.analyzed === 0 ? 0 : Math.round((n / stats.analyzed) * 100)),
  }
}
