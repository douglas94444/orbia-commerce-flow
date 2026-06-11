# Deploy Orbia Commerce Flow to Cloudflare Workers
# Usage: .\scripts\deploy-cloudflare.ps1
# Requires CLOUDFLARE_API_TOKEN in .env or environment

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Load-DotEnv {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return }
    Get-Content $Path | ForEach-Object {
        if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
        if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
            $name = $Matches[1]
            $value = $Matches[2].Trim().Trim('"').Trim("'")
            if (-not [string]::IsNullOrWhiteSpace($value)) {
                Set-Item -Path "env:$name" -Value $value
            }
        }
    }
}

Load-DotEnv (Join-Path $Root ".env")

if (-not $env:CLOUDFLARE_API_TOKEN) {
    Write-Error @"
CLOUDFLARE_API_TOKEN ausente.
1. Crie um token em https://dash.cloudflare.com/profile/api-tokens (template: Edit Cloudflare Workers)
2. Adicione ao .env: CLOUDFLARE_API_TOKEN=seu_token
   ou execute: `$env:CLOUDFLARE_API_TOKEN = 'seu_token'
3. Alternativa: npx wrangler login (abrir o link no navegador)
"@
}

Write-Host ">> npm run build"
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ">> wrangler deploy"
npx wrangler deploy --config ".output/server/wrangler.json"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ">> sync worker secrets from .env"
& (Join-Path $Root "scripts/sync-worker-secrets.ps1")

Write-Host "Deploy concluido."
