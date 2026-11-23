import { Card, Col, Row, Statistic, Tag, Alert, Spin } from 'antd'
import { computeKpi } from '../../lib/kpi'
import { useStats, type DateRange } from './useStats'

export default function KpiCards({ range }: { range: DateRange }) {
  const { data, error, isLoading } = useStats(range)

  if (isLoading) return <Spin />
  if (error || !data) return <Alert type="error" showIcon message={error?.message ?? '통계를 불러오지 못했습니다'} />

  const k = computeKpi(data)
  const items: { title: string; value: string | number }[] = [
    { title: '분석된 통화', value: k.analyzed },
    { title: '후속조치 필요', value: k.followUp },
    { title: 'AI 결과 검토 필요', value: k.needsReview },
    { title: '불만 통화', value: k.complaint },
    { title: '불만 비율', value: `${k.complaintRatio}%` },
    { title: '가장 많은 유형', value: k.topCategory },
  ]

  return (
    <>
      <Row gutter={[12, 12]}>
        {items.map((it) => (
          <Col key={it.title} xs={12} md={8} xl={4}>
            <Card size="small">
              <Statistic title={it.title} value={it.value} />
            </Card>
          </Col>
        ))}
      </Row>
      <div style={{ marginTop: 8 }}>
        {data.in_progress > 0 && <Tag color="processing">처리 중 {data.in_progress}건</Tag>}
        {data.failed > 0 && <Tag color="error">실패 {data.failed}건</Tag>}
      </div>
    </>
  )
}
