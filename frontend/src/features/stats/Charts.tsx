import { Card, Col, Row, Empty } from 'antd'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CATEGORIES } from '../../types/Call'
import { CATEGORY_COLOR } from '../../lib/categoryColor'
import { useStats, type DateRange } from './useStats'

const H = 220

function Box({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <Card size="small" title={title}>
      {empty ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="데이터 없음" style={{ height: H }} /> : <div style={{ height: H }}>{children}</div>}
    </Card>
  )
}

/** 차트 4개: 유형별 건수 · 일자별 유형 추이 · 담당자별 통화·후속조치 · 고객사별 불만 건수 */
export default function Charts({ range }: { range: DateRange }) {
  const { data } = useStats(range)
  if (!data) return null

  const byCategory = data.by_category
  const byDay = data.by_day.map((d) => ({ date: d.date.slice(5), ...d.by_category }))
  const byCompany = [...data.by_company].sort((a, b) => b.complaint_count - a.complaint_count).slice(0, 10)

  return (
    <Row gutter={[12, 12]}>
      <Col xs={24} md={12} xl={6}>
        <Box title="유형별 건수" empty={data.analyzed === 0}>
          <ResponsiveContainer>
            <BarChart data={byCategory}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="category" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip />
              <Bar dataKey="count" name="건수">
                {byCategory.map((c) => (
                  <Cell key={c.category} fill={CATEGORY_COLOR[c.category]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Col>
      <Col xs={24} md={12} xl={6}>
        <Box title="일자별 유형 추이" empty={byDay.length === 0}>
          <ResponsiveContainer>
            <BarChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {CATEGORIES.map((c) => (
                <Bar key={c} dataKey={c} stackId="day" fill={CATEGORY_COLOR[c]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Col>
      <Col xs={24} md={12} xl={6}>
        <Box title="담당자별 통화·후속조치" empty={data.by_agent.length === 0}>
          <ResponsiveContainer>
            <BarChart data={data.by_agent}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="agent_name" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="count" name="통화 건수" fill="#4f8fd9" />
              <Bar dataKey="follow_up_count" name="후속조치" fill="#e9a23b" />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Col>
      <Col xs={24} md={12} xl={6}>
        <Box title="고객사별 불만 건수 (상위 10)" empty={byCompany.length === 0}>
          <ResponsiveContainer>
            <BarChart data={byCompany} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} fontSize={11} />
              <YAxis type="category" dataKey="customer_company" width={80} fontSize={11} />
              <Tooltip formatter={(v, n) => [v, n === 'complaint_count' ? '불만 건수' : n]} />
              <Bar dataKey="complaint_count" name="불만 건수" fill={CATEGORY_COLOR['불만']} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Col>
    </Row>
  )
}
