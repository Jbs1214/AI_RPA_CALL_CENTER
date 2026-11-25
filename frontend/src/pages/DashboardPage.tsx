import { useState } from 'react'
import { Button } from 'antd'
import { Download } from 'lucide-react'
import { exportUrl } from '../api/calls'
import Section from '../components/Section'
import CallDrawer from '../features/calls/CallDrawer'
import CallFilters from '../features/calls/CallFilters'
import CallTable from '../features/calls/CallTable'
import KpiCards from '../features/stats/KpiCards'
import UploadDropzone from '../features/upload/UploadDropzone'
import type { CallFilters as Filters } from '../types/Call'

/**
 * 메인: 지표 6칸 → 가운데 업로드 상자 → 통화 목록.
 * 통화 한 건을 누르면 옆 패널(드로어)로 상세를 보고, 통계는 위쪽 메뉴의 통계 페이지로 간다.
 */
export default function DashboardPage() {
  const [filters, setFilters] = useState<Filters>({ page: 1, size: 10 }) // 처음 보이는 목록은 10건씩
  const [selected, setSelected] = useState<string | null>(null)
  const range = { from: filters.from, to: filters.to } // 목록의 기간은 지표에도 같이 보낸다

  return (
    <main className="page">
      <KpiCards range={range} />
      <UploadDropzone />
      <Section
        title="통화 목록"
        extra={
          // 목록과 같은 조건으로 엑셀 한 파일을 받는다(API 7, 완료된 통화만 12열)
          <Button size="small" shape="round" icon={<Download size={14} strokeWidth={1.5} />} href={exportUrl(filters)} target="_blank">
            엑셀로 내보내기
          </Button>
        }
      >
        <CallFilters filters={filters} onChange={setFilters} />
        <CallTable filters={filters} onChange={setFilters} onOpen={setSelected} />
      </Section>
      <CallDrawer callId={selected} onClose={() => setSelected(null)} />
    </main>
  )
}
