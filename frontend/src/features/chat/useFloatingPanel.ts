// 챗봇 창을 옮기고(머리말 드래그) 크기를 바꾸는(왼쪽 위 모서리 드래그, 크게 보기 버튼) 동작.
// 창은 오른쪽 아래에 고정돼 있고, 옮긴 거리(offset)와 크기(size)만 상태로 들고 있다.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { PANEL_BIG_WIDTH, PANEL_MARGIN, PANEL_MIN_HEIGHT, PANEL_MIN_WIDTH } from './constants'

type PointerHandler = (e: ReactPointerEvent<HTMLElement>) => void

interface DragStart {
  pointerX: number
  pointerY: number
  left: number // 시작할 때 창의 화면 위치
  top: number
  offsetX: number // 시작할 때 옮겨진 거리
  offsetY: number
}

interface ResizeStart {
  pointerX: number
  pointerY: number
  width: number
  height: number
  right: number // 오른쪽·아래는 고정이므로 이 값이 커질 수 있는 한계가 된다
  bottom: number
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
const isButton = (e: ReactPointerEvent<HTMLElement> | { target: EventTarget }) =>
  !!(e.target as HTMLElement).closest('button')

export function useFloatingPanel() {
  const panelRef = useRef<HTMLElement>(null)
  const drag = useRef<DragStart | null>(null)
  const resize = useRef<ResizeStart | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [size, setSize] = useState<{ width: number; height: number } | null>(null) // null 이면 기본 크기
  const [active, setActive] = useState(false) // 끄는 중

  const resetPosition = () => setOffset({ x: 0, y: 0 })

  // 머리말을 잡고 끌면 창이 움직인다. 화면 밖으로는 나가지 않는다.
  const onDragStart: PointerHandler = (e) => {
    if (isButton(e) || !panelRef.current) return
    const rect = panelRef.current.getBoundingClientRect()
    drag.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      left: rect.left,
      top: rect.top,
      offsetX: offset.x,
      offsetY: offset.y,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    setActive(true)
  }
  const onDragMove: PointerHandler = (e) => {
    const d = drag.current
    if (!d || !panelRef.current) return
    const { width, height } = panelRef.current.getBoundingClientRect()
    const left = clamp(d.left + e.clientX - d.pointerX, 0, window.innerWidth - width)
    const top = clamp(d.top + e.clientY - d.pointerY, 0, window.innerHeight - height)
    setOffset({ x: d.offsetX + left - d.left, y: d.offsetY + top - d.top })
  }
  const onDragEnd = () => {
    drag.current = null
    setActive(false)
  }

  // 왼쪽 위 모서리를 잡고 끌면 크기가 바뀐다. 오른쪽 아래가 고정이라 왼쪽 위로 커진다.
  const onResizeStart: PointerHandler = (e) => {
    if (!panelRef.current) return
    const rect = panelRef.current.getBoundingClientRect()
    resize.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      width: rect.width,
      height: rect.height,
      right: rect.right,
      bottom: rect.bottom,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.stopPropagation()
    setActive(true)
  }
  const onResizeMove: PointerHandler = (e) => {
    const r = resize.current
    if (!r) return
    setSize({
      width: clamp(r.width - (e.clientX - r.pointerX), PANEL_MIN_WIDTH, r.right),
      height: clamp(r.height - (e.clientY - r.pointerY), PANEL_MIN_HEIGHT, r.bottom),
    })
  }
  const onResizeEnd = () => {
    resize.current = null
    setActive(false)
  }

  /** 크게 보기 ↔ 기본 크기. 위치는 기본 위치로 돌린다. */
  const toggleBig = () => {
    resetPosition()
    setSize(
      size
        ? null
        : { width: Math.min(PANEL_BIG_WIDTH, window.innerWidth - PANEL_MARGIN), height: window.innerHeight - PANEL_MARGIN },
    )
  }

  // 브라우저 창이 줄어 챗봇이 화면 밖으로 나가면 기본 위치와 크기로 되돌린다
  useEffect(() => {
    const onWindowResize = () => {
      const rect = panelRef.current?.getBoundingClientRect()
      if (!rect) return
      const outside = rect.left < 0 || rect.top < 0 || rect.right > window.innerWidth || rect.bottom > window.innerHeight
      if (outside) {
        setOffset({ x: 0, y: 0 })
        setSize(null)
      }
    }
    window.addEventListener('resize', onWindowResize)
    return () => window.removeEventListener('resize', onWindowResize)
  }, [])

  return {
    panelRef,
    isBig: size !== null,
    isMoving: active,
    toggleBig,
    /** <section> 에 붙일 style */
    panelStyle: { translate: `${offset.x}px ${offset.y}px`, ...size },
    /** 머리말에 붙일 핸들러 */
    headerHandlers: {
      onPointerDown: onDragStart,
      onPointerMove: onDragMove,
      onPointerUp: onDragEnd,
      onPointerCancel: onDragEnd,
      onDoubleClick: (e: React.MouseEvent<HTMLElement>) => {
        if (!isButton(e)) resetPosition() // 더블클릭하면 제자리로
      },
    },
    /** 왼쪽 위 손잡이에 붙일 핸들러 */
    resizeHandlers: {
      onPointerDown: onResizeStart,
      onPointerMove: onResizeMove,
      onPointerUp: onResizeEnd,
      onPointerCancel: onResizeEnd,
    },
  }
}
