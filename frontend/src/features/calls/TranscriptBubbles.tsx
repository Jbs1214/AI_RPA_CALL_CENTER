import { parseTranscript } from '../../lib/parseTranscript'

/** 상담원은 왼쪽, 고객은 오른쪽 말풍선 (모양은 styles/theme.css 의 .transcript) */
export default function TranscriptBubbles({ transcript }: { transcript: string | null }) {
  const lines = parseTranscript(transcript)
  if (lines.length === 0) return <div className="transcript__empty">대화 내용이 없습니다</div>
  return (
    <div className="transcript">
      {lines.map((l, i) => (
        <div key={i} className={`transcript__row${l.speaker === '고객' ? ' transcript__row--customer' : ''}`}>
          <div className="transcript__bubble">{l.text}</div>
        </div>
      ))}
    </div>
  )
}
