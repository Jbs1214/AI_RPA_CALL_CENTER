/** 차트 4개가 같이 쓰는 부품: 말풍선 */

interface Entry {
  name?: string | number
  value?: number | string
  color?: string
  payload?: Record<string, unknown>
}

interface TooltipProps {
  active?: boolean
  label?: unknown
  payload?: readonly Entry[]
  /** 항목의 색을 직접 정할 때(막대마다 색이 다른 차트) */
  colorOf?: (entry: Entry) => string | undefined
}

/** 모든 차트가 같은 모양으로 쓰는 말풍선: 제목 + 색 점 + 이름 + 값 */
export function ChartTooltip({ active, label, payload, colorOf }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      {label !== undefined && label !== '' && <div className="chart-tooltip__title">{String(label)}</div>}
      {payload.map((p, i) => (
        <div key={i} className="chart-tooltip__row">
          <span className="chart-tooltip__dot" style={{ background: colorOf?.(p) ?? p.color }} />
          <span className="chart-tooltip__name">{p.name}</span>
          <b className="chart-tooltip__value">{p.value}건</b>
        </div>
      ))}
    </div>
  )
}
