/** 차트 4개가 같이 쓰는 부품: 그라데이션 색, 말풍선 */

/** 막대 색 → 위는 진하고 아래는 옅은 세로 그라데이션. 막대의 fill 은 `url(#${prefix}-${번호})` 로 쓴다. */
export function GradientDefs({ prefix, colors, horizontal = false }: { prefix: string; colors: string[]; horizontal?: boolean }) {
  return (
    <defs>
      {colors.map((c, i) => (
        <linearGradient key={i} id={`${prefix}-${i}`} x1="0" y1="0" x2={horizontal ? '1' : '0'} y2={horizontal ? '0' : '1'}>
          <stop offset="0%" stopColor={c} stopOpacity={horizontal ? 0.55 : 1} />
          <stop offset="100%" stopColor={c} stopOpacity={horizontal ? 1 : 0.55} />
        </linearGradient>
      ))}
    </defs>
  )
}

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
