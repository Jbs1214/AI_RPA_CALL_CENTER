import { useState } from 'react'
import AppHeader from './components/AppHeader'
import AppSidebar from './components/AppSidebar'
import Section from './components/Section'
import KpiCards from './features/stats/KpiCards'
import Charts from './features/stats/Charts'
import CallFilters from './features/calls/CallFilters'
import CallTable from './features/calls/CallTable'
import CallDrawer from './features/calls/CallDrawer'
import UploadDropzone from './features/upload/UploadDropzone'
import ChatWidget from './features/chat/ChatWidget'
import type { CallFilters as Filters } from './types/Call'

export default function App() {
  const [filters, setFilters] = useState<Filters>({ page: 1, size: 10 }) // 처음 보이는 목록은 10건씩
  const [selected, setSelected] = useState<string | null>(null)
  const range = { from: filters.from, to: filters.to } // 필터의 기간은 통계에도 같이 보낸다

  return (
    <div className="shell">
      <AppSidebar />
      <div className="shell__main">
        <AppHeader />
        <main className="workspace">
          {/* 왼쪽(넓게): 요약 지표와 통화 목록 */}
          <div className="workspace__main">
            <KpiCards range={range} />
            <Section id="calls" title="통화 목록">
              <CallFilters filters={filters} onChange={setFilters} />
              <CallTable filters={filters} onChange={setFilters} onOpen={setSelected} />
            </Section>
          </div>
          {/* 오른쪽(좁게): 업로드와 차트 */}
          <div className="workspace__side">
            <Section id="upload" title="음성 업로드">
              <UploadDropzone />
            </Section>
            <div id="charts" className="panel-group">
              <Charts range={range} />
            </div>
          </div>
        </main>
      </div>
      <CallDrawer callId={selected} onClose={() => setSelected(null)} />
      <ChatWidget />
    </div>
  )
}
