import { Badge, Button, DatePicker, Input, Popover, Select } from 'antd'
import { SlidersHorizontal } from 'lucide-react'
import dayjs from 'dayjs'
import { CATEGORIES, type CallFilters as Filters, type Status } from '../../types/Call'
import { STATUS_LABEL } from '../../lib/statusLabel'
import { toKstDate } from '../../lib/date'
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

/**
 * 통화 목록 필터. 자주 쓰는 것(검색, 유형, 상태, 기간)만 한 줄에 두고,
 * 담당자·고객사·후속조치·검토 필요는 "상세 조건" 팝오버에 모았다.
 */
export default function CallFilters({ filters, onChange }: Props) {
  const { data: stats } = useStats({ from: filters.from, to: filters.to })
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch, page: 1 }) // 조건이 바뀌면 1쪽으로

  // 팝오버 안 조건이 몇 개 걸려 있는지(버튼에 숫자로 보여 준다)
  const detailCount = [filters.agent, filters.company, filters.follow_up, filters.needs_review].filter((v) => v !== undefined).length
  const anyFilter =
    detailCount > 0 || [filters.q, filters.category, filters.status, filters.from, filters.to].some((v) => v !== undefined && v !== '')

  const detail = (
    <div className="toolbar-detail">
      <Select
        allowClear
        placeholder="담당자"
        value={filters.agent}
        options={(stats?.by_agent ?? []).map((a) => ({ value: a.agent_name, label: a.agent_name }))}
        onChange={(agent) => set({ agent })}
      />
      <Select
        allowClear
        showSearch
        placeholder="고객사"
        value={filters.company}
        options={(stats?.by_company ?? []).map((c) => ({ value: c.customer_company, label: c.customer_company }))}
        onChange={(company) => set({ company })}
      />
      <Select
        allowClear
        placeholder="후속조치"
        value={filters.follow_up === undefined ? undefined : String(filters.follow_up)}
        options={yesNo}
        onChange={(v) => set({ follow_up: toBool(v) })}
      />
      <Select
        allowClear
        placeholder="검토 필요"
        value={filters.needs_review === undefined ? undefined : String(filters.needs_review)}
        options={yesNo}
        onChange={(v) => set({ needs_review: toBool(v) })}
      />
    </div>
  )

  return (
    <div className="toolbar">
      <Input.Search
        allowClear
        className="toolbar__search"
        placeholder="담당자·고객사·요지·조치 검색"
        defaultValue={filters.q}
        onSearch={(q) => set({ q: q || undefined })}
      />
      <Select
        allowClear
        placeholder="유형"
        style={{ width: 100 }}
        value={filters.category}
        options={CATEGORIES.map((c) => ({ value: c, label: c }))}
        onChange={(category) => set({ category })}
      />
      <Select
        allowClear
        placeholder="상태"
        style={{ width: 90 }}
        value={filters.status}
        options={(Object.keys(STATUS_LABEL) as Status[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
        onChange={(status) => set({ status })}
      />
      <DatePicker.RangePicker
        value={filters.from && filters.to ? [dayjs(filters.from), dayjs(filters.to)] : null}
        onChange={(r) => set({ from: r?.[0] ? toKstDate(r[0].toDate()) : undefined, to: r?.[1] ? toKstDate(r[1].toDate()) : undefined })}
      />
      <Popover trigger="click" placement="bottomRight" content={detail}>
        <Badge count={detailCount} size="small" offset={[-4, 4]}>
          <Button icon={<SlidersHorizontal size={14} strokeWidth={1.5} />}>상세 조건</Button>
        </Badge>
      </Popover>
      {anyFilter && (
        <Button type="text" onClick={() => onChange({ page: 1, size: filters.size })}>
          초기화
        </Button>
      )}
    </div>
  )
}
