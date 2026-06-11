# Smoke test — local preview or production Worker URL
# Usage: .\scripts\smoke-test.ps1 [-BaseUrl "https://orbia-commerce-flow.workers.dev"]

param([string]$BaseUrl = "http://localhost:4173")

$routes = @(
    "/logistics/products",
    "/logistics/warehouse",
    "/logistics/inventory",
    "/logistics/quarantine",
    "/ops/receiving"
)

$failed = 0
foreach ($route in $routes) {
    $url = "$BaseUrl$route"
    try {
        $res = Invoke-WebRequest -Uri $url -UseBasicParsing -MaximumRedirection 0 -ErrorAction SilentlyContinue
        $code = $res.StatusCode
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if (-not $code) { $code = "ERR" }
    }
    $ok = $code -eq 200 -or $code -eq 307 -or $code -eq 302
    if (-not $ok) { $failed++ }
    Write-Host "$(if ($ok) { 'OK' } else { 'FAIL' }) $code $route"
}

# Cron endpoint (expects 401 without secret)
$cronUrl = "$BaseUrl/api/cron/run"
try {
    $cronRes = Invoke-WebRequest -Uri $cronUrl -Method POST -UseBasicParsing -ErrorAction SilentlyContinue
    $cronCode = $cronRes.StatusCode
} catch {
    $cronCode = $_.Exception.Response.StatusCode.value__
}
$cronOk = $cronCode -eq 401 -or $cronCode -eq 503
Write-Host "$(if ($cronOk) { 'OK' } else { 'FAIL' }) $cronCode POST /api/cron/run (sem auth)"
if (-not $cronOk) { $failed++ }

if ($failed -gt 0) { exit 1 }
Write-Host "Smoke test passou."
