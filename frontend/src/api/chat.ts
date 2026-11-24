import { client } from './client'
import { patchCall } from './calls'
import type { ChatRequest, ChatResponse, SuggestedAction } from '../types/Chat'

/** 챗봇 질문. 서버는 대화를 저장하지 않으므로 history 는 화면이 보낸다 */
export async function askChat(req: ChatRequest): Promise<ChatResponse> {
  const { data } = await client.post<ChatResponse>('/api/chat', req)
  return data
}

/** 제안 버튼을 눌렀을 때만 호출한다. path 의 call_id 로 수정 API(4번)를 부른다 */
export async function runSuggestedAction(action: SuggestedAction): Promise<void> {
  const callId = action.path.split('/').filter(Boolean).pop()
  if (!callId) throw new Error('잘못된 제안입니다')
  await patchCall(callId, action.body)
}
