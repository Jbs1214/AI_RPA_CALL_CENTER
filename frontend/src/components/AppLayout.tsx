import { Outlet } from 'react-router-dom'
import ChatWidget from '../features/chat/ChatWidget'
import AppHeader from './AppHeader'

/** 모든 페이지의 틀: 위쪽 메뉴 줄 + 본문(페이지가 바뀌는 자리) + 챗봇 */
export default function AppLayout() {
  return (
    <div className="shell">
      <AppHeader />
      <Outlet />
      <ChatWidget />
    </div>
  )
}
