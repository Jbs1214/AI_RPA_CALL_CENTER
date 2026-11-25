import { Alert, Button, Descriptions, Form, Input, Popconfirm, Select, Space, Spin, Switch, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { audioUrl, deleteCall, fetchCall, patchCall } from '../../api/calls'
import { CATEGORIES, type CallDetail, type CallPatch } from '../../types/Call'
import { formatKst } from '../../lib/date'
import { parseErrorMessage } from '../../lib/errorLabel'
import ProcessButton from './ProcessButton'
import StatusTag from './StatusTag'
import TranscriptBubbles from './TranscriptBubbles'

interface FormValues {
  category: CallDetail['category']
  customer_question: string | null
  action_taken: string | null
  follow_up_needed: boolean | null
  customer_company: string | null
  customer_phone: string | null
}

const FIELDS: (keyof FormValues)[] = [
  'category',
  'customer_question',
  'action_taken',
  'follow_up_needed',
  'customer_company',
  'customer_phone',
]

function EditForm({ call, onDeleted }: { call: CallDetail; onDeleted: () => void }) {
  const qc = useQueryClient()
  const [form] = Form.useForm<FormValues>()

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['calls'] })
    void qc.invalidateQueries({ queryKey: ['stats'] })
    void qc.invalidateQueries({ queryKey: ['call', call.call_id] })
  }

  const save = useMutation({
    mutationFn: (patch: CallPatch) => patchCall(call.call_id, patch),
    onSuccess: () => {
      void message.success('저장했습니다')
      refresh()
    },
    onError: (e: Error) => void message.error(e.message),
  })

  const del = useMutation({
    mutationFn: () => deleteCall(call.call_id),
    onSuccess: () => {
      void message.success('삭제했습니다')
      refresh()
      onDeleted()
    },
    onError: (e: Error) => void message.error(e.message),
  })

  // 바뀐 항목만 보낸다
  const onSave = (values: FormValues) => {
    const patch: Record<string, unknown> = {}
    for (const k of FIELDS) {
      const next = values[k] === '' ? null : values[k]
      if (next !== call[k]) patch[k] = next
    }
    if (Object.keys(patch).length === 0) return void message.info('바뀐 내용이 없습니다')
    save.mutate(patch as CallPatch)
  }

  return (
    <Form form={form} layout="vertical" initialValues={FIELDS.reduce((o, k) => ({ ...o, [k]: call[k] }), {})} onFinish={onSave}>
      <Space size="large" align="start" wrap>
        <Form.Item label="유형" name="category">
          <Select style={{ width: 150 }} allowClear={false} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
        </Form.Item>
        <Form.Item label="후속조치" name="follow_up_needed" valuePropName="checked">
          <Switch checkedChildren="Y" unCheckedChildren="N" />
        </Form.Item>
      </Space>
      <Form.Item label="질문 요지" name="customer_question">
        <Input.TextArea autoSize={{ minRows: 1, maxRows: 4 }} maxLength={200} showCount />
      </Form.Item>
      <Form.Item label="조치 내역" name="action_taken">
        <Input.TextArea autoSize={{ minRows: 1, maxRows: 4 }} maxLength={200} showCount />
      </Form.Item>
      <Space wrap>
        <Form.Item label="고객사" name="customer_company">
          <Input style={{ width: 180 }} />
        </Form.Item>
        <Form.Item label="연락처" name="customer_phone">
          <Input style={{ width: 180 }} placeholder="-" />
        </Form.Item>
      </Space>
      <Space>
        <Button type="primary" htmlType="submit" loading={save.isPending}>저장</Button>
        <Popconfirm
          title="삭제할까요?"
          description="이 통화와 음성 파일이 함께 삭제되며 되돌릴 수 없습니다."
          okText="삭제"
          okButtonProps={{ danger: true }}
          cancelText="취소"
          onConfirm={() => del.mutate()}
        >
          <Button danger loading={del.isPending}>삭제</Button>
        </Popconfirm>
      </Space>
    </Form>
  )
}

interface Props {
  callId: string
  /** 삭제가 끝났을 때(드로어를 닫는다) */
  onDeleted: () => void
}

/** 통화 한 건의 상세 내용. 드로어(챗봇이 여는 것)와 상세 페이지가 같이 쓴다. */
export default function CallDetailBody({ callId, onDeleted }: Props) {
  const qc = useQueryClient()
  const { data: call, error, isLoading } = useQuery({
    queryKey: ['call', callId],
    queryFn: () => fetchCall(callId),
  })

  const confirmReview = useMutation({
    mutationFn: () => patchCall(callId, { needs_review: false }),
    onSuccess: () => {
      void message.success('확인 완료 처리했습니다')
      void qc.invalidateQueries({ queryKey: ['calls'] })
      void qc.invalidateQueries({ queryKey: ['stats'] })
      void qc.invalidateQueries({ queryKey: ['call', callId] })
    },
    onError: (e: Error) => void message.error(e.message),
  })

  if (isLoading) return <Spin />
  if (error) return <Alert type="error" showIcon message={error.message} />
  if (!call) return null

  const err = parseErrorMessage(call.error_message)

  return (
    <div className="detail">
      <h3 className="detail__title">통화 정보</h3>
      <Descriptions size="small" column={1}>
        <Descriptions.Item label="통화일시">{formatKst(call.called_at, 'YYYY-MM-DD HH:mm')}</Descriptions.Item>
        <Descriptions.Item label="담당자">{call.agent_name}</Descriptions.Item>
        <Descriptions.Item label="상태">
          <StatusTag status={call.status} />
          {call.retry_count > 0 && <span className="text-muted">재처리 {call.retry_count}회</span>}
          <span style={{ marginLeft: 8 }}>
            <ProcessButton call={call} showWhenDisabled />
          </span>
        </Descriptions.Item>
        {call.analysis_json?.customer_name && <Descriptions.Item label="고객명">{call.analysis_json.customer_name}</Descriptions.Item>}
        {call.analysis_json?.duration_sec !== undefined && <Descriptions.Item label="통화 길이">{call.analysis_json.duration_sec}초</Descriptions.Item>}
        <Descriptions.Item label="음성 인식 신뢰도">{call.confidence ?? '-'}</Descriptions.Item>
      </Descriptions>

      {err && (
        <Alert
          style={{ margin: '8px 0' }}
          type="error"
          showIcon
          message={err.label}
          description={
            <>
              {err.detail}
              {/* 시나리오: 처리에 실패하면 같은 파일을 다시 올린다 */}
              {call.status === 'FAILED' && <div>같은 파일을 다시 올려 주세요.</div>}
            </>
          }
        />
      )}

      {call.audio_available && <audio controls style={{ width: '100%', margin: '8px 0' }} src={audioUrl(call.call_id)} />}

      {call.needs_review && (
        <Alert
          style={{ margin: '8px 0' }}
          type="warning"
          showIcon
          message={`검토 필요 (음성 인식 신뢰도 ${call.confidence ?? '-'})`}
          action={<Button size="small" type="primary" loading={confirmReview.isPending} onClick={() => confirmReview.mutate()}>확인 완료</Button>}
        />
      )}

      <h3 className="detail__title">수정</h3>
      {call.status === 'DONE' || call.status === 'FAILED' ? (
        <EditForm key={`${call.call_id}-${call.updated_at}`} call={call} onDeleted={onDeleted} />
      ) : (
        <Alert type="info" showIcon message="처리가 끝나면 내용을 볼 수 있습니다" />
      )}

      <h3 className="detail__title">대화</h3>
      <TranscriptBubbles transcript={call.transcript} />
    </div>
  )
}