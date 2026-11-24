import { Card, Col, Row, Empty } from 'antd'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CATEGORIES } from '../../types/Call'
import { CATEGORY_COLOR } from '../../lib/categoryColor'
import { useStats, type DateRange } from './useStats'

const H = 300
const FONT = 12

/** 0은 숫자를 적지 않는다 */
const showValue = (v: unknown) => (Number(v) > 0 ? String(v) : '')

function Box({ title, hint, empty, children }: { title: string; hint?: string; empty: boolean; children: React.ReactNode }) {
  return (
    <Card size="small" title={title} extra={hint ? <span style={{ color: '#888', fontSize: 12 }}>{hint}</span> : null}>
      {empty ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="데이터 없음" style={{ height: H }} /> : <div style={{ height: H }}>{children}</div>}
    </Card>
  )
}

/** 유형 범례: 쌓인 순서(아래→위)와 같은 순서로 보여 준다 */
function CategoryLegend() {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', fontSize: FONT, marginTop: 4 }}>
      {CATEGORIES.map((c) => (
        <span key={c}>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: CATEGORY_COLOR[c], marginRight: 4 }} />
          {c}
        </span>
      ))}
    </div>
  )
}

interface DayTooltipProps {
  active?: boolean
  label?: unknown
  payload?: readonly { payload?: Record<string, number | string> }[]
}

/** 날짜 위에 올리면 유형별 건수와 합계를 보여 준다 */
function DayTooltip({ active, label, payload }: DayTooltipProps) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #ddd', padding: '8px 10px', fontSize: FONT }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{String(label)}</div>
      {CATEGORIES.map((c) => (
        <div key={c} style={{ color: CATEGORY_COLOR[c] }}>
          {c}: {row[c]}건
        </div>
      ))}
      <div style={{ marginTop: 4, borderTop: '1px solid #eee', paddingTop: 4 }}>합계: {row.total}건</div>
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
  const room = (max: number) => max + 1 // 막대 위 숫자가 잘리지 않게 위쪽 여유

  return (
    <Row gutter={[12, 12]}>
      <Col xs={24} xl={12}>
        <Box title="유형별 건수" hint="분석된 통화를 유형별로" empty={data.analyzed === 0}>
          <ResponsiveContainer>
            <BarChart data={byCategory} margin={{ top: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="category" fontSize={FONT} />
              <YAxis allowDecimals={false} fontSize={FONT} domain={[0, room]} />
              <Tooltip />
              <Bar dataKey="count" name="건수">
                {byCategory.map((c) => (
                  <Cell key={c.category} fill={CATEGORY_COLOR[c.category]} />
                ))}
                <LabelList dataKey="count" position="top" fontSize={FONT} formatter={showValue} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Col>
      <Col xs={24} xl={12}>
        <Box title="일자별 유형 추이" hint="막대 하나 = 하루. 색 = 유형, 위의 숫자 = 그날 합계" empty={byDay.length === 0}>
          <div style={{ height: H - 24 }}>
            <ResponsiveContainer>
              <ComposedChart data={byDay} margin={{ top: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" fontSize={FONT} />
                <YAxis allowDecimals={false} fontSize={FONT} domain={[0, room]} />
                <Tooltip content={DayTooltip} />
                {CATEGORIES.map((c) => (
                  <Bar key={c} dataKey={c} stackId="day" fill={CATEGORY_COLOR[c]}>
                    <LabelList dataKey={c} position="center" fill="#fff" fontSize={FONT} formatter={showValue} />
                  </Bar>
                ))}
                {/* 합계를 막대 위에 적기 위한 보이지 않는 선 */}
                <Line dataKey="total" stroke="none" dot={false} activeDot={false} legendType="none" isAnimationActive={false}>
                  <LabelList dataKey="total" position="top" fontSize={FONT} fontWeight={600} formatter={showValue} />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <CategoryLegend />
        </Box>
      </Col>
      <Col xs={24} xl={12}>
        <Box title="담당자별 통화·후속조치" hint="파랑 = 통화 건수, 주황 = 후속조치 필요" empty={data.by_agent.length === 0}>
          <ResponsiveContainer>
            <BarChart data={data.by_agent} margin={{ top: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="agent_name" fontSize={FONT} />
              <YAxis allowDecimals={false} fontSize={FONT} domain={[0, room]} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: FONT }} />
              <Bar dataKey="count" name="통화 건수" fill="#4f8fd9">
                <LabelList dataKey="count" position="top" fontSize={FONT} formatter={showValue} />
              </Bar>
              <Bar dataKey="follow_up_count" name="후속조치" fill="#e9a23b">
                <LabelList dataKey="follow_up_count" position="top" fontSize={FONT} formatter={showValue} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Col>
      <Col xs={24} xl={12}>
        <Box title="고객사별 불만 건수" hint="불만이 많은 상위 10곳" empty={byCompany.length === 0}>
          <ResponsiveContainer>
            <BarChart data={byCompany} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} fontSize={FONT} domain={[0, room]} />
              <YAxis type="category" dataKey="customer_company" width={100} fontSize={FONT} />
              <Tooltip />
              <Bar dataKey="complaint_count" name="불만 건수" fill={CATEGORY_COLOR['불만']}>
                <LabelList dataKey="complaint_count" position="right" fontSize={FONT} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Col>
    </Row>
  )
}
