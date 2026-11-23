#!/bin/sh
# 매일 1번 실행해 DB 덤프를 남긴다(docker 용). 예: crontab 에 `0 3 * * * cd /경로/deploy && ./backup.sh`
# 직접 설치(Windows)는 backup.ps1 을 쓴다.
set -eu
DIR=${BACKUP_DIR:-./backup}; mkdir -p "$DIR"
STAMP=$(date +%Y%m%d_%H%M)
docker compose exec -T db pg_dump -U callcenter -Fc callcenter > "$DIR/callcenter_$STAMP.dump"
find "$DIR" -name 'callcenter_*.dump' -mtime +14 -delete
echo "백업 완료: $DIR/callcenter_$STAMP.dump"
# 복원: docker compose exec -T db pg_restore -U callcenter -d callcenter --clean --if-exists < 덤프파일
