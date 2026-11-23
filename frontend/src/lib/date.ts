import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

export const TZ = 'Asia/Seoul'

/** 서버 시각(+09:00) → 한국 시간 문자열 */
export function formatKst(iso: string, pattern = 'MM-DD HH:mm'): string {
  return dayjs(iso).tz(TZ).format(pattern)
}

/** 업로드 등으로 서버에 보낼 때: 반드시 +09:00 을 붙인다 (없으면 서버가 422) */
export function toKstIso(d: Date | string): string {
  return dayjs(d).tz(TZ).format('YYYY-MM-DDTHH:mm:ssZ')
}

/** 필터용 날짜 (한국 날짜) */
export function toKstDate(d: Date | string): string {
  return dayjs(d).tz(TZ).format('YYYY-MM-DD')
}
