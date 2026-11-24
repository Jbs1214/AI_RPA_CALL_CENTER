import { Drawer } from 'antd'
import CallDetailBody from './CallDetailBody'

interface Props {
  callId: string | null
  onClose: () => void
}

/** 통화 상세를 옆 패널로 연다. 챗봇이 통화 카드를 눌렀을 때 쓴다. 내용은 CallDetailBody 와 같다. */
export default function CallDrawer({ callId, onClose }: Props) {
  return (
    <Drawer open={callId !== null} onClose={onClose} width="min(480px, 100vw)" title={callId ?? ''} destroyOnClose>
      {callId !== null && <CallDetailBody callId={callId} onDeleted={onClose} />}
    </Drawer>
  )
}
