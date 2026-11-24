// ChatWidget 을 이루는 작은 화면 조각들. 상태는 갖지 않고 받은 값만 그린다.
import type { ReactNode } from 'react'
import { Bot, Maximize2, Minimize2, RotateCcw, Send, X } from 'lucide-react'
import { EXAMPLES, WELCOME } from './constants'
import type { Message } from './useChat'

export function BotAvatar({ small = false }: { small?: boolean }) {
  return (
    <div className={`cb-avatar${small ? ' small' : ''}`}>
      <Bot size={small ? 16 : 18} strokeWidth={1.5} />
    </div>
  )
}

interface HeaderProps {
  canClear: boolean
  isBig: boolean
  onClear: () => void
  onToggleBig: () => void
  onClose: () => void
  /** 드래그로 옮기기용 핸들러 */
  dragHandlers: React.HTMLAttributes<HTMLElement>
}

export function ChatHeader({ canClear, isBig, onClear, onToggleBig, onClose, dragHandlers }: HeaderProps) {
  return (
    <header className="cb-header" title="끌어서 옮기기 (더블클릭하면 제자리로)" {...dragHandlers}>
      <BotAvatar />
      <div className="cb-title">
        <b>콜센터 AI 비서</b>
        <span>통화 기록 조회 · 통계</span>
      </div>
      <button className="cb-icon-btn" title="대화 지우기" disabled={!canClear} onClick={onClear}>
        <RotateCcw size={16} strokeWidth={1.5} />
      </button>
      <button className="cb-icon-btn cb-size-btn" title={isBig ? '기본 크기로' : '크게 보기'} onClick={onToggleBig}>
        {isBig ? <Minimize2 size={16} strokeWidth={1.5} /> : <Maximize2 size={16} strokeWidth={1.5} />}
      </button>
      <button className="cb-icon-btn" title="닫기" onClick={onClose}>
        <X size={16} strokeWidth={1.5} />
      </button>
    </header>
  )
}

/** 환영 인사. 대화가 시작되기 전에는 빠른 질문 칩도 같이 보여 준다. */
export function WelcomeRow({ showChips, onPick }: { showChips: boolean; onPick: (text: string) => void }) {
  return (
    <div className="cb-row">
      <BotAvatar small />
      <div className="cb-col">
        <div className="cb-bubble">{WELCOME}</div>
        {showChips && (
          <div className="cb-chips">
            {EXAMPLES.map((ex) => (
              <button key={ex} className="cb-chip" onClick={() => onPick(ex)}>
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** 말풍선 한 줄. 챗봇 답변의 결과 카드는 children 으로 받는다. */
export function MessageRow({ message, children }: { message: Message; children?: ReactNode }) {
  const mine = message.role === 'user'
  return (
    <div className={`cb-row${mine ? ' me' : ''}`}>
      {!mine && <BotAvatar small />}
      <div className="cb-col">
        <div className={`cb-bubble${message.error ? ' error' : ''}`}>{message.text}</div>
        {children}
        <span className="cb-time">{message.at}</span>
      </div>
    </div>
  )
}

/** 답을 기다리는 동안 보이는 점 세 개 */
export function TypingRow() {
  return (
    <div className="cb-row">
      <BotAvatar small />
      <div className="cb-bubble cb-typing" aria-label="답변 작성 중">
        <i />
        <i />
        <i />
      </div>
    </div>
  )
}

/** 대화가 시작된 뒤 입력창 위에 남는 빠른 질문 줄 */
export function QuickReplies({ disabled, onPick }: { disabled: boolean; onPick: (text: string) => void }) {
  return (
    <div className="cb-quick">
      {EXAMPLES.map((ex) => (
        <button key={ex} className="cb-chip" disabled={disabled} onClick={() => onPick(ex)}>
          {ex}
        </button>
      ))}
    </div>
  )
}

interface ComposerProps {
  value: string
  busy: boolean
  inputRef: React.Ref<HTMLInputElement>
  onChange: (value: string) => void
  onSubmit: () => void
}

export function Composer({ value, busy, inputRef, onChange, onSubmit }: ComposerProps) {
  return (
    <footer className="cb-footer">
      <div className="cb-inputbar">
        <input
          ref={inputRef}
          className="cb-input"
          value={value}
          placeholder="궁금한 내용을 입력하세요"
          maxLength={200}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) onSubmit() // 한글 조합 중 Enter 는 보내지 않는다
          }}
        />
        <button className="cb-send" aria-label="보내기" disabled={!value.trim() || busy} onClick={onSubmit}>
          <Send size={16} strokeWidth={1.5} />
        </button>
      </div>
      <div className="cb-notice">조회 전용입니다. 수정은 제안 버튼을 눌렀을 때만 반영돼요.</div>
    </footer>
  )
}
