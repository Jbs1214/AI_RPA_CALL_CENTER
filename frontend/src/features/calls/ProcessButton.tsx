import { Button, Tooltip, message } from 'antd'
import { PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchHealth, startProcess } from '../../api/calls'
import { apiErrorLabel } from '../../lib/errorLabel'
import type { Call } from '../../types/Call'

/** 서버가 Orchestrator 연동을 켰는지(GET /health). 꺼져 있으면 처리 시작 버튼을 보여 주지 않는다. */
function useOrchestratorEnabled(): boolean {
  const { data } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })
  return data?.orchestrator.enabled === true
}

interface Props {
  call: Pick<Call, 'call_id' | 'status' | 'audio_available'>
  /** 처리할 수 없는 상태에서도 비활성 버튼으로 보여 줄지(상세 화면). 목록에서는 숨긴다. */
  showWhenDisabled?: boolean
}

/**
 * "처리 시작"(대기) / "재처리"(실패) 버튼. POST /api/calls/{call_id}/process.
 * 업로드한 뒤 자동으로 부르지 않고, 사용자가 눌렀을 때만 부른다.
 */
export default function ProcessButton({ call, showWhenDisabled = false }: Props) {
  const enabled = useOrchestratorEnabled()
  const qc = useQueryClient()

  const start = useMutation({
    mutationFn: () => startProcess(call.call_id),
    onSuccess: () => {
      void message.success('처리를 시작했습니다')
      void qc.invalidateQueries({ queryKey: ['calls'] })
      void qc.invalidateQueries({ queryKey: ['stats'] })
      void qc.invalidateQueries({ queryKey: ['call', call.call_id] })
    },
    onError: (e: Error) => {
      void message.error(apiErrorLabel(e))
      void qc.invalidateQueries({ queryKey: ['calls'] }) // 다른 곳에서 먼저 처리했을 수 있으니 목록을 다시 본다
    },
  })

  if (!enabled) return null

  const canStart = call.status === 'RECEIVED' || call.status === 'FAILED'
  if (!canStart && !showWhenDisabled) return null

  const retry = call.status === 'FAILED'
  const noAudio = canStart && !call.audio_available
  const disabled = !canStart || noAudio
  const reason = !canStart
    ? '대기 또는 실패 상태일 때만 처리할 수 있습니다'
    : noAudio
      ? '음성 파일이 없는 통화는 처리할 수 없습니다'
      : undefined

  return (
    <Tooltip title={reason}>
      <span onClick={(e) => e.stopPropagation()}>
        <Button
          size="small"
          type={retry ? 'default' : 'primary'}
          icon={retry ? <ReloadOutlined /> : <PlayCircleOutlined />}
          disabled={disabled}
          loading={start.isPending}
          onClick={() => start.mutate()}
        >
          {retry ? '재처리' : '처리 시작'}
        </Button>
      </span>
    </Tooltip>
  )
}
