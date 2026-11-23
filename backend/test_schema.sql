\set ON_ERROR_STOP on
BEGIN;
SET timezone='Asia/Seoul';
DO $$
DECLARE r record; n int; v text; h text := repeat('a',64); h2 text := repeat('b',64); h3 text := repeat('c',64);
BEGIN
  -- 1. seed 통계 (이전 설계와 같은 숫자)
  SELECT COUNT(*) total, COUNT(*) FILTER (WHERE status='DONE') analyzed, COUNT(*) FILTER (WHERE follow_up_needed) fu,
         COUNT(*) FILTER (WHERE needs_review) rv, COUNT(*) FILTER (WHERE status='FAILED') failed,
         COUNT(*) FILTER (WHERE status IN ('RECEIVED','PROCESSING')) ip INTO r FROM calls;
  ASSERT r.total=15 AND r.analyzed=14 AND r.fu=6 AND r.rv=2 AND r.failed=1 AND r.ip=0, 'seed 합계 '||r::text;
  SELECT COUNT(*) INTO n FROM calls WHERE status='DONE' AND analysis_json IS NOT NULL; ASSERT n=14, 'analysis_json';
  SELECT COUNT(*) INTO n FROM calls WHERE called_at >= ('2026-11-23'::timestamp AT TIME ZONE 'Asia/Seoul')
     AND called_at < (('2026-11-23'::date+1)::timestamp AT TIME ZONE 'Asia/Seoul'); ASSERT n=6, '기간 11-23';
  SELECT COUNT(*) INTO n FROM calls WHERE status='DONE' AND called_at >= ('2026-11-20'::timestamp AT TIME ZONE 'Asia/Seoul')
     AND called_at < (('2026-11-22'::date+1)::timestamp AT TIME ZONE 'Asia/Seoul'); ASSERT n=9, '기간 11-20~22';
  SELECT customer_company INTO v FROM calls WHERE status='DONE' GROUP BY customer_company
     ORDER BY COUNT(*) FILTER (WHERE category='불만') DESC, COUNT(*) DESC LIMIT 1; ASSERT v='새봄물산','고객사 1위 '||v;

  -- 2. 업로드 직후 상태: 음성 경로가 있어야 RECEIVED 가능
  INSERT INTO calls (called_at, agent_name, source_filename, file_hash, audio_path, audio_size_bytes)
  VALUES ('2026-11-23T13:00:00+09:00','박지훈','20261123_1300_박지훈_대한유통.wav', h, '2026/11/X.wav', 1234) RETURNING call_id INTO v;
  ASSERT v ~ '^CALL-20[0-9]{6}-016$', 'call_id '||v;
  SELECT status INTO v FROM calls WHERE file_hash=h; ASSERT v='RECEIVED','기본 상태';
  BEGIN INSERT INTO calls (called_at,agent_name,source_filename,file_hash) VALUES (now(),'x','x.wav',h2);
        ASSERT false,'audio 없는 RECEIVED 허용됨'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO calls (called_at,agent_name,source_filename,file_hash,audio_path) VALUES (now(),'x','x.wav','ZZ','p');
        ASSERT false,'해시 형식 허용됨'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO calls (called_at,agent_name,source_filename,file_hash,audio_path) VALUES (now(),'x','x.wav',h,'p');
        ASSERT false,'해시 중복 허용됨'; EXCEPTION WHEN unique_violation THEN NULL; END;

  -- 3. 처리 시작 (RECEIVED→PROCESSING), 두 번째는 0행
  UPDATE calls SET status='PROCESSING', job_key='11111111-1111-1111-1111-111111111111', job_state='Pending'
   WHERE file_hash=h AND status IN ('RECEIVED','FAILED'); GET DIAGNOSTICS n = ROW_COUNT; ASSERT n=1,'처리 시작';
  UPDATE calls SET status='PROCESSING' WHERE file_hash=h AND status IN ('RECEIVED','FAILED'); GET DIAGNOSTICS n = ROW_COUNT; ASSERT n=0,'중복 시작';

  -- 4. 결과 받기: DONE에 플래그가 없으면 DB가 거부
  BEGIN UPDATE calls SET status='DONE', category='질의' WHERE file_hash=h;
        ASSERT false,'플래그 없는 DONE 허용됨'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN UPDATE calls SET status='FAILED' WHERE file_hash=h;
        ASSERT false,'사유 없는 FAILED 허용됨'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN UPDATE calls SET category='문의' WHERE file_hash=h;
        ASSERT false,'잘못된 유형 허용됨'; EXCEPTION WHEN check_violation THEN NULL; END;
  UPDATE calls SET status='DONE', category='질의', customer_question='q', action_taken='a', follow_up_needed=false,
         needs_review=false, confidence=0.91, analysis_json='{"category":"질의"}'
   WHERE file_hash=h AND status IN ('RECEIVED','PROCESSING','FAILED'); GET DIAGNOSTICS n = ROW_COUNT; ASSERT n=1,'결과 저장';
  PERFORM pg_sleep(0.01);
  UPDATE calls SET status='DONE' WHERE file_hash=h AND status IN ('RECEIVED','PROCESSING','FAILED'); GET DIAGNOSTICS n = ROW_COUNT;
  ASSERT n=0,'DONE 재결과는 0행';
  SELECT COUNT(*) INTO n FROM calls WHERE updated_at > created_at AND file_hash=h; ASSERT n=1,'updated_at 트리거';

  -- 5. 결과 포함 저장 upsert: FAILED는 덮어쓰기(번호 유지), DONE/처리중은 0행
  INSERT INTO calls (called_at,agent_name,source_filename,file_hash,status,error_message)
    VALUES (now(),'김민수','f.wav',h2,'FAILED','STT_TIMEOUT: x') RETURNING call_id INTO v;
  WITH u AS (INSERT INTO calls (called_at,agent_name,source_filename,file_hash,category,follow_up_needed,needs_review,status)
     VALUES (now(),'김민수','f.wav',h2,'불만',true,false,'DONE')
     ON CONFLICT (file_hash) DO UPDATE SET category=EXCLUDED.category, follow_up_needed=EXCLUDED.follow_up_needed,
       needs_review=EXCLUDED.needs_review, status=EXCLUDED.status, error_message=NULL, retry_count=calls.retry_count+1
     WHERE calls.status='FAILED' RETURNING call_id)
  SELECT call_id INTO v FROM u; ASSERT v IS NOT NULL,'FAILED 덮어쓰기';
  SELECT retry_count INTO n FROM calls WHERE file_hash=h2; ASSERT n=1,'retry_count';
  WITH u AS (INSERT INTO calls (called_at,agent_name,source_filename,file_hash,category,follow_up_needed,needs_review,status)
     VALUES (now(),'김민수','f.wav',h2,'불만',true,false,'DONE')
     ON CONFLICT (file_hash) DO UPDATE SET category='건의' WHERE calls.status='FAILED' RETURNING call_id)
  SELECT COUNT(*) INTO n FROM u; ASSERT n=0,'DONE 중복은 0행(409)';

  -- 6. Webhook 중복 이벤트
  INSERT INTO calls (called_at,agent_name,source_filename,file_hash,audio_path,status,job_key)
    VALUES (now(),'이서연','g.wav',h3,'p','PROCESSING','22222222-2222-2222-2222-222222222222');
  WITH e AS (INSERT INTO job_events (event_id,event_type,job_key,call_id,payload)
    VALUES ('ev-1','job.faulted','22222222-2222-2222-2222-222222222222',(SELECT call_id FROM calls WHERE job_key='22222222-2222-2222-2222-222222222222'),'{"Type":"job.faulted"}')
    ON CONFLICT (event_id) DO NOTHING RETURNING event_id) SELECT COUNT(*) INTO n FROM e; ASSERT n=1,'이벤트 첫 수신';
  WITH e AS (INSERT INTO job_events (event_id,event_type,job_key,payload) VALUES ('ev-1','job.faulted','x','{}')
    ON CONFLICT (event_id) DO NOTHING RETURNING event_id) SELECT COUNT(*) INTO n FROM e; ASSERT n=0,'이벤트 중복';
  SELECT COUNT(*) INTO n FROM calls WHERE status='PROCESSING' AND updated_at < now() - (30 || ' minutes')::interval; ASSERT n=0,'방금 시작한 작업은 멈춘 작업이 아니다';
  SELECT COUNT(*) INTO n FROM calls WHERE status='PROCESSING' AND updated_at < now() + (1 || ' minutes')::interval; ASSERT n=1,'멈춘 작업 조회식 동작';

  -- 7. 통화 삭제 시 이벤트 기록은 남고 call_id만 비워진다
  DELETE FROM calls WHERE file_hash=h3;
  SELECT COUNT(*) INTO n FROM job_events WHERE event_id='ev-1' AND call_id IS NULL; ASSERT n=1,'삭제 후 이벤트 보존';
  RAISE NOTICE 'ALL PASS';
END $$;
ROLLBACK;
