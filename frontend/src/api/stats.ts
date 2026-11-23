import { client } from './client'
import type { Stats } from '../types/Stats'

export async function fetchStats(range: { from?: string; to?: string } = {}): Promise<Stats> {
  const params: Record<string, string> = {}
  if (range.from) params.from = range.from
  if (range.to) params.to = range.to
  const { data } = await client.get<Stats>('/api/stats', { params })
  return data
}
