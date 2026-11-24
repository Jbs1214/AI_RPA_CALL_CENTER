// 챗봇 담당 팀원의 폴더(src/features/chat/). 챗봇은 이 폴더만 수정한다.
// App.tsx 는 이 컴포넌트를 한 줄로만 부른다. 조회 전용이며, 수정은 사용자가 제안 버튼을 눌렀을 때만 한다.
import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Drawer, FloatButton, Input, Space, Tag, Typography } from 'antd'
import { MessageOutlined, SendOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { askChat, runSuggestedAction } from '../../api/chat'
import type { ChatResponse, ChatTurn, SuggestedAction } from '../../types/Chat'
import ChatResult from './ChatResult'

interface Message {
  id: number
  role: 'user' | 'assistant'
  text: string
  response?: ChatResponse
  error?: boolean
}

const EXAMPLES = [
  '불만 중 후속조치 필요한 통화 보여줘',
  '이번 주 불만 몇 건이야?',
  '담당자별 통화 건수 알려줘',
  '검토 필요한 건 확인 완료 처리해줘',
]

const HISTORY_LIMIT = 6

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [done, setDone] = useState<Set<string>>(new Set()) // 이미 누른 제안 버튼(path+body)
  const [actionError, setActionError] = useState<string | null>(null)
  const nextId = useRef(1)
  const bottom = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [messages, open])

  const add = (m: Omit<Message, 'id'>) => setMessages((prev) => [...prev, { ...m, id: nextId.current++ }])

  const ask = useMutation({
    mutationFn: askChat,
    onSuccess: (res) => add({ role: 'assistant', text: res.reply, response: res }),
    onError: (e: Error) => add({ role: 'assistant', text: e.message, error: true }),
  })

  const act = useMutation({
    mutationFn: runSuggestedAction,
    onSuccess: (_d, action) => {
      setDone((prev) => new Set(prev).add(actionKey(action)))
      setActionError(null)
      add({ role: 'assistant', text: `처리했습니다: ${action.label}` })
      void qc.invalidateQueries({ queryKey: ['calls'] })
      void qc.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: (e: Error) => setActionError(e.message),
  })

  const send = (raw: string) => {
    const message = raw.trim()
    if (!message || ask.isPending) return
    const history: ChatTurn[] = messages
      .filter((m) => !m.error)
      .slice(-HISTORY_LIMIT)
      .map((m) => ({ role: m.role, content: m.text }))
    add({ role: 'user', text: message })
    setText('')
    setActionError(null)
    ask.mutate({ message, history })
  }

  return (
    <>
      <FloatButton
        type="primary"
        icon={<MessageOutlined />}
        tooltip="챗봇에게 물어보기"
        style={{ right: 24, bottom: 24 }}
        onClick={() => setOpen(true)}
      />
      <Drawer
        title="챗봇"
        placement="right"
        width={440}
        open={open}
        onClose={() => setOpen(false)}
        extra={
          <Button size="small" onClick={() => setMessages([])} disabled={messages.length === 0}>
            대화 지우기
          </Button>
        }
        styles={{ body: { display: 'flex', flexDirection: 'column', padding: 12, gap: 8 } }}
      >
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.length === 0 && (
            <div>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                통화 기록을 조회하고 통계를 물어볼 수 있습니다. 예시를 눌러 보세요.
              </Typography.Paragraph>
              <Space direction="vertical" size={6}>
                {EXAMPLES.map((ex) => (
                  <Tag
                    key={ex}
                    color="blue"
                    style={{ cursor: 'pointer', whiteSpace: 'normal', margin: 0 }}
                    onClick={() => send(ex)}
                  >
                    {ex}
                  </Tag>
                ))}
              </Space>
            </div>
          )}
          {messages.map((m) => (
            <Bubble key={m.id} message={m}>
              {m.response && (
                <ChatResult
                  response={m.response}
                  done={done}
                  actionKey={actionKey}
                  acting={act.isPending}
                  onAction={(a) => act.mutate(a)}
                />
              )}
            </Bubble>
          ))}
          {ask.isPending && <Bubble message={{ id: 0, role: 'assistant', text: '조회 중…' }} />}
          {actionError && <Alert type="error" showIcon message={actionError} closable onClose={() => setActionError(null)} />}
          <div ref={bottom} />
        </div>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            value={text}
            placeholder="예: 새봄물산 불만 몇 건이야?"
            maxLength={200}
            onChange={(e) => setText(e.target.value)}
            onPressEnter={(e) => {
              if (!e.nativeEvent.isComposing) send(text) // 한글 조합 중 Enter 는 보내지 않는다
            }}
          />
          <Button type="primary" icon={<SendOutlined />} loading={ask.isPending} onClick={() => send(text)}>
            보내기
          </Button>
        </Space.Compact>
      </Drawer>
    </>
  )
}

function actionKey(a: SuggestedAction): string {
  return `${a.path}|${JSON.stringify(a.body)}`
}

function Bubble({ message, children }: { message: Message; children?: React.ReactNode }) {
  const mine = message.role === 'user'
  return (
    <div style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '92%' }}>
      <div
        style={{
          background: mine ? '#1677ff' : message.error ? '#fdecec' : '#f2f3f5',
          color: mine ? '#fff' : message.error ? '#a32d2d' : 'inherit',
          padding: '8px 12px',
          borderRadius: 12,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {message.text}
      </div>
      {children}
    </div>
  )
}
