# 백엔드 서버 실행 방법 (범수 PC)

서버는 **FastAPI + PostgreSQL 16**입니다. 둘 중 하나로 띄웁니다.

## A. docker (Docker Desktop이 있을 때, 명령 2개)
```
cd deploy
copy .env.example .env      # (mac/linux는 cp). 열어서 DB_PASSWORD 를 바꾼다
docker compose up -d --build
```
처음 한 번 `schema.sql`과 `seed.sql`이 자동으로 들어갑니다. 음성은 `deploy/recordings` 폴더에 쌓입니다.

## B. 직접 설치 (docker 없이)
1. PostgreSQL 16 설치 → DB `callcenter` 만들기 → `psql -U postgres -d callcenter -f schema.sql` → `-f seed.sql`
   (`ALTER DATABASE callcenter SET timezone='Asia/Seoul';` 도 한 번 실행)
2. Python 3.11 이상: `pip install -r requirements.txt`
3. 이 폴더에 `.env` 파일을 만든다(`deploy/.env.example` 복사). 직접 설치에서는 아래 두 줄을 켠다.
   ```
   DATABASE_URL=postgresql://postgres:비밀번호@localhost:5432/callcenter
   STORAGE_DIR=./recordings
   ```
4. `uvicorn app.main:app --host 0.0.0.0 --port 8000`

## 확인 (둘 다 공통)
- 브라우저: `http://localhost:8000/docs` (Swagger), `http://localhost:8000/health`
- **`python tests/smoke_test.py http://localhost:8000`** — 핵심 API 26개 항목을 순서대로 호출해 OK/FAIL을 보여 준다(만든 시험 데이터는 지운다). **서버를 처음 띄운 직후 한 번 돌려 본다.**
- 팀원 접속 주소: `http://<이 PC의 IP>:8000` (Windows 방화벽에서 8000 포트 허용). IP는 `ipconfig`로 확인.

## 설정 (.env)
- 챗봇 AI: `CHAT_AI_ENABLED=true` + `CHAT_AI_API_KEY=<Groq 키>`. 키는 `.env`에만 둔다. 꺼져 있거나 실패하면 규칙 방식으로만 답한다.
- Orchestrator: 기본 `ORCH_ENABLED=false`(가져가기 방식). 켤 때는 `ORCH_CLIENT_ID`, `ORCH_CLIENT_SECRET`, `ORCH_RELEASE_KEY`, `PUBLIC_BASE_URL`(봇 PC가 접속하는 서버 주소)을 채운다.
- 시연 전 백업: `docker compose exec -T db pg_dump -U callcenter -Fc callcenter > backup.dump` (docker 없이는 `pg_dump -Fc callcenter`).

## 폴더
```
app/            서버 코드 (설계서 7.3 구조)
  main.py       앱 시작, 오류 형식, 로그, 라우터 등록
  routers/      API (calls 1~6, export 7, chat 8, recordings 9~11, orchestrator 12, health)
  services/     규칙(logic), SQL(calls_repo), 저장소(storage), 마스킹, 챗봇, 엑셀, Orchestrator, 점검
  deps.py models.py   공통 조회 조건·키 확인, 요청 모델
tests/          test_logic.py(로직 시험), smoke_test.py(HTTP 점검)
schema.sql  seed.sql  test_schema.sql   DB
deploy/         docker-compose.yml, Dockerfile, .env.example, backup.sh
requirements.txt
```
로직 시험: `pip install pytest` 후 `python -m pytest tests/test_logic.py`
