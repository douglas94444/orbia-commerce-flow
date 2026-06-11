# Verifica artefatos de build do sprint estoque 100%
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$server = Join-Path $Root ".output/server"

if (-not (Test-Path (Join-Path $server "wrangler.json"))) {
    Write-Error "Execute npm run build primeiro"
}

$prefixes = @(
    "_dashboard.logistics.products",
    "_dashboard.logistics.inventory",
    "_dashboard.logistics.quarantine",
    "_ssr/ops.receiving"
)

$missing = @()
foreach ($prefix in $prefixes) {
    $pattern = Join-Path $server "$prefix*.mjs"
    if (-not (Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue)) {
        $missing += $prefix
    }
}

if ($missing.Count -gt 0) {
    Write-Host "FAIL modulos ausentes no build:"
    $missing | ForEach-Object { Write-Host "  $_" }
    exit 1
}

Write-Host "OK build contem rotas de estoque (products, inventory, quarantine, ops/receiving)"
exit 0
