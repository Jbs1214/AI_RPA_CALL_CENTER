import { client, API_BASE_URL } from './client'
import type { CallDetail, CallFilters, CallList, CallPatch, Call } from '../types/Call'

/** 값이 없는 조건은 보내지 않는다 */
function clean(filters: CallFilters): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '' && v !== null) out[k] = v as string | number | boolean
  }
  return out
}

export async function fetchCalls(filters: CallFilters = {}): Promise<CallList> {
  const { data } = await client.get<CallList>('/api/calls', { params: clean(filters) })
  return data
}

export async function fetchCall(callId: string): Promise<CallDetail> {
  const { data } = await client.get<CallDetail>(`/api/calls/${callId}`)
  return data
}

/** 바꾼 항목만 보낸다 */
export async function patchCall(callId: string, patch: CallPatch): Promise<CallDetail> {
  const { data } = await client.patch<CallDetail>(`/api/calls/${callId}`, patch)
  return data
}

export async function deleteCall(callId: string): Promise<void> {
  await client.delete(`/api/calls/${callId}`)
}

export interface UploadMeta {
  called_at?: string // 보낼 때는 반드시 +09:00
  agent_name?: string
  customer_company?: string
}

export async function uploadRecording(file: File, meta: UploadMeta = {}): Promise<Call> {
  const form = new FormData()
  form.append('file', file)
  for (const [k, v] of Object.entries(meta)) if (v) form.append(k, v)
  const { data } = await client.post<Call>('/api/recordings', form)
  return data
}

/** <audio src> 에 쓰는 주소 */
export function audioUrl(callId: string): string {
  return `${API_BASE_URL}/api/calls/${callId}/audio`
}

/** 엑셀 다운로드(API 7) 주소. 목록과 같은 조건, page·size·status 는 보내지 않는다 */
export function exportUrl(filters: CallFilters = {}): string {
  const { page: _p, size: _s, status: _st, ...rest } = filters
  const qs = new URLSearchParams(
    Object.entries(clean(rest)).map(([k, v]) => [k, String(v)]),
  ).toString()
  return `${API_BASE_URL}/api/calls/export${qs ? `?${qs}` : ''}`
}

export async function fetchHealth(): Promise<{ status: string; orchestrator: { enabled: boolean } }> {
  const { data } = await client.get('/health')
  return data
}
