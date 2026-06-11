# Sync server-side secrets from .env to Cloudflare Worker
# Skips VITE_* and empty values

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Load-DotEnv {
    param([string]$Path)
    $vars = @{}
    if (-not (Test-Path $Path)) { return $vars }
    Get-Content $Path | ForEach-Object {
        if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
        if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
            $name = $Matches[1]
            $value = $Matches[2].Trim().Trim('"').Trim("'")
            if (-not [string]::IsNullOrWhiteSpace($value)) {
                $vars[$name] = $value
            }
        }
    }
    return $vars
}

if (-not $env:CLOUDFLARE_API_TOKEN) {
    $dot = Load-DotEnv (Join-Path $Root ".env")
    if ($dot.ContainsKey('CLOUDFLARE_API_TOKEN')) {
        $env:CLOUDFLARE_API_TOKEN = $dot['CLOUDFLARE_API_TOKEN']
    }
}

if (-not $env:CLOUDFLARE_API_TOKEN) {
    Write-Error "CLOUDFLARE_API_TOKEN required for secret sync"
}

$skip = @('CLOUDFLARE_API_TOKEN', 'VITE_DEMO_MODE')
$vars = Load-DotEnv (Join-Path $Root ".env")

foreach ($key in $vars.Keys) {
    if ($key -like 'VITE_*') { continue }
    if ($skip -contains $key) { continue }
    Write-Host "  secret put $key"
    $vars[$key] | npx wrangler secret put $key --config ".output/server/wrangler.json"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Secrets sincronizados: $($vars.Keys.Count - $skip.Count) variaveis (aprox.)"
