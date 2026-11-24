import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { CATEGORY_COLOR } from '../../lib/categoryColor'
import type { Category } from '../../types/Call'
import { ChartTooltip } from './chartParts'

interface Props {
  /** 유형별 건수(서버의 by_category) */
  data: { category: Category; count: number }[]
  /** 가운데에 적는 분석된 통화 수 */
  total: number
}

/** 유형별 건수 도넛: 전체 중 몫을 한눈에 보여 주고, 오른쪽에 유형별 건수와 비율을 적는다. */
export default function CategoryDonut({ data, total }: Props) {
  const percent = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100))

  return (
    <div className="donut">
      <div className="donut__plot">
        <ResponsiveContainer>
          <PieChart>
            <Tooltip content={<ChartTooltip colorOf={(p) => CATEGORY_COLOR[p.name as Category]} />} />
            <Pie
              data={data}
              dataKey="count"
              nameKey="category"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              cornerRadius={2}
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {data.map((d) => (
                <Cell key={d.category} fill={CATEGORY_COLOR[d.category]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="donut__center">
          <b>{total}</b>
          <span>분석된 통화</span>
        </div>
      </div>
      <ul className="donut__legend">
        {data.map((d) => (
          <li key={d.category}>
            <span className="donut__dot" style={{ background: CATEGORY_COLOR[d.category] }} />
            <span className="donut__name">{d.category}</span>
            <b>{d.count}</b>
            <span className="donut__pct">{percent(d.count)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
