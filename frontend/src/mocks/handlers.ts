import { http, HttpResponse } from 'msw'
import { CATEGORIES, type Call, type CallDetail } from '../types/Call'
import type { Stats } from '../types/Stats'

// 서버 없이 화면을 만들 때 쓰는 가짜 응답(VITE_USE_MOCK=true). 가짜 개인정보만 사용한다.
const base = {
  customer_phone: null,
  file_hash: '0'.repeat(64),
  retry_count: 0,
  audio_available: false,
  job_state: null,
  created_at: '2026-11-23T10:15:00+09:00',
  updated_at: '2026-11-23T10:15:00+09:00',
  error_message: null,
  confidence: 0.91,
  audio_size_bytes: null,
  job_key: null,
  analysis_json: { customer_name: '김○○', duration_sec: 184 },
  transcript: '[상담원] 안녕하세요, 고객센터입니다.\n[고객] 네, 문의드릴 게 있어서요.\n[상담원] 말씀해 주세요.',
}

let calls: CallDetail[] = [
  { ...base, call_id: 'CALL-20261123-001', called_at: '2026-11-23T10:15:00+09:00', agent_name: '박지훈', customer_company: '대한유통', customer_phone: '010-****-2201', category: '교육 내용', customer_question: '관리자 권한 설정 교육 자료 요청', action_taken: '관리자 가이드 PDF 이메일 발송', follow_up_needed: false, needs_review: false, source_filename: '20261123_1015_박지훈_대한유통.wav', status: 'DONE' },
  { ...base, call_id: 'CALL-20261123-002', called_at: '2026-11-23T10:50:00+09:00', agent_name: '김민수', customer_company: '미래테크', category: '질의', customer_question: '계약 갱신 시 요금 변경 여부', action_taken: '담당 부서 확인 후 회신 약속', follow_up_needed: true, needs_review: true, confidence: 0.62, source_filename: '20261123_1050_김민수_미래테크.wav', status: 'DONE', audio_available: true },
  { ...base, call_id: 'CALL-20261123-003', called_at: '2026-11-23T11:30:00+09:00', agent_name: '김민수', customer_company: '대한유통', category: '불만', customer_question: '배송 지연으로 납기 차질, 보상 요구', action_taken: '사과 후 물류팀 확인 요청', follow_up_needed: true, needs_review: false, source_filename: '20261123_1130_김민수_대한유통.wav', status: 'DONE' },
  { ...base, call_id: 'CALL-20261123-004', called_at: '2026-11-23T11:45:00+09:00', agent_name: '박지훈', customer_company: '새봄물산', category: null, customer_question: null, action_taken: null, follow_up_needed: null, needs_review: null, confidence: null, transcript: null, analysis_json: null, source_filename: '20261123_1145_박지훈_새봄물산.wav', status: 'FAILED', error_message: 'STT_TIMEOUT: 변환 대기 시간 초과' },
]

function makeStats(): Stats {
  const done = calls.filter((c) => c.status === 'DONE')
  const count = (cat: string) => done.filter((c) => c.category === cat).length
  const days = [...new Set(done.map((c) => c.called_at.slice(0, 10)))]
  const agents = [...new Set(done.map((c) => c.agent_name))]
  const companies = [...new Set(done.map((c) => c.customer_company ?? ''))].filter(Boolean)
  return {
    total_calls: calls.length,
    analyzed: done.length,
    follow_up_needed: done.filter((c) => c.follow_up_needed).length,
    needs_review: done.filter((c) => c.needs_review).length,
    failed: calls.filter((c) => c.status === 'FAILED').length,
    in_progress: calls.filter((c) => c.status === 'RECEIVED' || c.status === 'PROCESSING').length,
    by_category: CATEGORIES.map((category) => ({ category, count: count(category) })),
    by_agent: agents.map((agent_name) => ({
      agent_name,
      count: done.filter((c) => c.agent_name === agent_name).length,
      follow_up_count: done.filter((c) => c.agent_name === agent_name && c.follow_up_needed).length,
    })),
    by_day: days.map((date) => ({
      date,
      count: done.filter((c) => c.called_at.startsWith(date)).length,
      by_category: Object.fromEntries(CATEGORIES.map((cat) => [cat, done.filter((c) => c.called_at.startsWith(date) && c.category === cat).length])) as Record<(typeof CATEGORIES)[number], number>,
    })),
    by_company: companies.map((customer_company) => ({
      customer_company,
      count: done.filter((c) => c.customer_company === customer_company).length,
      complaint_count: done.filter((c) => c.customer_company === customer_company && c.category === '불만').length,
    })),
  }
}

const toListItem = (c: CallDetail): Call => {
  const { confidence: _a, audio_size_bytes: _b, job_key: _c, transcript: _d, analysis_json: _e, ...item } = c
  return item
}

export const handlers = [
  http.get('*/api/stats', () => HttpResponse.json(makeStats())),
  http.get('*/api/calls', ({ request }) => {
    const p = new URL(request.url).searchParams
    let list = calls.filter((c) => {
      if (p.get('category') && c.category !== p.get('category')) return false
      if (p.get('agent') && c.agent_name !== p.get('agent')) return false
      if (p.get('company') && c.customer_company !== p.get('company')) return false
      if (p.get('status') && c.status !== p.get('status')) return false
      if (p.get('follow_up') && String(!!c.follow_up_needed) !== p.get('follow_up')) return false
      if (p.get('needs_review') && String(!!c.needs_review) !== p.get('needs_review')) return false
      const q = p.get('q')
      if (q && !`${c.agent_name}${c.customer_company}${c.customer_question}${c.action_taken}`.includes(q)) return false
      return true
    })
    list = [...list].sort((a, b) => b.called_at.localeCompare(a.called_at))
    const page = Number(p.get('page') ?? 1)
    const size = Number(p.get('size') ?? 20)
    return HttpResponse.json({ total: list.length, page, size, items: list.slice((page - 1) * size, page * size).map(toListItem) })
  }),
  http.get('*/api/calls/:id', ({ params }) => {
    const c = calls.find((x) => x.call_id === params.id)
    return c ? HttpResponse.json(c) : HttpResponse.json({ error: 'NOT_FOUND', message: '통화를 찾을 수 없습니다' }, { status: 404 })
  }),
  http.patch('*/api/calls/:id', async ({ params, request }) => {
    const patch = (await request.json()) as Partial<CallDetail>
    const i = calls.findIndex((x) => x.call_id === params.id)
    if (i < 0) return HttpResponse.json({ error: 'NOT_FOUND', message: '통화를 찾을 수 없습니다' }, { status: 404 })
    calls[i] = { ...calls[i], ...patch, updated_at: new Date().toISOString() }
    return HttpResponse.json(calls[i])
  }),
  http.delete('*/api/calls/:id', ({ params }) => {
    calls = calls.filter((x) => x.call_id !== params.id)
    return new HttpResponse(null, { status: 204 })
  }),
  http.post('*/api/recordings', () => {
    const n = String(calls.length + 1).padStart(3, '0')
    const c: CallDetail = { ...base, call_id: `CALL-20261123-${n}`, called_at: new Date().toISOString(), agent_name: '미확인', customer_company: null, category: null, customer_question: null, action_taken: null, follow_up_needed: null, needs_review: null, confidence: null, transcript: null, analysis_json: null, source_filename: 'upload.wav', status: 'RECEIVED' }
    calls = [c, ...calls]
    return HttpResponse.json(toListItem(c), { status: 201 })
  }),
  http.post('*/api/chat', async ({ request }) => {
    const { message } = (await request.json()) as { message: string }
    const done = calls.filter((c) => c.status === 'DONE')
    const query: Record<string, string | boolean> = {}
    let list = done
    for (const cat of CATEGORIES) if (message.includes(cat)) { query.category = cat; list = list.filter((c) => c.category === cat) }
    if (message.includes('후속')) { query.follow_up = true; list = list.filter((c) => c.follow_up_needed) }
    if (message.includes('검토')) { query.needs_review = true; list = list.filter((c) => c.needs_review) }
    if (!Object.keys(query).length && !message.includes('전체') && !message.includes('담당자별')) {
      return HttpResponse.json({ reply: '질문을 이해하지 못했습니다. 예: 불만 중 후속조치 필요한 통화 보여줘', intent: 'help', mode: 'rule', query: {}, total: 0, items: [], stats: null, suggested_actions: [] })
    }
    const items = list.slice(0, 5).map(toListItem)
    if (message.includes('담당자별')) {
      return HttpResponse.json({ reply: `전체 통화는 ${done.length}건입니다.`, intent: 'stats', mode: 'rule', query: {}, total: done.length, items: [], stats: { by_agent: makeStats().by_agent }, suggested_actions: [] })
    }
    const action = message.includes('처리')
    return HttpResponse.json({
      reply: `${list.length}건입니다.`, intent: action ? 'action' : 'list', mode: 'rule', query, total: list.length, items, stats: null,
      suggested_actions: action ? items.map((it) => ({ label: `확인 완료 처리: ${it.call_id}`, method: 'PATCH', path: `/api/calls/${it.call_id}`, body: { needs_review: false } })) : [],
    })
  }),
  http.post('*/api/calls/:id/process', ({ params }) => {
    const i = calls.findIndex((x) => x.call_id === params.id)
    if (i < 0) return HttpResponse.json({ error: 'NOT_FOUND', message: '없는 관리번호입니다.' }, { status: 404 })
    if (calls[i].status !== 'RECEIVED' && calls[i].status !== 'FAILED') {
      return HttpResponse.json({ error: 'INVALID_STATE', message: '지금 상태에서는 처리를 시작할 수 없습니다.' }, { status: 409 })
    }
    calls[i] = { ...calls[i], status: 'PROCESSING', error_message: null }
    return HttpResponse.json({ call_id: calls[i].call_id, status: 'PROCESSING', job_key: null })
  }),
  // 처리 시작 버튼을 시험하려면 enabled 를 true 로 바꾼다
  http.get('*/health', () => HttpResponse.json({ status: 'ok', orchestrator: { enabled: false } })),
]
