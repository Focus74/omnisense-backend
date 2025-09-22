# backup-db.ps1 — PostgreSQL daily backup (keep 14 days), ASCII only

$PGHOST="localhost"
$PGPORT="5433"
$PGUSER="postgres"
$PGDB="omnisense"
$PGPASS="1234"                      # change to your real password
$OUTDIR="D:\backups\omnisense"
$RETENTION_DAYS=14
$ErrorActionPreference="Stop"

# 1) Resolve pg_dump path
$pgDumpCmd = $env:PGDUMP_PATH
if (-not ($pgDumpCmd -and (Test-Path $pgDumpCmd))) {
  $pgDumpCandidates = @(
    "D:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
    "D:\Program Files\PostgreSQL\15\bin\pg_dump.exe",
    "D:\Program Files\PostgreSQL\14\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\14\bin\pg_dump.exe"
  )
  foreach ($c in $pgDumpCandidates) { if (Test-Path $c) { $pgDumpCmd = $c; break } }
  if (-not $pgDumpCmd) {
    $cmd = Get-Command pg_dump -ErrorAction SilentlyContinue
    if ($cmd) { $pgDumpCmd = $cmd.Source }
  }
  if (-not $pgDumpCmd) { throw "pg_dump not found. Set PGDUMP_PATH or adjust candidates." }
}

Write-Host ("Using pg_dump: " + $pgDumpCmd)

# 2) Ensure output dir
if (-not (Test-Path $OUTDIR)) { New-Item -ItemType Directory -Force $OUTDIR | Out-Null }

# 3) Export password for pg_dump
$env:PGPASSWORD = $PGPASS

# 4) Make file name
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$outFile = Join-Path $OUTDIR ("omnisense_" + $ts + ".dump")

# 5) Run dump (custom format)
& $pgDumpCmd -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDB -Fc -f $outFile
Write-Host ("Backup created: " + $outFile)

# 6) Retention
Get-ChildItem $OUTDIR -Filter "*.dump" | Where-Object {
  $_.LastWriteTime -lt (Get-Date).AddDays(-$RETENTION_DAYS)
} | Remove-Item -Force -ErrorAction SilentlyContinue

# 7) Cleanup
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
