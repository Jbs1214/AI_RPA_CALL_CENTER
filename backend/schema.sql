-- ============================================================
-- 콜센터 AI·RPA 비서 - 백엔드 스키마 v2 (PostgreSQL 16, 14 이상 가능)
-- 표 2개: calls(통화 1건 = 1행), job_events(Orchestrator Webhook 수신 기록)
-- 실행: psql -U postgres -d callcenter -f schema.sql
-- ============================================================

-- DB 시간대를 한국 시간으로 (데이터베이스 이름은 실제 이름으로)
--   ALTER DATABASE callcenter SET timezone = 'Asia/Seoul';

-- 관리번호 순번 (CALL-저장한날짜-순번). 하루 단위로 초기화되지 않고 계속 증가한다.
CREATE SEQUENCE call_no_seq START 1;

CREATE TABLE calls (
    call_id           TEXT PRIMARY KEY
                      DEFAULT 'CALL-' || to_char(now() AT TIME ZONE 'Asia/Seoul', 'YYYYMMDD')
                                      || '-' || lpad(nextval('call_no_seq')::text, 3, '0'),

    -- 통화 정보 (파일명 또는 업로드 때 입력한 값)
    called_at         TIMESTAMPTZ NOT NULL,
    agent_name        TEXT        NOT NULL,
    customer_company  TEXT,
    customer_phone    TEXT,                              -- 마스킹된 값만 저장

    -- AI 분석 결과 (처리 중이거나 실패한 통화는 NULL)
    category          TEXT CHECK (category IN ('질의','불만','건의','교육 내용','기타 문의')),
    customer_question TEXT,
    action_taken      TEXT,
    follow_up_needed  BOOLEAN,
    confidence        NUMERIC(3,2) CHECK (confidence BETWEEN 0 AND 1),   -- 신뢰도(③ v0.6: STT 인식 신뢰도). 0.7 미만이면 검토 필요
    needs_review      BOOLEAN,

    -- 원본 파일
    source_filename   TEXT        NOT NULL,              -- 올라온 파일 이름 (표시·증빙용. 저장 경로에는 쓰지 않는다)
    file_hash         TEXT        NOT NULL UNIQUE,       -- 오디오 바이트의 SHA-256 (소문자 16진수 64자). 중복 방지
    audio_path        TEXT,                              -- 스토리지 루트 기준 상대 경로, 예: 2026/11/CALL-20261123-016.wav
    audio_size_bytes  BIGINT CHECK (audio_size_bytes >= 0),

    -- 대화 원문과 AI 원본 응답
    transcript        TEXT,                              -- 마스킹된 대화 전체. 줄마다 "[상담원] ..." / "[고객] ..."
    analysis_json     JSONB,                             -- AI가 돌려준 JSON 그대로(감사·재가공용). 화면은 위 컬럼을 쓴다

    -- 처리 상태
    status            TEXT        NOT NULL DEFAULT 'RECEIVED'
                      CHECK (status IN ('RECEIVED','PROCESSING','DONE','FAILED')),
    error_message     TEXT,                              -- FAILED일 때 "코드: 사유"
    retry_count       INT         NOT NULL DEFAULT 0,    -- 실패 후 다시 시작한 횟수

    -- UiPath Orchestrator 작업 정보
    job_key           TEXT,                              -- Orchestrator Job Key(UUID 문자열)
    job_state         TEXT,                              -- Orchestrator가 알려준 작업 상태 원문(Pending, Running, Successful, Faulted, Stopped 등)

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_done_has_category CHECK (status <> 'DONE'   OR category IS NOT NULL),
    CONSTRAINT chk_done_has_flags    CHECK (status <> 'DONE'   OR (follow_up_needed IS NOT NULL AND needs_review IS NOT NULL)),
    CONSTRAINT chk_failed_has_reason CHECK (status <> 'FAILED' OR error_message IS NOT NULL),
    -- 업로드로 들어와 처리 대기·처리 중인 통화는 음성 파일 경로가 있어야 한다
    CONSTRAINT chk_pending_has_audio CHECK (status NOT IN ('RECEIVED','PROCESSING') OR audio_path IS NOT NULL),
    CONSTRAINT chk_hash_format       CHECK (file_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX idx_calls_called_at   ON calls (called_at DESC);
CREATE INDEX idx_calls_status      ON calls (status, called_at DESC);
CREATE INDEX idx_calls_category    ON calls (category) WHERE category IS NOT NULL;
CREATE INDEX idx_calls_agent       ON calls (agent_name);
CREATE INDEX idx_calls_company     ON calls (customer_company);
CREATE INDEX idx_calls_job_key     ON calls (job_key) WHERE job_key IS NOT NULL;

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION trg_calls_touch() RETURNS trigger AS $$
BEGIN NEW.updated_at := clock_timestamp(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER calls_touch BEFORE UPDATE ON calls FOR EACH ROW EXECUTE FUNCTION trg_calls_touch();

-- Orchestrator Webhook 수신 기록. event_id가 기본키라서 같은 이벤트가 두 번 와도 한 번만 처리한다.
CREATE TABLE job_events (
    event_id    TEXT PRIMARY KEY,                        -- Orchestrator의 EventId
    event_type  TEXT NOT NULL,                           -- job.started, job.completed, job.faulted 등
    job_key     TEXT,
    call_id     TEXT REFERENCES calls(call_id) ON DELETE SET NULL,
    payload     JSONB NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_job_events_job_key ON job_events (job_key);
CREATE INDEX idx_job_events_call_id ON job_events (call_id);

-- ============================================================
-- 백엔드가 쓰는 핵심 SQL (psql로 확인한 것). :이름 은 바인딩 값.
-- ============================================================

-- [조회 기간] from/to는 한국 시간 날짜, to 당일 포함. 모든 조회에 같은 조건을 쓴다.
--   WHERE called_at >= (:from::timestamp AT TIME ZONE 'Asia/Seoul')
--     AND called_at <  ((:to::date + 1)::timestamp AT TIME ZONE 'Asia/Seoul')

-- [통계 합계] total_calls=전체 행, analyzed=DONE, in_progress=RECEIVED+PROCESSING
--   SELECT COUNT(*) AS total_calls,
--          COUNT(*) FILTER (WHERE status = 'DONE') AS analyzed,
--          COUNT(*) FILTER (WHERE follow_up_needed) AS follow_up_needed,
--          COUNT(*) FILTER (WHERE needs_review) AS needs_review,
--          COUNT(*) FILTER (WHERE status = 'FAILED') AS failed,
--          COUNT(*) FILTER (WHERE status IN ('RECEIVED','PROCESSING')) AS in_progress
--   FROM calls;
-- [유형별]   SELECT category, COUNT(*) FROM calls WHERE status='DONE' GROUP BY category;
-- [담당자별] SELECT agent_name, COUNT(*), COUNT(*) FILTER (WHERE follow_up_needed)
--            FROM calls WHERE status='DONE' GROUP BY agent_name;
-- [일자별×유형별]
--   SELECT (called_at AT TIME ZONE 'Asia/Seoul')::date AS d, category, COUNT(*)
--   FROM calls WHERE status='DONE' GROUP BY d, category ORDER BY d;
-- [고객사별 불만 상위 10]
--   SELECT customer_company, COUNT(*) AS call_count, COUNT(*) FILTER (WHERE category='불만') AS complaint_count
--   FROM calls WHERE status='DONE' AND customer_company IS NOT NULL
--   GROUP BY customer_company ORDER BY complaint_count DESC, call_count DESC LIMIT 10;

-- [결과 포함 저장: POST /api/calls] 새 파일은 넣고, 같은 파일이 FAILED면 덮어쓰고, DONE/처리 중이면 0행(→ 409)
--   INSERT INTO calls (...) VALUES (...)
--   ON CONFLICT (file_hash) DO UPDATE SET
--          called_at=EXCLUDED.called_at, agent_name=EXCLUDED.agent_name, customer_company=EXCLUDED.customer_company,
--          customer_phone=EXCLUDED.customer_phone, category=EXCLUDED.category, customer_question=EXCLUDED.customer_question,
--          action_taken=EXCLUDED.action_taken, follow_up_needed=EXCLUDED.follow_up_needed, confidence=EXCLUDED.confidence,
--          needs_review=EXCLUDED.needs_review, source_filename=EXCLUDED.source_filename, transcript=EXCLUDED.transcript,
--          analysis_json=EXCLUDED.analysis_json, status=EXCLUDED.status, error_message=EXCLUDED.error_message,
--          retry_count=calls.retry_count + 1
--   WHERE calls.status = 'FAILED'
--   RETURNING call_id;

-- [처리 시작: POST /api/calls/{id}/process] RECEIVED·FAILED일 때만 PROCESSING으로 (0행이면 409)
--   UPDATE calls SET status='PROCESSING', job_key=:job_key, job_state='Pending', error_message=NULL,
--                    retry_count = retry_count + (CASE WHEN status='FAILED' THEN 1 ELSE 0 END)
--   WHERE call_id=:id AND status IN ('RECEIVED','FAILED') RETURNING call_id;

-- [결과 받기: PUT /api/calls/{id}/result] DONE이 아닌 통화만 결과를 받는다 (0행이면 404 또는 409)
--   UPDATE calls SET status=:status, category=..., customer_question=..., action_taken=..., follow_up_needed=...,
--                    needs_review=..., confidence=..., transcript=..., analysis_json=..., error_message=...
--   WHERE call_id=:id AND status IN ('RECEIVED','PROCESSING','FAILED') RETURNING call_id;

-- [Webhook 중복 막기] 0행이면 이미 처리한 이벤트
--   INSERT INTO job_events (event_id, event_type, job_key, call_id, payload)
--   VALUES (:event_id, :type, :job_key, (SELECT call_id FROM calls WHERE job_key=:job_key), :payload)
--   ON CONFLICT (event_id) DO NOTHING RETURNING event_id;

-- [시간 초과 정리: 목록·통계 조회 때 1분에 한 번] 처리 중인데 :분 넘게 결과가 없는 통화 → FAILED(TIMEOUT)
--   UPDATE calls SET status='FAILED', error_message='TIMEOUT: …'
--   WHERE status='PROCESSING' AND updated_at < now() - (:분::int * interval '1 minute');
