import { useState } from 'react'
import { Alert, Collapse, DatePicker, Input, Space, Upload, message } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import type { Dayjs } from 'dayjs'
import { uploadRecording } from '../../api/calls'
import { toKstIso } from '../../lib/date'
import { ApiError } from '../../types/ApiError'

const MAX_BYTES = 100 * 1024 * 1024
const OK_EXT = ['.wav', '.mp3', '.m4a']

/** 음성 업로드(P1). 브라우저에서 확장자·용량을 먼저 검사한다(서버도 415·413으로 거부). */
export default function UploadDropzone() {
  const qc = useQueryClient()
  const [calledAt, setCalledAt] = useState<Dayjs | null>(null)
  const [agent, setAgent] = useState('')
  const [company, setCompany] = useState('')
  const [dup, setDup] = useState<string | null>(null)

  return (
    <div>
      <Upload.Dragger
        multiple
        showUploadList={{ showRemoveIcon: false }}
        accept={OK_EXT.join(',')}
        beforeUpload={(file) => {
          const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
          if (!OK_EXT.includes(ext)) {
            void message.error('wav, mp3, m4a 파일만 올릴 수 있습니다')
            return Upload.LIST_IGNORE
          }
          if (file.size > MAX_BYTES) {
            void message.error('100MB 이하 파일만 올릴 수 있습니다')
            return Upload.LIST_IGNORE
          }
          return true
        }}
        customRequest={async ({ file, onSuccess, onError }) => {
          setDup(null)
          try {
            await uploadRecording(file as File, {
              called_at: calledAt ? toKstIso(calledAt.toDate()) : undefined, // +09:00 필수
              agent_name: agent || undefined,
              customer_company: company || undefined,
            })
            void qc.invalidateQueries({ queryKey: ['calls'] })
            void qc.invalidateQueries({ queryKey: ['stats'] })
            onSuccess?.('ok')
          } catch (e) {
            if (e instanceof ApiError && e.code === 'DUPLICATE_FILE') {
              setDup(`이미 처리 중이거나 완료된 파일입니다${e.body?.existing_call_id ? ` (${e.body.existing_call_id})` : ''}`)
            } else {
              void message.error((e as Error).message)
            }
            onError?.(e as Error)
          }
        }}
      >
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">음성 파일을 끌어다 놓거나 눌러서 선택</p>
        <p className="ant-upload-hint">wav · mp3 · m4a, 100MB 이하. 파일명 형식: YYYYMMDD_HHmm_담당자_고객사.wav</p>
      </Upload.Dragger>
      {dup && <Alert style={{ marginTop: 8 }} type="warning" showIcon message={dup} closable onClose={() => setDup(null)} />}
      <Collapse
        ghost
        size="small"
        items={[
          {
            key: 'meta',
            label: '통화일시·담당자·고객사 직접 입력 (비우면 파일명에서 읽음)',
            children: (
              <Space wrap>
                <DatePicker showTime placeholder="통화일시" value={calledAt} onChange={setCalledAt} />
                <Input placeholder="담당자" style={{ width: 130 }} value={agent} onChange={(e) => setAgent(e.target.value)} />
                <Input placeholder="고객사" style={{ width: 150 }} value={company} onChange={(e) => setCompany(e.target.value)} />
              </Space>
            ),
          },
        ]}
      />
    </div>
  )
}
