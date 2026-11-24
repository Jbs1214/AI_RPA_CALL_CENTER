import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ChartCard from '../../components/ChartCard'
import { CATEGORIES } from '../../types/Call'
import { CATEGORY_COLOR } from '../../lib/categoryColor'
import CategoryDonut from './CategoryDonut'
import { ChartTooltip } from './chartParts'
import { useStats, type DateRange } from './useStats'

const FONT = 11 // 차트가 작아서 글자도 조금 작게
const TOP_RADIUS: [number, number, number, number] = [3, 3, 0, 0] // 막대 위쪽 모서리는 작게만 둥글린다
const AGENT_COLORS = ['#60a5fa', '#fbbf24'] // 통화 건수, 후속조치
/** 막대 위로 올렸을 때 보이는 배경 강조(둥근 모서리) */
const TOOLTIP_CURSOR = { fill: 'rgba(255, 255, 255, 0.04)', radius: 4 }
const GRID = { vertical: false } as const

/** 0은 숫자를 적지 않는다 */
const showValue = (v: unknown) => (Number(v) > 0 ? String(v) : '')

/** 유형 범례: 쌓인 순서(아래→위)와 같은 순서로 보여 준다 */
function CategoryLegend() {
  return (
    <div className="chart-card__legend">
      {CATEGORIES.map((c) => (
        <span key={c}>
          <span className="chart-card__legend-dot" style={{ background: CATEGORY_COLOR[c] }} />
          {c}
        </span>
      ))}
    </div>
  )
}

/** 일자별 차트의 말풍선: 유형별 건수 + 합계 */
function DayTooltip({ active, label, payload }: { active?: boolean; label?: unknown; payload?: readonly { payload?: Record<string, number | string> }[] }) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__title">{String(label)}</div>
      {CATEGORIES.map((c) => (
        <div key={c} className="chart-tooltip__row">
          <span className="chart-tooltip__dot" style={{ background: CATEGORY_COLOR[c] }} />
          <span className="chart-tooltip__name">{c}</span>
          <b className="chart-tooltip__value">{row[c]}건</b>
        </div>
      ))}
      <div className="chart-tooltip__total">합계 {row.total}건</div>
    </div>
  )
}

/** 차트 4개: 유형별 건수 · 일자별 유형 추이 · 담당자별 통화·후속조치 · 고객사별 불만 건수 */
export default function Charts({ range }: { range: DateRange }) {
  const { data } = useStats(range)
  if (!data) return null

  const byCategory = data.by_category
  const byDay = data.by_day.map((d) => ({
    date: d.date.slice(5),
    ...d.by_category,
    total: CATEGORIES.reduce((sum, c) => sum + (d.by_category[c] ?? 0), 0),
  }))
  // 서버가 엑셀과 같은 순서(불만 건수 내림차순, 동률 규칙 포함)로 준다. 다시 정렬하지 않고 상위 10곳만 쓴다.
  const byCompany = data.by_company.slice(0, 10)
  const room = (max: number) => Math.ceil(max * 1.25) || 1 // 막대 위 숫자가 잘리지 않게 위쪽 여유

  return (
    <div className="chart-grid">
      {/* 1) 유형별 건수: 전체 중 몫이라 도넛으로 */}
      <ChartCard title="유형별 건수" hint="분석된 통화 기준" empty={data.analyzed === 0}>
        <CategoryDonut data={byCategory} total={data.analyzed} />
      </ChartCard>

      {/* 2) 일자별 유형 추이: 쌓은 막대, 조각 사이에 얇은 틈 */}
      <ChartCard title="일자별 유형 추이" hint="색 = 유형, 위 숫자 = 합계" empty={byDay.length === 0} footer={<CategoryLegend />}>
        <ResponsiveContainer>
          <ComposedChart data={byDay} margin={{ top: 18, right: 4, left: 4 }} barCategoryGap="28%">
            <CartesianGrid {...GRID} />
            <XAxis dataKey="date" fontSize={FONT} tickLine={false} />
            <YAxis hide domain={[0, room]} />
            <Tooltip cursor={TOOLTIP_CURSOR} content={DayTooltip} />
            {CATEGORIES.map((c, i) => (
              <Bar
                key={c}
                dataKey={c}
                stackId="day"
                fill={CATEGORY_COLOR[c]}
                stroke="var(--glass-bg)"
                strokeWidth={1.5}
                radius={i === CATEGORIES.length - 1 ? TOP_RADIUS : 0}
                maxBarSize={34}
              >
                <LabelList dataKey={c} position="center" fill="#09090b" fontSize={10} formatter={showValue} />
              </Bar>
            ))}
            {/* 합계를 막대 위에 적기 위한 보이지 않는 선 */}
            <Line dataKey="total" stroke="none" dot={false} activeDot={false} legendType="none" isAnimationActive={false}>
              <LabelList dataKey="total" position="top" fontSize={FONT} fontWeight={600} formatter={showValue} />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 3) 담당자별: 통화 건수와 후속조치를 나란히 */}
      <ChartCard title="담당자별 통화·후속조치" hint="파랑 통화 · 노랑 후속조치" empty={data.by_agent.length === 0}>
        <ResponsiveContainer>
          <BarChart data={data.by_agent} margin={{ top: 18, right: 4, left: 4 }} barGap={3} barCategoryGap="24%">
            <CartesianGrid {...GRID} />
            <XAxis dataKey="agent_name" fontSize={FONT} tickLine={false} />
            <YAxis hide domain={[0, room]} />
            <Tooltip cursor={TOOLTIP_CURSOR} content={<ChartTooltip />} />
            <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: FONT }} />
            <Bar dataKey="count" name="통화 건수" fill={AGENT_COLORS[0]} radius={TOP_RADIUS} maxBarSize={22}>
              <LabelList dataKey="count" position="top" fontSize={FONT} fontWeight={600} formatter={showValue} />
            </Bar>
            <Bar dataKey="follow_up_count" name="후속조치" fill={AGENT_COLORS[1]} radius={TOP_RADIUS} maxBarSize={22}>
              <LabelList dataKey="follow_up_count" position="top" fontSize={FONT} fontWeight={600} formatter={showValue} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 4) 고객사별: 가로 막대, 뒤에 옅은 바탕 띠를 깔아 0건도 줄이 보이게 */}
      <ChartCard title="고객사별 불만 건수" hint="상위 10곳" empty={byCompany.length === 0}>
        <ResponsiveContainer>
          <BarChart data={byCompany} layout="vertical" margin={{ left: 0, right: 28 }} barCategoryGap="30%">
            <XAxis type="number" hide domain={[0, room]} />
            <YAxis type="category" dataKey="customer_company" width={84} fontSize={FONT} interval={0} tickLine={false} axisLine={false} />
            <Tooltip cursor={TOOLTIP_CURSOR} content={<ChartTooltip />} />
            <Bar
              dataKey="complaint_count"
              name="불만 건수"
              fill={CATEGORY_COLOR['불만']}
              radius={[0, 3, 3, 0]}
              maxBarSize={14}
              background={{ fill: 'rgba(255, 255, 255, 0.05)', radius: 3 }}
            >
              <LabelList dataKey="complaint_count" position="right" fontSize={FONT} fontWeight={600} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
