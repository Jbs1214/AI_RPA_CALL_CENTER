import { useState } from 'react'
import { Alert, Button, Collapse, DatePicker, Input, Space, Tag, Tooltip, Upload, message } from 'antd'
import { CloseOutlined, InboxOutlined, LoadingOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import { toKstIso } from '../../lib/date'
import { useUploadQueue, type StagedFile } from './useUploadQueue'

const MAX_BYTES = 100 * 1024 * 1024
const OK_EXT = ['.wav', '.mp3', '.m4a']

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)}MB`

/** 담아 둔 파일 한 줄: 이름, 크기, 상태, 빼기(올리는 중이면 취소) 버튼 */
function QueueRow({ item, onRemove }: { item: StagedFile; onRemove: (uid: string) => void }) {
  const uploading = item.status === 'uploading'
  return (
    <li className="upload-queue__row">
      <span className="upload-queue__name" title={item.file.name}>
        {item.file.name}
      </span>
      <span className="upload-queue__size">{mb(item.file.size)}</span>
      {item.status === 'ready' && <Tag>대기</Tag>}
      {uploading && (
        <Tag color="processing" icon={<LoadingOutlined />}>
          올리는 중
        </Tag>
      )}
      {item.status === 'done' && <Tag color="success">완료</Tag>}
      {item.status === 'error' && (
        <Tooltip title={item.error}>
          <Tag color="error">실패</Tag>
        </Tooltip>
      )}
      <Button
        size="small"
        type="text"
        icon={<CloseOutlined />}
        aria-label={uploading ? '올리기 취소' : '목록에서 빼기'}
        title={uploading ? '올리기 취소' : '목록에서 빼기'}
        onClick={() => onRemove(item.uid)}
      />
    </li>
  )
}

/**
 * 음성 업로드. 파일을 고르면 바로 올리지 않고 목록에 담는다.
 * 목록에서 하나씩 빼거나 "초기화"로 전부 비울 수 있고, 올리는 도중에도 취소할 수 있다.
 * 브라우저에서 확장자·용량을 먼저 검사한다(서버도 415·413으로 거부).
 */
export default function UploadDropzone() {
  const [calledAt, setCalledAt] = useState<Dayjs | null>(null)
  const [agent, setAgent] = useState('')
  const [company, setCompany] = useState('')

  const queue = useUploadQueue(() => ({
    called_at: calledAt ? toKstIso(calledAt.second(0).toDate()) : undefined, // +09:00 필수
    agent_name: agent || undefined,
    customer_company: company || undefined,
  }))

  const hasAnything = queue.items.length > 0 || queue.dup !== null || calledAt !== null || agent !== '' || company !== ''

  const reset = () => {
    queue.clear()
    setCalledAt(null)
    setAgent('')
    setCompany('')
  }

  return (
    <div className="upload">
      <Upload.Dragger
        multiple
        showUploadList={false}
        accept={OK_EXT.join(',')}
        disabled={queue.busy}
        beforeUpload={(file) => {
          const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
          if (!OK_EXT.includes(ext)) {
            void message.error('wav, mp3, m4a 파일만 올릴 수 있습니다')
          } else if (file.size > MAX_BYTES) {
            void message.error('100MB 이하 파일만 올릴 수 있습니다')
          } else {
            queue.add(file)
          }
          return Upload.LIST_IGNORE // 바로 올리지 않는다. "업로드 시작"을 눌러야 올라간다
        }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <div className="upload__copy">
          <p className="ant-upload-text">음성 파일을 끌어다 놓거나 눌러서 선택</p>
          <p className="ant-upload-hint">wav · mp3 · m4a, 100MB 이하. 파일명 형식: YYYYMMDD_HHmm_담당자_고객사.wav</p>
        </div>
      </Upload.Dragger>

      {queue.items.length > 0 && (
        <ul className="upload-queue">
          {queue.items.map((item) => (
            <QueueRow key={item.uid} item={item} onRemove={queue.remove} />
          ))}
        </ul>
      )}

      {queue.dup && <Alert style={{ marginTop: 8 }} type="warning" showIcon message={queue.dup} closable onClose={() => queue.setDup(null)} />}

      <Collapse
        ghost
        size="small"
        items={[
          {
            key: 'meta',
            label: '통화일시·담당자·고객사 직접 입력 (비우면 파일명에서 읽음)',
            children: (
              <Space wrap>
                <DatePicker showTime={{ format: 'HH:mm' }} format="YYYY-MM-DD HH:mm" placeholder="통화일시" value={calledAt} onChange={setCalledAt} />
                <Input placeholder="담당자" style={{ width: 130 }} value={agent} onChange={(e) => setAgent(e.target.value)} />
                <Input placeholder="고객사" style={{ width: 150 }} value={company} onChange={(e) => setCompany(e.target.value)} />
              </Space>
            ),
          },
        ]}
      />

      {hasAnything && (
        <div className="upload-actions">
          {queue.busy ? (
            <Button danger onClick={queue.stop}>
              올리기 중단
            </Button>
          ) : (
            <Button type="primary" disabled={queue.readyCount === 0} onClick={() => void queue.start()}>
              업로드 시작{queue.readyCount > 0 ? ` (${queue.readyCount}개)` : ''}
            </Button>
          )}
          <Button onClick={reset}>초기화</Button>
        </div>
      )}
    </div>
  )
}
