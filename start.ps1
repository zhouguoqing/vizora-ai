$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error 'Node.js 22.12+ is required. Install it, then retry.'
    exit 1
}
& node (Join-Path $PSScriptRoot 'scripts/start.mjs') @args
exit $LASTEXITCODE
