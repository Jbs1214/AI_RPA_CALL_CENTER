import { Button, DatePicker, Input, Select } from 'antd'
import dayjs from 'dayjs'
import { CATEGORIES, type CallFilters as Filters, type Status } from '../../types/Call'
import { STATUS_LABEL } from '../../lib/statusLabel'
import { toKstDate } from '../../lib/date'
import { exportUrl } from '../../api/calls'
import { useStats } from '../stats/useStats'

interface Props {
  filters: Filters
  onChange: (next: Filters) => void
}

const yesNo = [
  { value: 'true', label: 'Y' },
  { value: 'false', label: 'N' },
]

const toBool = (v?: string) => (v === undefined ? undefined : v === 'true')

export default function CallFilters({ filters, onChange }: Props) {
  const { data: stats } = useStats({ from: filters.from, to: filters.to })
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch, page: 1 }) // 조건이 바뀌면 1쪽으로

  return (
    <div className="toolbar">
      <Input.Search
        allowClear
        placeholder="담당자·고객사·요지·조치 검색"
        style={{ width: 230 }}
        defaultValue={filters.q}
        onSearch={(q) => set({ q: q || undefined })}
      />
      <Select
        allowClear
        placeholder="유형"
        style={{ width: 110 }}
        value={filters.category}
        options={CATEGORIES.map((c) => ({ value: c, label: c }))}
        onChange={(category) => set({ category })}
      />
      <Select
        allowClear
        placeholder="담당자"
        style={{ width: 110 }}
        value={filters.agent}
        options={(stats?.by_agent ?? []).map((a) => ({ value: a.agent_name, label: a.agent_name }))}
        onChange={(agent) => set({ agent })}
      />
      <Select
        allowClear
        showSearch
        placeholder="고객사"
        style={{ width: 130 }}
        value={filters.company}
        options={(stats?.by_company ?? []).map((c) => ({ value: c.customer_company, label: c.customer_company }))}
        onChange={(company) => set({ company })}
      />
      <Select
        allowClear
        placeholder="상태"
        style={{ width: 100 }}
        value={filters.status}
        options={(Object.keys(STATUS_LABEL) as Status[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
        onChange={(status) => set({ status })}
      />
      <Select
        allowClear
        placeholder="후속조치"
        style={{ width: 100 }}
        value={filters.follow_up === undefined ? undefined : String(filters.follow_up)}
        options={yesNo}
        onChange={(v) => set({ follow_up: toBool(v) })}
      />
      <Select
        allowClear
        placeholder="검토 필요"
        style={{ width: 105 }}
        value={filters.needs_review === undefined ? undefined : String(filters.needs_review)}
        options={yesNo}
        onChange={(v) => set({ needs_review: toBool(v) })}
      />
      <DatePicker.RangePicker
        value={filters.from && filters.to ? [dayjs(filters.from), dayjs(filters.to)] : null}
        onChange={(r) => set({ from: r?.[0] ? toKstDate(r[0].toDate()) : undefined, to: r?.[1] ? toKstDate(r[1].toDate()) : undefined })}
      />
      <Button onClick={() => onChange({ page: 1, size: filters.size })}>초기화</Button>
      {/* 엑셀 다운로드(API 7): 목록과 같은 조건, 완료(DONE) 통화만 12열로 받는다 */}
      <Button href={exportUrl(filters)} target="_blank">엑셀 다운로드</Button>
    </div>
  )
}
