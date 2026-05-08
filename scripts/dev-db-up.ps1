$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path $PSScriptRoot -Parent
$composeFile = Join-Path $projectRoot 'src\env\local\docker-compose.yml'

# ── 1. Start postgres ──────────────────────────────────────────────────────────
Write-Host 'Starting local PostgreSQL...' -ForegroundColor Cyan
docker compose -f $composeFile up -d
if ($LASTEXITCODE -ne 0) { exit 1 }

# ── 2. Wait until postgres accepts connections ─────────────────────────────────
Write-Host 'Waiting for PostgreSQL to be ready...' -ForegroundColor Cyan
$timeout = 60
$elapsed = 0
while ($true) {
    docker compose -f $composeFile exec -T postgres pg_isready -q 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { break }
    if ($elapsed -ge $timeout) {
        Write-Error "PostgreSQL did not become ready within $timeout seconds."
        exit 1
    }
    Start-Sleep 2
    $elapsed += 2
}

# ── 3. Run migrations ──────────────────────────────────────────────────────────
Write-Host 'Running migrations...' -ForegroundColor Cyan
Push-Location $projectRoot
try {
    npm run db:migrate
    if ($LASTEXITCODE -ne 0) { exit 1 }
} finally {
    Pop-Location
}

Write-Host 'Done. Database is up and migrations are applied.' -ForegroundColor Green
