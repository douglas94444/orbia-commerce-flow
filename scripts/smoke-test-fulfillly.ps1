# Smoke test Fulfillly — valida build e checklist pós-deploy
# Usage: .\scripts\smoke-test-fulfillly.ps1 [-BaseUrl "https://app.orbia.com.br"]

param(
    [string]$BaseUrl = $env:APP_URL
)

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
            if (-not [string]::IsNullOrWhiteSpace($value) -and -not (Get-Item "env:$name" -ErrorAction SilentlyContinue)) {
                Set-Item -Path "env:$name" -Value $value
            }
        }
    }
}

Load-DotEnv (Join-Path $Root ".env")
if (-not $BaseUrl) { $BaseUrl = $env:APP_URL }
if (-not $BaseUrl) { $BaseUrl = "http://localhost:5173" }

Write-Host ">> Fulfillly smoke test"
Write-Host "   Base URL: $BaseUrl"

Write-Host ">> npm run build"
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$checks = @(
    @{ Name = "Dashboard logistica"; Path = "/logistics" },
    @{ Name = "SLA + penalidades"; Path = "/logistics/sla" },
    @{ Name = "Armazem + lotes"; Path = "/logistics/warehouse" },
    @{ Name = "Analytics 360"; Path = "/analytics" },
    @{ Name = "Coletas"; Path = "/logistics/pickups" },
    @{ Name = "Devolucoes"; Path = "/logistics/returns" },
    @{ Name = "PWA ops"; Path = "/ops" }
)

$failed = 0
foreach ($c in $checks) {
    $url = "$BaseUrl$($c.Path)"
    try {
        $res = Invoke-WebRequest -Uri $url -Method GET -MaximumRedirection 5 -TimeoutSec 30 -UseBasicParsing
        if ($res.StatusCode -ge 200 -and $res.StatusCode -lt 400) {
            Write-Host "[OK] $($c.Name) ($($res.StatusCode))"
        } else {
            Write-Host "[WARN] $($c.Name) status $($res.StatusCode)"
            $failed++
        }
    } catch {
        Write-Host "[FAIL] $($c.Name) - $($_.Exception.Message)"
        $failed++
    }
}

if (-not $env:CLOUDFLARE_API_TOKEN) {
    Write-Host "[SKIP] Deploy Cloudflare - CLOUDFLARE_API_TOKEN ausente no .env"
} else {
    Write-Host "[OK] CLOUDFLARE_API_TOKEN configurado (rode npm run deploy separadamente)"
}

if ($failed -gt 0) {
    Write-Host "Smoke test concluido com $failed falha(s) HTTP (rotas podem exigir auth)."
    exit 1
}

Write-Host "Smoke test concluido com sucesso."
