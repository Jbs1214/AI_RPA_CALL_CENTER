import { useState } from 'react'
import { DatePicker } from 'antd'
import dayjs from 'dayjs'
import PageHeader from '../components/PageHeader'
import Charts from '../features/stats/Charts'
import type { DateRange } from '../features/stats/useStats'
import { toKstDate } from '../lib/date'

/** 통계: 차트 4개. 기간을 고르면 차트가 그 기간으로 바뀐다. */
export default function StatsPage() {
  const [range, setRange] = useState<DateRange>({})
  return (
    <main className="page">
      <PageHeader
        title="통계"
        desc="분석된 통화 기준"
        extra={
          <DatePicker.RangePicker
            value={range.from && range.to ? [dayjs(range.from), dayjs(range.to)] : null}
            onChange={(r) =>
              setRange({
                from: r?.[0] ? toKstDate(r[0].toDate()) : undefined,
                to: r?.[1] ? toKstDate(r[1].toDate()) : undefined,
              })
            }
          />
        }
      />
      <Charts range={range} />
    </main>
  )
}
