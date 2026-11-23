# 직접 설치(Windows, docker 없이)용 DB 백업. 매일 1번 실행해 덤프를 남기고 14일 지난 것은 지운다.
# 비밀번호는 여기에 쓰지 않는다. %APPDATA%\postgresql\pgpass.conf 또는 환경변수 PGPASSWORD 로 넣는다.
# 매일 03:00 자동 실행 등록(한 번만):
#   schtasks /Create /SC DAILY /ST 03:00 /TN CallCenterBackup /TR "powershell -ExecutionPolicy Bypass -File <이 파일 전체 경로>"
# 복원: pg_restore -U postgres -d callcenter --clean --if-exists <덤프파일>
$ErrorActionPreference = "Stop"
$dir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { Join-Path $PSScriptRoot "backup" }
$pgDump = if ($env:PG_DUMP) { $env:PG_DUMP } else { "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" }
$user = if ($env:PGUSER) { $env:PGUSER } else { "postgres" }
New-Item -ItemType Directory -Force $dir | Out-Null
$file = Join-Path $dir ("callcenter_{0}.dump" -f (Get-Date -Format "yyyyMMdd_HHmm"))
& $pgDump -U $user -h localhost -Fc -f $file callcenter
if ($LASTEXITCODE -ne 0) { throw "pg_dump 실패($LASTEXITCODE)" }
Get-ChildItem $dir -Filter "callcenter_*.dump" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } | Remove-Item
Write-Output "백업 완료: $file"
