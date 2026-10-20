# Add the VOLT harness rules to Claude Code user memory. Windows PowerShell version of install-memory.sh.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\volt\install-memory.ps1 [-DryRun]
param([switch]$DryRun)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$src = Join-Path $repo 'plugins\volt\memory\harness-rules.md'
$dir = Join-Path $HOME '.claude'
$rules = Join-Path $dir 'volt-harness.md'
$memory = Join-Path $dir 'CLAUDE.md'
$marker = '<!-- volt-harness: managed by VOLT-Main scripts/volt/install-memory -->'

Write-Host "+ copy $src -> $rules"
if (-not $DryRun) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    Copy-Item -Force $src $rules
}

if ((Test-Path $memory) -and (Select-String -Path $memory -SimpleMatch $marker -Quiet)) {
    Write-Host "= $memory already imports volt-harness.md"
    return
}
if (Test-Path $memory) {
    $backup = "$memory.bak-$(Get-Date -Format yyyyMMddHHmmss)"
    Write-Host "+ copy $memory -> $backup"
    if (-not $DryRun) { Copy-Item $memory $backup }
}
Write-Host "+ append import of ~/.claude/volt-harness.md to $memory"
if (-not $DryRun) {
    $prefix = ''
    if ((Test-Path $memory) -and (Get-Item $memory).Length -gt 0) { $prefix = "`n" }
    Add-Content -Path $memory -Encoding utf8 -Value "$prefix$marker`n@~/.claude/volt-harness.md"
}
