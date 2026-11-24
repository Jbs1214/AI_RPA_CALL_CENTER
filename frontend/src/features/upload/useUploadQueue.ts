import { useCallback, useRef, useState } from 'react'
import { message } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import { uploadRecording, type UploadMeta } from '../../api/calls'
import { ApiError } from '../../types/ApiError'

export type StagedStatus = 'ready' | 'uploading' | 'done' | 'error'

export interface StagedFile {
  uid: string
  file: File
  status: StagedStatus
  /** 실패했을 때 보여 줄 문구 */
  error?: string
}

/**
 * 올릴 파일을 먼저 목록에 담아 두고, 사용자가 "업로드 시작"을 눌렀을 때 하나씩 올린다.
 * 담은 파일은 하나씩 빼거나 전체를 비울 수 있고, 올리는 도중에도 취소할 수 있다.
 */
export function useUploadQueue(getMeta: () => UploadMeta) {
  const qc = useQueryClient()
  const [items, setItems] = useState<StagedFile[]>([])
  const [busy, setBusy] = useState(false)
  const [dup, setDup] = useState<string | null>(null)
  const controllers = useRef(new Map<string, AbortController>()) // 올리는 중인 파일의 취소 장치
  const stopped = useRef(false) // "중단"을 눌렀으면 남은 파일은 올리지 않는다

  const patch = useCallback((uid: string, next: Partial<StagedFile>) => {
    setItems((list) => list.map((i) => (i.uid === uid ? { ...i, ...next } : i)))
  }, [])

  /** 목록에 담기. 같은 파일은 한 번만 담는다 */
  const add = useCallback((file: File) => {
    const uid = `${file.name}-${file.size}-${file.lastModified}`
    setItems((list) => (list.some((i) => i.uid === uid) ? list : [...list, { uid, file, status: 'ready' }]))
  }, [])

  /** 한 개 빼기. 올리는 중이면 그 업로드를 취소한다 */
  const remove = useCallback((uid: string) => {
    controllers.current.get(uid)?.abort()
    setItems((list) => list.filter((i) => i.uid !== uid))
  }, [])

  /** 올리는 것을 모두 멈춘다(남은 파일은 대기 상태로 남는다) */
  const stop = useCallback(() => {
    stopped.current = true
    controllers.current.forEach((c) => c.abort())
  }, [])

  /** 목록을 모두 비우고 알림도 지운다 */
  const clear = useCallback(() => {
    stop()
    setItems([])
    setDup(null)
  }, [stop])

  const start = useCallback(async () => {
    const targets = items.filter((i) => i.status === 'ready' || i.status === 'error')
    if (targets.length === 0) return
    stopped.current = false
    setBusy(true)
    setDup(null)
    const meta = getMeta()
    let ok = 0
    for (const t of targets) {
      if (stopped.current) break
      const controller = new AbortController()
      controllers.current.set(t.uid, controller)
      patch(t.uid, { status: 'uploading', error: undefined })
      try {
        await uploadRecording(t.file, meta, controller.signal)
        patch(t.uid, { status: 'done' })
        ok += 1
      } catch (e) {
        if (controller.signal.aborted) {
          patch(t.uid, { status: 'ready' }) // 사용자가 취소했다. 다시 올릴 수 있게 대기로 되돌린다
        } else if (e instanceof ApiError && e.code === 'DUPLICATE_FILE') {
          const text = `이미 처리 중이거나 완료된 파일입니다${e.body?.existing_call_id ? ` (${e.body.existing_call_id})` : ''}`
          patch(t.uid, { status: 'error', error: '이미 올린 파일' })
          setDup(text)
        } else {
          patch(t.uid, { status: 'error', error: (e as Error).message })
        }
      } finally {
        controllers.current.delete(t.uid)
      }
    }
    setBusy(false)
    void qc.invalidateQueries({ queryKey: ['calls'] })
    void qc.invalidateQueries({ queryKey: ['stats'] })
    if (ok > 0) void message.success(`${ok}개 올렸습니다`)
  }, [items, getMeta, patch, qc])

  const readyCount = items.filter((i) => i.status === 'ready' || i.status === 'error').length

  return { items, busy, dup, setDup, readyCount, add, remove, stop, clear, start }
}
