// 챗봇 담당 팀원의 폴더(src/features/chat/). 챗봇은 이 폴더만 수정한다.
// App.tsx 는 이 컴포넌트를 한 줄로만 부른다. 조회 전용이며, 수정은 사용자가 제안 버튼을 눌렀을 때만 한다.
//
// 파일 나눔
//   ChatWidget.tsx        조립(열고 닫기, 입력값, 스크롤)
//   useChat.ts            대화 상태와 서버 호출
//   useFloatingPanel.ts   창 옮기기·크기 조절
//   ChatParts.tsx         머리말, 말풍선, 입력창 같은 작은 조각
//   ChatResult.tsx        답변 아래의 조건·통화 카드·통계·제안 버튼
//   constants.ts          문구와 수치
//   chat.css              모양
import { useEffect, useRef, useState } from 'react'
import { MessageFilled } from '@ant-design/icons'
import { ChatHeader, Composer, MessageRow, QuickReplies, TypingRow, WelcomeRow } from './ChatParts'
import ChatResult from './ChatResult'
import { actionKey, useChat } from './useChat'
import { useFloatingPanel } from './useFloatingPanel'
import './chat.css'

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const chat = useChat()
  const { panelRef, ...panel } = useFloatingPanel()
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const submit = (raw: string) => {
    if (chat.send(raw)) setText('')
  }

  // 새 메시지가 오면 맨 아래로
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [chat.messages, chat.isAsking, open])

  // 열리면 입력창에 커서를 두고, Esc 로 닫는다
  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const hasMessages = chat.messages.length > 0

  return (
    <div className="cb-root">
      <button className={`cb-launcher${open ? ' hidden' : ''}`} aria-label="챗봇 열기" onClick={() => setOpen(true)}>
        <MessageFilled />
      </button>

      {open && (
        <section
          ref={panelRef}
          className={`cb-panel${panel.isMoving ? ' dragging' : ''}`}
          role="dialog"
          aria-label="챗봇"
          style={panel.panelStyle}
        >
          <div className="cb-resize" title="끌어서 크기 조절" {...panel.resizeHandlers} />

          <ChatHeader
            canClear={hasMessages}
            isBig={panel.isBig}
            onClear={chat.clear}
            onToggleBig={panel.toggleBig}
            onClose={() => setOpen(false)}
            dragHandlers={panel.headerHandlers}
          />

          <div className="cb-body">
            <div className="cb-date">오늘</div>
            <WelcomeRow showChips={!hasMessages} onPick={submit} />
            {chat.messages.map((m) => (
              <MessageRow key={m.id} message={m}>
                {m.response && (
                  <ChatResult
                    response={m.response}
                    done={chat.doneActions}
                    actionKey={actionKey}
                    acting={chat.isActing}
                    onAction={chat.runAction}
                  />
                )}
              </MessageRow>
            ))}
            {chat.isAsking && <TypingRow />}
            <div ref={bottomRef} />
          </div>

          {hasMessages && <QuickReplies disabled={chat.isAsking} onPick={submit} />}

          <Composer value={text} busy={chat.isAsking} inputRef={inputRef} onChange={setText} onSubmit={() => submit(text)} />
        </section>
      )}
    </div>
  )
}
