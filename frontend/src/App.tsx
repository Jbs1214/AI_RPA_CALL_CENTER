import { useState } from 'react'
import { CustomerServiceOutlined } from '@ant-design/icons'
import PageContainer from './components/PageContainer'
import Section from './components/Section'
import ThemeToggle from './components/ThemeToggle'
import KpiCards from './features/stats/KpiCards'
import Charts from './features/stats/Charts'
import CallFilters from './features/calls/CallFilters'
import CallTable from './features/calls/CallTable'
import CallDrawer from './features/calls/CallDrawer'
import UploadDropzone from './features/upload/UploadDropzone'
import ChatWidget from './features/chat/ChatWidget'
import type { CallFilters as Filters } from './types/Call'

export default function App() {
  const [filters, setFilters] = useState<Filters>({ page: 1, size: 20 })
  const [selected, setSelected] = useState<string | null>(null)
  const range = { from: filters.from, to: filters.to } // 필터의 기간은 통계에도 같이 보낸다

  return (
    <div className="app">
      <header className="app__header">
        <PageContainer>
          <div className="app__brand">
            <span className="app__logo">
              <CustomerServiceOutlined />
            </span>
            <h1 className="app__title">콜센터 AI·RPA 비서</h1>
            <span className="app__subtitle">통화 녹취 분석 대시보드</span>
            <div className="app__tools">
              <ThemeToggle />
            </div>
          </div>
        </PageContainer>
      </header>
      <PageContainer>
        <main className="page__body">
          <Section title="음성 업로드">
            <UploadDropzone />
          </Section>
          <KpiCards range={range} />
          <Charts range={range} />
          <Section title="통화 목록">
            <CallFilters filters={filters} onChange={setFilters} />
            <CallTable filters={filters} onChange={setFilters} onOpen={setSelected} />
          </Section>
        </main>
      </PageContainer>
      <CallDrawer callId={selected} onClose={() => setSelected(null)} />
      <ChatWidget />
    </div>
  )
}
