// 대화 상태와 서버 호출. 화면 모양은 여기서 다루지 않는다.
import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { askChat, runSuggestedAction } from '../../api/chat'
import { formatKst } from '../../lib/date'
import type { ChatResponse, ChatTurn, SuggestedAction } from '../../types/Chat'
import { HISTORY_LIMIT } from './constants'

export interface Message {
  id: number
  role: 'user' | 'assistant'
  text: string
  at: string // 한국 시간 HH:mm
  response?: ChatResponse
  error?: boolean
}

/** 제안 버튼을 구분하는 값. 이미 누른 버튼을 기억하는 데 쓴다. */
export function actionKey(a: SuggestedAction): string {
  return `${a.path}|${JSON.stringify(a.body)}`
}

export function useChat() {
  const qc = useQueryClient()
  const nextId = useRef(1)
  const [messages, setMessages] = useState<Message[]>([])
  const [doneActions, setDoneActions] = useState<Set<string>>(new Set())

  const addMessage = (m: Omit<Message, 'id' | 'at'>) => {
    const at = formatKst(new Date().toISOString(), 'HH:mm')
    setMessages((prev) => [...prev, { ...m, id: nextId.current++, at }])
  }
  const addError = (e: Error) => addMessage({ role: 'assistant', text: e.message, error: true })

  const ask = useMutation({
    mutationFn: askChat,
    onSuccess: (res) => addMessage({ role: 'assistant', text: res.reply, response: res }),
    onError: addError,
  })

  // 제안 버튼을 눌렀을 때만 수정 API를 부른다
  const act = useMutation({
    mutationFn: runSuggestedAction,
    onSuccess: (_result, action) => {
      setDoneActions((prev) => new Set(prev).add(actionKey(action)))
      addMessage({ role: 'assistant', text: `처리했습니다. ${action.label}` })
      void qc.invalidateQueries({ queryKey: ['calls'] })
      void qc.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: addError,
  })

  /** 질문을 보낸다. 서버는 대화를 저장하지 않으므로 최근 이력을 같이 보낸다. */
  const send = (raw: string): boolean => {
    const message = raw.trim()
    if (!message || ask.isPending) return false
    const history: ChatTurn[] = messages
      .filter((m) => !m.error)
      .slice(-HISTORY_LIMIT)
      .map((m) => ({ role: m.role, content: m.text }))
    addMessage({ role: 'user', text: message })
    ask.mutate({ message, history })
    return true
  }

  return {
    messages,
    doneActions,
    isAsking: ask.isPending,
    isActing: act.isPending,
    send,
    runAction: (a: SuggestedAction) => act.mutate(a),
    clear: () => setMessages([]),
  }
}
