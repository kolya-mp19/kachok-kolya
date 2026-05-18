$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path $PSScriptRoot -Parent
$composeFile = Join-Path $projectRoot 'env\local\docker-compose.yml'

Write-Host 'Stopping local PostgreSQL...' -ForegroundColor Cyan
docker compose -f $composeFile down
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host 'Local database stopped.' -ForegroundColor Green
