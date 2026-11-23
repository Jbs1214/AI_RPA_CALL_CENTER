import { parseTranscript } from '../../lib/parseTranscript'

/** 상담원은 왼쪽, 고객은 오른쪽 말풍선 */
export default function TranscriptBubbles({ transcript }: { transcript: string | null }) {
  const lines = parseTranscript(transcript)
  if (lines.length === 0) return <div style={{ color: '#888' }}>대화 내용이 없습니다</div>
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {lines.map((l, i) => {
        const right = l.speaker === '고객'
        return (
          <div key={i} style={{ display: 'flex', justifyContent: right ? 'flex-end' : 'flex-start' }}>
            <div
              style={{
                maxWidth: '80%',
                padding: '6px 10px',
                borderRadius: 10,
                background: right ? '#eef6ee' : '#e5eefc',
                whiteSpace: 'pre-wrap',
              }}
            >
              {l.text}
            </div>
          </div>
        )
      })}
    </div>
  )
}
