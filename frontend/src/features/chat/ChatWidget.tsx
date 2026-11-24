// 챗봇 담당 팀원의 폴더(src/features/chat/). 챗봇은 이 폴더만 수정한다.
// App.tsx 는 이 컴포넌트를 한 줄로만 부른다. 조회 전용이며, 수정은 사용자가 제안 버튼을 눌렀을 때만 한다.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { CloseOutlined, MessageFilled, ReloadOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { askChat, runSuggestedAction } from '../../api/chat'
import { formatKst } from '../../lib/date'
import type { ChatResponse, ChatTurn, SuggestedAction } from '../../types/Chat'
import ChatResult from './ChatResult'
import './chat.css'

interface Message {
  id: number
  role: 'user' | 'assistant'
  text: string
  at: string
  response?: ChatResponse
  error?: boolean
}

const EXAMPLES = [
  '불만 중 후속조치 필요한 통화 보여줘',
  '이번 주 불만 몇 건이야?',
  '담당자별 통화 건수 알려줘',
  '검토 필요한 건 확인 완료 처리해줘',
]

const WELCOME = '안녕하세요! 콜센터 AI 비서입니다.\n통화 기록을 조회하고 통계를 알려 드려요. 아래 질문을 눌러 보거나 직접 물어보세요.'

const HISTORY_LIMIT = 6
const MIN_W = 340
const MIN_H = 420
const BIG_W = 640

const now = () => formatKst(new Date().toISOString(), 'HH:mm')

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [done, setDone] = useState<Set<string>>(new Set()) // 이미 누른 제안 버튼(path+body)
  const nextId = useRef(1)
  const bottom = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 }) // 기본 위치(오른쪽 아래)에서 옮긴 거리
  const [dragging, setDragging] = useState(false)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null) // null 이면 기본 크기
  const resize = useRef<{ sx: number; sy: number; w: number; h: number; right: number; bottom: number } | null>(null)
  const drag = useRef<{ sx: number; sy: number; left: number; top: number; x: number; y: number } | null>(null)
  const qc = useQueryClient()

  const add = (m: Omit<Message, 'id' | 'at'>) =>
    setMessages((prev) => [...prev, { ...m, id: nextId.current++, at: now() }])

  const ask = useMutation({
    mutationFn: askChat,
    onSuccess: (res) => add({ role: 'assistant', text: res.reply, response: res }),
    onError: (e: Error) => add({ role: 'assistant', text: e.message, error: true }),
  })

  const act = useMutation({
    mutationFn: runSuggestedAction,
    onSuccess: (_d, action) => {
      setDone((prev) => new Set(prev).add(actionKey(action)))
      add({ role: 'assistant', text: `처리했습니다. ${action.label}` })
      void qc.invalidateQueries({ queryKey: ['calls'] })
      void qc.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: (e: Error) => add({ role: 'assistant', text: e.message, error: true }),
  })

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [messages, ask.isPending, open])

  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // 머리말을 잡고 끌면 창이 움직인다. 화면 밖으로는 나가지 않는다.
  const onDragStart = (e: ReactPointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('button') || !panel.current) return
    const r = panel.current.getBoundingClientRect()
    drag.current = { sx: e.clientX, sy: e.clientY, left: r.left, top: r.top, x: pos.x, y: pos.y }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }
  const onDragMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d || !panel.current) return
    const { width, height } = panel.current.getBoundingClientRect()
    const left = Math.min(Math.max(d.left + e.clientX - d.sx, 0), window.innerWidth - width)
    const top = Math.min(Math.max(d.top + e.clientY - d.sy, 0), window.innerHeight - height)
    setPos({ x: d.x + left - d.left, y: d.y + top - d.top })
  }
  const onDragEnd = () => {
    drag.current = null
    setDragging(false)
  }

  // 왼쪽 위 모서리를 잡고 끌면 크기가 바뀐다. 오른쪽 아래가 고정이라 왼쪽 위로 커진다.
  const onResizeStart = (e: ReactPointerEvent<HTMLElement>) => {
    if (!panel.current) return
    const r = panel.current.getBoundingClientRect()
    resize.current = { sx: e.clientX, sy: e.clientY, w: r.width, h: r.height, right: r.right, bottom: r.bottom }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.stopPropagation()
    setDragging(true)
  }
  const onResizeMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = resize.current
    if (!d) return
    const w = Math.min(Math.max(d.w - (e.clientX - d.sx), MIN_W), d.right)
    const h = Math.min(Math.max(d.h - (e.clientY - d.sy), MIN_H), d.bottom)
    setSize({ w, h })
  }
  const onResizeEnd = () => {
    resize.current = null
    setDragging(false)
  }
  const toggleBig = () => {
    setPos({ x: 0, y: 0 })
    setSize(size ? null : { w: Math.min(BIG_W, window.innerWidth - 48), h: window.innerHeight - 48 })
  }

  // 창 크기가 줄어 화면 밖으로 나가면 기본 위치로 되돌린다
  useEffect(() => {
    const onResize = () => {
      const r = panel.current?.getBoundingClientRect()
      if (r && (r.left < 0 || r.top < 0 || r.right > window.innerWidth || r.bottom > window.innerHeight)) {
        setPos({ x: 0, y: 0 })
        setSize(null)
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const send = (raw: string) => {
    const message = raw.trim()
    if (!message || ask.isPending) return
    const history: ChatTurn[] = messages
      .filter((m) => !m.error)
      .slice(-HISTORY_LIMIT)
      .map((m) => ({ role: m.role, content: m.text }))
    add({ role: 'user', text: message })
    setText('')
    ask.mutate({ message, history })
  }

  const busy = ask.isPending

  return (
    <div className="cb-root">
      <button className={`cb-launcher${open ? ' hidden' : ''}`} aria-label="챗봇 열기" onClick={() => setOpen(true)}>
        <MessageFilled />
      </button>

      {open && (
        <section
          ref={panel}
          className={`cb-panel${dragging ? ' dragging' : ''}`}
          role="dialog"
          aria-label="챗봇"
          style={{ translate: `${pos.x}px ${pos.y}px`, ...(size && { width: size.w, height: size.h }) }}
        >
          <div
            className="cb-resize"
            title="끌어서 크기 조절"
            onPointerDown={onResizeStart}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeEnd}
            onPointerCancel={onResizeEnd}
          />
          <header
            className="cb-header"
            title="끌어서 옮기기 (더블클릭하면 제자리로)"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            onDoubleClick={(e) => !(e.target as HTMLElement).closest('button') && setPos({ x: 0, y: 0 })}
          >
            <div className="cb-avatar">
              <RobotOutlined />
            </div>
            <div className="cb-title">
              <b>콜센터 AI 비서</b>
              <span>통화 기록 조회 · 통계</span>
            </div>
            <button className="cb-icon-btn" title="대화 지우기" disabled={messages.length === 0} onClick={() => setMessages([])}>
              <ReloadOutlined />
            </button>
            <button className="cb-icon-btn cb-size-btn" title={size ? '기본 크기로' : '크게 보기'} onClick={toggleBig}>
              <SizeIcon big={!!size} />
            </button>
            <button className="cb-icon-btn" title="닫기" onClick={() => setOpen(false)}>
              <CloseOutlined />
            </button>
          </header>

          <div className="cb-body">
            <div className="cb-date">오늘</div>
            <div className="cb-row">
              <div className="cb-avatar small">
                <RobotOutlined />
              </div>
              <div className="cb-col">
                <div className="cb-bubble">{WELCOME}</div>
                {messages.length === 0 && (
                  <div className="cb-chips">
                    {EXAMPLES.map((ex) => (
                      <button key={ex} className="cb-chip" onClick={() => send(ex)}>
                        {ex}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {messages.map((m) => (
              <div key={m.id} className={`cb-row${m.role === 'user' ? ' me' : ''}`}>
                {m.role === 'assistant' && (
                  <div className="cb-avatar small">
                    <RobotOutlined />
                  </div>
                )}
                <div className="cb-col">
                  <div className={`cb-bubble${m.error ? ' error' : ''}`}>{m.text}</div>
                  {m.response && (
                    <ChatResult
                      response={m.response}
                      done={done}
                      actionKey={actionKey}
                      acting={act.isPending}
                      onAction={(a) => act.mutate(a)}
                    />
                  )}
                  <span className="cb-time">{m.at}</span>
                </div>
              </div>
            ))}

            {busy && (
              <div className="cb-row">
                <div className="cb-avatar small">
                  <RobotOutlined />
                </div>
                <div className="cb-bubble cb-typing" aria-label="답변 작성 중">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            )}
            <div ref={bottom} />
          </div>

          {messages.length > 0 && (
            <div className="cb-quick">
              {EXAMPLES.map((ex) => (
                <button key={ex} className="cb-chip" disabled={busy} onClick={() => send(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          )}

          <footer className="cb-footer">
            <div className="cb-inputbar">
              <input
                ref={input}
                className="cb-input"
                value={text}
                placeholder="궁금한 내용을 입력하세요"
                maxLength={200}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) send(text) // 한글 조합 중 Enter 는 보내지 않는다
                }}
              />
              <button className="cb-send" aria-label="보내기" disabled={!text.trim() || busy} onClick={() => send(text)}>
                <SendOutlined />
              </button>
            </div>
            <div className="cb-notice">조회 전용입니다. 수정은 제안 버튼을 눌렀을 때만 반영돼요.</div>
          </footer>
        </section>
      )}
    </div>
  )
}

/** 창 컨트롤처럼 네모(크게) / 겹친 네모(원래대로) */
function SizeIcon({ big }: { big: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      {big ? (
        <>
          <rect x="1.8" y="4.2" width="8" height="8" rx="1.5" />
          <path d="M4.2 4.2V3.3a1.5 1.5 0 0 1 1.5-1.5h5a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5h-.9" />
        </>
      ) : (
        <rect x="1.8" y="1.8" width="10.4" height="10.4" rx="2" />
      )}
    </svg>
  )
}

function actionKey(a: SuggestedAction): string {
  return `${a.path}|${JSON.stringify(a.body)}`
}
