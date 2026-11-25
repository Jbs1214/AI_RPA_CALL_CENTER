import { useState } from 'react'
import { Alert, Button, DatePicker, Input, Popover, Tag, Tooltip, Upload, message } from 'antd'
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
 * 음성 업로드: 지표와 목록 사이의 안내 띠(왼쪽 글자·버튼, 오른쪽 끌어놓기 칸).
 * 파일을 고르거나 끌어다 놓으면 바로 올리지 않고 아래 목록에 담는다.
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

  const hasMeta = calledAt !== null || agent !== '' || company !== ''
  const hasAnything = queue.items.length > 0 || queue.dup !== null || hasMeta

  /** 확장자와 용량을 보고 통과한 파일만 목록에 담는다 */
  const accept = (file: File) => {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (!OK_EXT.includes(ext)) {
      void message.error('wav, mp3, m4a 파일만 올릴 수 있습니다')
    } else if (file.size > MAX_BYTES) {
      void message.error('100MB 이하 파일만 올릴 수 있습니다')
    } else {
      queue.add(file)
    }
  }

  const reset = () => {
    queue.clear()
    setCalledAt(null)
    setAgent('')
    setCompany('')
  }

  const metaFields = (
    <div className="upload-meta">
      <p className="upload-meta__note">비워 두면 파일 이름에서 읽습니다.</p>
      <DatePicker showTime={{ format: 'HH:mm' }} format="YYYY-MM-DD HH:mm" placeholder="통화일시" value={calledAt} onChange={setCalledAt} />
      <Input placeholder="담당자" value={agent} onChange={(e) => setAgent(e.target.value)} />
      <Input placeholder="고객사" value={company} onChange={(e) => setCompany(e.target.value)} />
    </div>
  )

  /** 파일 고르기 공통 설정: 검사만 하고 바로 올리지 않는다 */
  const pick = {
    multiple: true,
    showUploadList: false,
    accept: OK_EXT.join(','),
    disabled: queue.busy,
    beforeUpload: (file: File) => {
      accept(file)
      return Upload.LIST_IGNORE // "업로드 시작"을 눌러야 올라간다
    },
  }

  return (
    <section className="upload">
      <div className="upload__intro">
        <h2 className="upload__title">음성 파일 올리기</h2>
        <Tooltip title="파일 이름 형식: YYYYMMDD_HHmm_담당자_고객사.wav. 이름을 못 읽으면 고객사가 '미확인'으로 나옵니다.">
          <p className="upload__desc">올린 파일은 분석되어 아래 통화 목록에 들어옵니다. wav · mp3 · m4a, 100MB 이하</p>
        </Tooltip>
        <div className="upload__buttons">
          <Upload {...pick}>
            <Button type="primary" shape="round" disabled={queue.busy}>
              음성 파일 선택
            </Button>
          </Upload>
          <Popover trigger="click" placement="bottomLeft" content={metaFields}>
            <Button shape="round">직접 입력{hasMeta ? ' ·' : ''}</Button>
          </Popover>
          {queue.items.length > 0 &&
            (queue.busy ? (
              <Button danger shape="round" onClick={queue.stop}>
                올리기 중단
              </Button>
            ) : (
              <Button shape="round" disabled={queue.readyCount === 0} onClick={() => void queue.start()}>
                업로드 시작{queue.readyCount > 0 ? ` (${queue.readyCount})` : ''}
              </Button>
            ))}
          {hasAnything && (
            <Button type="text" shape="round" onClick={reset}>
              초기화
            </Button>
          )}
        </div>
      </div>

      <Upload.Dragger {...pick} className="upload__drop">
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">여기로 끌어다 놓으세요</p>
      </Upload.Dragger>

      {queue.items.length > 0 && (
        <ul className="upload-queue">
          {queue.items.map((item) => (
            <QueueRow key={item.uid} item={item} onRemove={queue.remove} />
          ))}
        </ul>
      )}

      {queue.dup && <Alert className="upload__alert" type="warning" showIcon message={queue.dup} closable onClose={() => queue.setDup(null)} />}
    </section>
  )
}