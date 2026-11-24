import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import { ThemeProvider } from './theme/ThemeProvider'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

async function start() {
  // 서버 없이 화면을 만들 때: .env 에 VITE_USE_MOCK=true
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    try {
      const { worker } = await import('./mocks/browser')
      await worker.start()
    } catch (e) {
      console.error('MSW 시작 실패 — 가짜 API 없이 화면만 띄웁니다', e)
    }
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}

void start()
