import { Table, Tag, Alert, Button, Popconfirm, message } from 'antd'
import { ClockCircleOutlined, SyncOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteCall, fetchCalls } from '../../api/calls'
import { formatKst } from '../../lib/date'
import { STATUS_COLOR, STATUS_LABEL } from '../../lib/statusLabel'
import { parseErrorMessage } from '../../lib/errorLabel'
import { POLL_INTERVAL_MS } from '../../lib/polling'
import type { Call, CallFilters } from '../../types/Call'
import ProcessButton from './ProcessButton'

interface Props {
  filters: CallFilters
  onChange: (next: CallFilters) => void
  onOpen: (callId: string) => void
}

export default function CallTable({ filters, onChange, onOpen }: Props) {
  const qc = useQueryClient()
  const { data, error, isLoading } = useQuery({
    queryKey: ['calls', filters],
    queryFn: () => fetchCalls(filters),
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  })

  const del = useMutation({
    mutationFn: deleteCall,
    onSuccess: () => {
      void message.success('삭제했습니다')
      void qc.invalidateQueries({ queryKey: ['calls'] })
      void qc.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: (e: Error) => void message.error(e.message),
  })

  const columns: ColumnsType<Call> = [
    { title: '통화일시', dataIndex: 'called_at', width: 110, render: (v: string) => formatKst(v) },
    { title: '담당자', dataIndex: 'agent_name', width: 90 },
    { title: '고객사', dataIndex: 'customer_company', width: 120, render: (v: string | null) => v ?? '-' },
    { title: '유형', dataIndex: 'category', width: 90, render: (v: string | null) => v ?? '—' },
    {
      title: '질문 요지',
      dataIndex: 'customer_question',
      ellipsis: true,
      render: (v: string | null, row) => {
        if (row.status === 'FAILED') {
          const e = parseErrorMessage(row.error_message)
          return <span className="text-danger">{e ? `${e.label}${e.detail ? `: ${e.detail}` : ''}` : '실패'}</span>
        }
        return v ?? '—'
      },
    },
    {
      title: '후속조치',
      dataIndex: 'follow_up_needed',
      width: 80,
      render: (v: boolean | null) => (v === null ? '—' : v ? <span className="text-danger">Y</span> : 'N'),
    },
    { title: '검토', dataIndex: 'needs_review', width: 70, render: (v: boolean | null) => (v ? <Tag color="gold">검토</Tag> : null) },
    {
      title: '상태',
      dataIndex: 'status',
      width: 100,
      render: (v: Call['status']) => (
        // 대기·처리 중은 아이콘을 붙여 눈에 띄게 한다(처리 중은 빙글빙글)
        <Tag
          color={STATUS_COLOR[v]}
          icon={v === 'PROCESSING' ? <SyncOutlined spin /> : v === 'RECEIVED' ? <ClockCircleOutlined /> : undefined}
        >
          {STATUS_LABEL[v]}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 220,
      render: (_: unknown, row) => (
        <span onClick={(e) => e.stopPropagation()}>
          <ProcessButton call={row} />
          <Button size="small" type="link" onClick={() => onOpen(row.call_id)}>보기</Button>
          <Popconfirm
            title="삭제할까요?"
            description="이 통화와 음성 파일이 함께 삭제되며 되돌릴 수 없습니다."
            okText="삭제"
            okButtonProps={{ danger: true }}
            cancelText="취소"
            onConfirm={() => del.mutate(row.call_id)}
          >
            <Button size="small" type="link" danger>삭제</Button>
          </Popconfirm>
        </span>
      ),
    },
  ]

  if (error) return <Alert type="error" showIcon message={error.message} />

  return (
    <Table<Call>
      size="small"
      rowKey="call_id"
      loading={isLoading}
      columns={columns}
      scroll={{ x: 900 }} // 좁은 화면에서는 표만 가로로 밀어 본다
      dataSource={data?.items ?? []}
      locale={{ emptyText: '조건에 맞는 통화가 없습니다' }}
      onRow={(r) => ({ onClick: () => onOpen(r.call_id), style: { cursor: 'pointer' } })}
      rowClassName={(r) => (r.status === 'FAILED' ? 'row-failed' : r.needs_review ? 'row-review' : '')}
      pagination={{
        position: ['bottomCenter'],
        current: data?.page ?? filters.page ?? 1,
        pageSize: data?.size ?? filters.size ?? 20,
        total: data?.total ?? 0,
        showSizeChanger: true,
        pageSizeOptions: [10, 20, 50, 100],
        onChange: (page, size) => onChange({ ...filters, page, size }),
      }}
    />
  )
}
