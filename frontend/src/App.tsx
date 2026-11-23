import { useState } from 'react'
import { Card, Layout, Typography } from 'antd'
import KpiCards from './features/stats/KpiCards'
import Charts from './features/stats/Charts'
import CallFilters from './features/calls/CallFilters'
import CallTable from './features/calls/CallTable'
import CallDrawer from './features/calls/CallDrawer'
import UploadDropzone from './features/upload/UploadDropzone'
import ChatWidget from './features/chat/ChatWidget'
import type { CallFilters as Filters } from './types/Call'

const { Header, Content } = Layout

export default function App() {
  const [filters, setFilters] = useState<Filters>({ page: 1, size: 20 })
  const [selected, setSelected] = useState<string | null>(null)
  const range = { from: filters.from, to: filters.to } // 필터의 기간은 통계에도 같이 보낸다

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', borderBottom: '1px solid #eee' }}>
        <Typography.Title level={4} style={{ margin: '14px 0' }}>
          콜센터 AI·RPA 비서
        </Typography.Title>
      </Header>
      <Content style={{ padding: 16, display: 'grid', gap: 16 }}>
        <Card size="small" title="음성 업로드">
          <UploadDropzone />
        </Card>
        <KpiCards range={range} />
        <Charts range={range} />
        <Card size="small" title="통화 목록">
          <CallFilters filters={filters} onChange={setFilters} />
          <CallTable filters={filters} onChange={setFilters} onOpen={setSelected} />
        </Card>
      </Content>
      <CallDrawer callId={selected} onClose={() => setSelected(null)} />
      <ChatWidget />
    </Layout>
  )
}
